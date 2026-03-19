/**
 * Integration tests for ElevatorManager
 * Tests elevator movement, boarding, exiting, and state transitions.
 */

// Helper to create a mock Phaser scene
function createMockScene(numFloors = 4) {
    const pendingCallbacks = [];
    const timerEvents = [];

    const scene = {
        currentFloor: 0,
        elevator_X_position: GameConfig.ELEVATOR_X_POSITION,
        players: [],
        buildingManager: {
            floors: new Array(numFloors).fill(null)
        },
        add: {
            image: (x, y, key) => ({
                x, y,
                _key: key,
                _depth: 0,
                _scale: 1,
                _visible: true,
                setOrigin: function() { return this; },
                setDepth: function(d) { this._depth = d; return this; },
                setScale: function(s) { this._scale = s; return this; },
                setVisible: function(v) { this._visible = v; return this; },
                setTexture: function(k) { this._key = k; return this; }
            }),
            renderTexture: () => ({
                setOrigin: function() { return this; },
                setDepth: function() { return this; },
                setScale: function() { return this; },
                drawFrame: function() {}
            })
        },
        time: {
            delayedCall: (delay, callback) => {
                const entry = { delay, callback, _removed: false };
                pendingCallbacks.push(entry);
                return entry;
            },
            addEvent: (config) => {
                const event = {
                    ...config,
                    _removed: false,
                    _callCount: 0,
                    remove: function() { this._removed = true; }
                };
                timerEvents.push(event);
                return event;
            }
        },
        tweens: {
            add: () => ({})
        },
        // Test helpers
        _pendingCallbacks: pendingCallbacks,
        _timerEvents: timerEvents,
        _flushDelayedCalls: function(targetDelay) {
            const matching = this._pendingCallbacks.filter(
                c => c.delay === targetDelay && !c._removed
            );
            matching.forEach(c => {
                c._removed = true;
                c.callback();
            });
        },
        _flushAllDelayedCalls: function() {
            const cbs = [...this._pendingCallbacks];
            this._pendingCallbacks.length = 0;
            cbs.forEach(c => { if (!c._removed) c.callback(); });
        },
        _tickTimerEvent: function(index = 0) {
            const event = this._timerEvents[index];
            if (event && !event._removed) {
                event._callCount++;
                event.callback();
            }
        }
    };

    return scene;
}

function createTestPlayer(overrides = {}) {
    const defaults = { x: 400, currentFloor: 0 };
    const merged = { ...defaults, ...overrides };
    const player = new Player('Test', 'Player', merged.x, 500, 'sprite1', merged.currentFloor);
    // Add a mock sprite ref
    player.spriteRef = {
        _visible: true,
        _depth: 20,
        setVisible: function(v) { this._visible = v; return this; },
        setDepth: function(d) { this._depth = d; return this; }
    };
    Object.assign(player, overrides);
    return player;
}

describe('ElevatorManager', () => {
    let scene, elevatorManager;

    beforeEach(() => {
        scene = createMockScene(4);
        elevatorManager = new ElevatorManager(scene);
    });

    describe('constructor', () => {
        test('initializes with correct number of elevator sprites', () => {
            expect(elevatorManager.elevatorSprites).toHaveLength(4);
        });

        test('starts on the scene current floor', () => {
            expect(elevatorManager.elevatorCurrentFloor).toBe(0);
        });

        test('starts unlocked with no active request', () => {
            expect(elevatorManager.isLocked).toBe(false);
            expect(elevatorManager.activeRequest).toBeNull();
        });

        test('initializes door states as all closed', () => {
            expect(elevatorManager.currentDoorState).toEqual(['closed', 'closed', 'closed', 'closed']);
        });

        test('creates elevator light sprite', () => {
            expect(elevatorManager.elevatorLight).toBeDefined();
        });
    });

    describe('requestElevator', () => {
        test('sets player targetFloor and creates active request', () => {
            const player = createTestPlayer();
            player.forceState(PlayerState.WAITING_FOR_ELEVATOR);

            elevatorManager.requestElevator(player, 2);

            expect(player.targetFloor).toBe(2);
            expect(elevatorManager.activeRequest).toEqual({
                player,
                targetFloor: 2
            });
        });

        test('does not overwrite existing active request', () => {
            const player1 = createTestPlayer();
            player1.forceState(PlayerState.WAITING_FOR_ELEVATOR);

            const player2 = createTestPlayer({ x: 350 });
            player2.forceState(PlayerState.WAITING_FOR_ELEVATOR);

            elevatorManager.requestElevator(player1, 2);
            elevatorManager.requestElevator(player2, 3);

            expect(elevatorManager.activeRequest.player).toBe(player1);
        });
    });

    describe('updateElevatorSprite', () => {
        test('transitions door through slightly opened state', () => {
            const sprite = elevatorManager.elevatorSprites[0];
            elevatorManager.updateElevatorSprite(0, true);

            // Should be in slightly opened state first
            expect(sprite._key).toBe('Elevator_slightlyOpened');
            expect(elevatorManager.currentDoorState[0]).toBe('slightly');

            // After transition delay, should be fully open
            scene._flushDelayedCalls(GameConfig.ELEVATOR_DOOR_TRANSITION_MS);
            expect(sprite._key).toBe('Elevator_opened');
            expect(elevatorManager.currentDoorState[0]).toBe('open');
        });

        test('transitions from open to closed through slightly opened', () => {
            // First open the door
            elevatorManager.updateElevatorSprite(0, true);
            scene._flushDelayedCalls(GameConfig.ELEVATOR_DOOR_TRANSITION_MS);
            expect(elevatorManager.currentDoorState[0]).toBe('open');

            // Now close it
            elevatorManager.updateElevatorSprite(0, false);
            expect(elevatorManager.elevatorSprites[0]._key).toBe('Elevator_slightlyOpened');

            scene._flushDelayedCalls(GameConfig.ELEVATOR_DOOR_TRANSITION_MS);
            expect(elevatorManager.elevatorSprites[0]._key).toBe('Elevator_closed');
            expect(elevatorManager.currentDoorState[0]).toBe('closed');
        });

        test('skips transition if already in desired state', () => {
            // Door starts closed
            elevatorManager.updateElevatorSprite(0, false);
            // Should not change anything
            expect(elevatorManager.currentDoorState[0]).toBe('closed');
        });

        test('handles invalid floor index gracefully', () => {
            // Should not throw
            elevatorManager.updateElevatorSprite(99, true);
        });
    });

    describe('moveToFloor', () => {
        test('moves elevator floor by floor', () => {
            let arrived = false;
            elevatorManager.moveToFloor(2, () => { arrived = true; });

            expect(elevatorManager.isLocked).toBe(true);

            // Tick through floor movements
            scene._tickTimerEvent(0); // floor 0 -> 1
            expect(elevatorManager.elevatorCurrentFloor).toBe(1);
            expect(arrived).toBe(false);

            scene._tickTimerEvent(0); // floor 1 -> 2
            expect(elevatorManager.elevatorCurrentFloor).toBe(2);
            expect(arrived).toBe(true);
        });

        test('moves downward correctly', () => {
            // Start on floor 2
            elevatorManager.elevatorCurrentFloor = 2;

            let arrived = false;
            elevatorManager.moveToFloor(0, () => { arrived = true; });

            scene._tickTimerEvent(0); // 2 -> 1
            expect(elevatorManager.elevatorCurrentFloor).toBe(1);

            scene._tickTimerEvent(0); // 1 -> 0
            expect(elevatorManager.elevatorCurrentFloor).toBe(0);
            expect(arrived).toBe(true);
        });
    });

    describe('sequentialBoarding', () => {
        test('boards player and transitions to IN_ELEVATOR state', () => {
            const player = createTestPlayer({ x: GameConfig.ELEVATOR_X_POSITION });
            player.forceState(PlayerState.WAITING_FOR_ELEVATOR);

            let complete = false;
            elevatorManager.sequentialBoarding([player], () => { complete = true; });

            // Tick the boarding poll - player is already at elevator x
            scene._tickTimerEvent(0);

            expect(player.is(PlayerState.IN_ELEVATOR)).toBe(true);
            expect(elevatorManager.boardedPlayers).toContain(player);
            expect(complete).toBe(true);
        });

        test('walks player toward elevator before boarding', () => {
            const player = createTestPlayer({ x: GameConfig.ELEVATOR_X_POSITION + 50 });
            player.forceState(PlayerState.WAITING_FOR_ELEVATOR);

            elevatorManager.sequentialBoarding([player], () => {});

            // First tick - not at elevator yet
            scene._tickTimerEvent(0);
            expect(player.vx).not.toBe(0); // should be moving

            // Move player to elevator position
            player.x = GameConfig.ELEVATOR_X_POSITION;
            scene._tickTimerEvent(0);
            expect(player.is(PlayerState.IN_ELEVATOR)).toBe(true);
        });

        test('handles empty player list', () => {
            let complete = false;
            elevatorManager.sequentialBoarding([], () => { complete = true; });
            expect(complete).toBe(true);
        });

        test('uses ELEVATOR_BOARDING_POLL_MS from GameConfig', () => {
            const player = createTestPlayer({ x: GameConfig.ELEVATOR_X_POSITION + 50 });
            player.forceState(PlayerState.WAITING_FOR_ELEVATOR);

            elevatorManager.sequentialBoarding([player], () => {});

            const timerEvent = scene._timerEvents[scene._timerEvents.length - 1];
            expect(timerEvent.delay).toBe(GameConfig.ELEVATOR_BOARDING_POLL_MS);
        });
    });

    describe('sequentialExiting', () => {
        test('exits player and transitions to IDLE state', () => {
            const player = createTestPlayer();
            player.forceState(PlayerState.IN_ELEVATOR);
            delete player.deferredTargetX; // Ensure no deferred target
            player.spriteRef = {
                _depth: 0,
                setDepth: function(d) { this._depth = d; return this; },
                setVisible: function() { return this; }
            };

            let complete = false;
            elevatorManager.sequentialExiting([player], 1, () => { complete = true; });

            // Tick exit timer
            scene._tickTimerEvent(0);

            expect(player.currentFloor).toBe(1);
            expect(player.targetFloor).toBeNull();
            expect(player.is(PlayerState.IDLE)).toBe(true);
            expect(player.spriteRef._depth).toBe(20); // returned to front layer
            expect(complete).toBe(true);
        });

        test('exits automated player to AUTOMATED_IDLE state', () => {
            const player = createTestPlayer();
            player.isAutomated = true;
            player.forceState(PlayerState.IN_ELEVATOR);
            delete player.deferredTargetX; // Ensure no deferred target
            player.spriteRef = {
                _depth: 0,
                setDepth: function(d) { this._depth = d; return this; },
                setVisible: function() { return this; }
            };

            elevatorManager.sequentialExiting([player], 2, () => {});
            scene._tickTimerEvent(0);

            expect(player.is(PlayerState.AUTOMATED_IDLE)).toBe(true);
            expect(player.idleTimer).toBe(0);
            expect(player.idleDuration).toBeGreaterThanOrEqual(GameConfig.NPC_IDLE_MIN);
        });

        test('exits player with deferred target to WALKING state', () => {
            const player = createTestPlayer();
            player.forceState(PlayerState.IN_ELEVATOR);
            player.deferredTargetX = 400;
            player.spriteRef = {
                _depth: 0,
                setDepth: function(d) { this._depth = d; return this; },
                setVisible: function() { return this; }
            };

            elevatorManager.sequentialExiting([player], 1, () => {});
            scene._tickTimerEvent(0);

            expect(player.is(PlayerState.WALKING)).toBe(true);
            expect(player.targetX).toBe(400);
            expect(player.deferredTargetX).toBeUndefined();
        });

        test('uses ELEVATOR_EXIT_DELAY_MS from GameConfig', () => {
            const player = createTestPlayer();
            player.forceState(PlayerState.IN_ELEVATOR);
            player.spriteRef = {
                _depth: 0,
                setDepth: function(d) { this._depth = d; return this; },
                setVisible: function() { return this; }
            };

            elevatorManager.sequentialExiting([player], 0, () => {});

            const timerEvent = scene._timerEvents[scene._timerEvents.length - 1];
            expect(timerEvent.delay).toBe(GameConfig.ELEVATOR_EXIT_DELAY_MS);
        });

        test('handles empty player list', () => {
            let complete = false;
            elevatorManager.sequentialExiting([], 0, () => { complete = true; });
            expect(complete).toBe(true);
        });
    });

    describe('processQueue', () => {
        test('does nothing when locked', () => {
            elevatorManager.isLocked = true;
            elevatorManager.activeRequest = { player: createTestPlayer(), targetFloor: 2 };
            elevatorManager.processQueue();
            // Should not attempt to move
            expect(scene._timerEvents).toHaveLength(0);
        });

        test('does nothing when no active request', () => {
            elevatorManager.processQueue();
            expect(scene._timerEvents).toHaveLength(0);
        });

        test('begins boarding directly when elevator is on the same floor', () => {
            const player = createTestPlayer({ currentFloor: 0 });
            player.forceState(PlayerState.WAITING_FOR_ELEVATOR);
            player.targetFloor = 2;

            scene.players = [{ player }];
            elevatorManager.activeRequest = { player, targetFloor: 2 };
            elevatorManager.elevatorCurrentFloor = 0;

            elevatorManager.processQueue();

            // Should have called beginBoarding (which opens doors since player is waiting)
            // The door open delay callback should be queued
            expect(scene._pendingCallbacks.length).toBeGreaterThan(0);
        });
    });

    describe('beginBoarding', () => {
        test('opens doors and processes boarders when player is waiting on current floor', () => {
            const player = createTestPlayer({ currentFloor: 0 });
            player.forceState(PlayerState.WAITING_FOR_ELEVATOR);
            player.targetFloor = 2;

            scene.players = [{ player }];
            elevatorManager.activeRequest = { player, targetFloor: 2 };
            elevatorManager.elevatorCurrentFloor = 0;

            elevatorManager.beginBoarding();

            // Door should be opening (slightly opened first)
            expect(elevatorManager.currentDoorState[0]).toBe('slightly');

            // After door open delay, boarding should begin
            const doorOpenCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_DOOR_OPEN_DELAY_MS
            );
            expect(doorOpenCb).toBeDefined();
        });

        test('continues immediately when no boarders or exiters', () => {
            const player = createTestPlayer({ currentFloor: 1 });
            player.forceState(PlayerState.WAITING_FOR_ELEVATOR);
            player.targetFloor = 2;

            scene.players = [{ player }]; // Player on floor 1, elevator on floor 0
            elevatorManager.activeRequest = { player, targetFloor: 2 };
            elevatorManager.elevatorCurrentFloor = 0;

            elevatorManager.beginBoarding();

            // Should schedule continueElevatorTravel via delayed call
            const travelCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_SPEED
            );
            expect(travelCb).toBeDefined();
        });

        test('exits boarded players at their target floor', () => {
            const boardedPlayer = createTestPlayer({ currentFloor: 0 });
            boardedPlayer.forceState(PlayerState.IN_ELEVATOR);
            boardedPlayer.targetFloor = 0; // wants to exit at floor 0
            delete boardedPlayer.deferredTargetX;
            boardedPlayer.spriteRef = {
                _visible: false,
                setVisible: function(v) { this._visible = v; return this; },
                setDepth: function() { return this; }
            };

            elevatorManager.boardedPlayers = [boardedPlayer];
            elevatorManager.elevatorCurrentFloor = 0;

            const requestingPlayer = createTestPlayer({ currentFloor: 2 });
            requestingPlayer.forceState(PlayerState.WAITING_FOR_ELEVATOR);
            requestingPlayer.targetFloor = 0;

            scene.players = [{ player: requestingPlayer }];
            elevatorManager.activeRequest = { player: requestingPlayer, targetFloor: 0 };

            elevatorManager.beginBoarding();

            // Trigger door open delay
            const doorOpenCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_DOOR_OPEN_DELAY_MS
            );
            doorOpenCb.callback();

            // Boarded player should have exited
            expect(boardedPlayer.currentFloor).toBe(0);
            expect(boardedPlayer.targetFloor).toBeNull();
            expect(boardedPlayer.spriteRef._visible).toBe(true);
            expect(boardedPlayer.is(PlayerState.IDLE)).toBe(true);
        });
    });

    describe('continueElevatorTravel', () => {
        test('unlocks and clears request when no steps remaining', () => {
            elevatorManager.isLocked = true;
            elevatorManager.activeRequest = { player: createTestPlayer(), targetFloor: 0 };
            elevatorManager.elevatorCurrentFloor = 0;
            scene.players = [];

            elevatorManager.continueElevatorTravel(0, 1);

            expect(elevatorManager.isLocked).toBe(false);
            expect(elevatorManager.activeRequest).toBeNull();
        });

        test('picks up remaining boarded passenger after reaching target', () => {
            const passenger = createTestPlayer({ currentFloor: 0 });
            passenger.forceState(PlayerState.IN_ELEVATOR);
            passenger.targetFloor = 3;

            elevatorManager.boardedPlayers = [passenger];
            elevatorManager.elevatorCurrentFloor = 2;
            elevatorManager.activeRequest = { player: passenger, targetFloor: 2 };
            scene.players = [];

            elevatorManager.continueElevatorTravel(2, 1);

            // Should create a new request for the remaining passenger
            expect(elevatorManager.activeRequest).not.toBeNull();
            expect(elevatorManager.activeRequest.targetFloor).toBe(3);
        });

        test('picks up next waiting player after reaching target', () => {
            const waitingPlayer = createTestPlayer({ currentFloor: 1 });
            waitingPlayer.forceState(PlayerState.WAITING_FOR_ELEVATOR);
            waitingPlayer.targetFloor = 3;

            elevatorManager.elevatorCurrentFloor = 0;
            elevatorManager.activeRequest = { player: createTestPlayer(), targetFloor: 0 };
            scene.players = [{ player: waitingPlayer }];

            elevatorManager.continueElevatorTravel(0, 1);

            expect(elevatorManager.activeRequest).not.toBeNull();
            expect(elevatorManager.activeRequest.player).toBe(waitingPlayer);
        });

        test('moves through floors without activity', () => {
            elevatorManager.elevatorCurrentFloor = 0;
            elevatorManager.activeRequest = { player: createTestPlayer(), targetFloor: 2 };
            scene.players = [];

            elevatorManager.continueElevatorTravel(2, 1);

            // First step: floor 0 -> 1
            expect(elevatorManager.elevatorCurrentFloor).toBe(1);

            // Should schedule next step
            const nextStepCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_SPEED
            );
            expect(nextStepCb).toBeDefined();

            // Execute next step: floor 1 -> 2
            nextStepCb.callback();
            expect(elevatorManager.elevatorCurrentFloor).toBe(2);
        });

        test('handles activity at intermediate floor during travel', () => {
            const exitingPlayer = createTestPlayer({ currentFloor: 0 });
            exitingPlayer.forceState(PlayerState.IN_ELEVATOR);
            exitingPlayer.targetFloor = 1;
            delete exitingPlayer.deferredTargetX;
            exitingPlayer.spriteRef = {
                setVisible: function() { return this; },
                setDepth: function() { return this; }
            };

            elevatorManager.boardedPlayers = [exitingPlayer];
            elevatorManager.elevatorCurrentFloor = 0;
            elevatorManager.activeRequest = { player: exitingPlayer, targetFloor: 2 };
            scene.players = [];

            elevatorManager.continueElevatorTravel(2, 1);

            // Floor 1 has an exiting player, so doors should open
            expect(elevatorManager.elevatorCurrentFloor).toBe(1);
            expect(elevatorManager.currentDoorState[1]).toBe('slightly'); // doors opening
        });
    });

    describe('elevatorLightFlicker', () => {
        test('creates a tween animation', () => {
            // Should not throw
            elevatorManager.elevatorLightFlicker(0);
            elevatorManager.elevatorLightFlicker(1);
        });
    });

    describe('processQueue - elevator on different floor', () => {
        test('moves elevator to player floor then begins boarding', () => {
            const player = createTestPlayer({ currentFloor: 2 });
            player.forceState(PlayerState.WAITING_FOR_ELEVATOR);
            player.targetFloor = 0;

            scene.players = [{ player }];
            elevatorManager.activeRequest = { player, targetFloor: 0 };
            elevatorManager.elevatorCurrentFloor = 0; // elevator on floor 0, player on floor 2

            elevatorManager.processQueue();

            // Should initiate moveToFloor
            expect(elevatorManager.isLocked).toBe(true);
            expect(scene._timerEvents.length).toBeGreaterThan(0);

            // Tick through both floors to reach player (covers line 76: beginBoarding callback)
            scene._tickTimerEvent(0); // floor 0 -> 1
            scene._tickTimerEvent(0); // floor 1 -> 2
            expect(elevatorManager.elevatorCurrentFloor).toBe(2);

            // beginBoarding should have been called - doors should be opening
            // since player is WAITING on floor 2
            expect(scene._pendingCallbacks.length).toBeGreaterThan(0);
        });
    });

    describe('moveToFloor - intermediate floor light flicker', () => {
        test('flickers light off on intermediate floors during 3+ floor travel', () => {
            elevatorManager.elevatorCurrentFloor = 0;
            let arrived = false;
            elevatorManager.moveToFloor(3, () => { arrived = true; });

            // Tick floor 0 -> 1 (intermediate, count=1 < steps=3)
            scene._tickTimerEvent(0);
            expect(elevatorManager.elevatorCurrentFloor).toBe(1);

            // Should have queued a light flicker callback (covers line 97-99)
            const flickerCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_LIGHT_FLICKER_MS
            );
            expect(flickerCb).toBeDefined();
            flickerCb.callback(); // covers line 98

            // Tick remaining floors
            scene._tickTimerEvent(0); // 1 -> 2
            scene._tickTimerEvent(0); // 2 -> 3
            expect(arrived).toBe(true);
        });
    });

    describe('beginBoarding - full flow with exiting and boarding', () => {
        test('exits player with deferredTargetX via beginBoarding door open callback', () => {
            const boardedPlayer = createTestPlayer({ currentFloor: 0 });
            boardedPlayer.forceState(PlayerState.IN_ELEVATOR);
            boardedPlayer.targetFloor = 0;
            boardedPlayer.deferredTargetX = 450;

            elevatorManager.boardedPlayers = [boardedPlayer];
            elevatorManager.elevatorCurrentFloor = 0;

            scene.players = [];
            elevatorManager.activeRequest = { player: boardedPlayer, targetFloor: 0 };

            elevatorManager.beginBoarding();

            // Trigger door open delay (covers lines 130-170)
            const doorOpenCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_DOOR_OPEN_DELAY_MS
            );
            doorOpenCb.callback();

            // Covers lines 139-141: deferredTargetX path
            expect(boardedPlayer.is(PlayerState.WALKING)).toBe(true);
            expect(boardedPlayer.targetX).toBe(450);
            expect(boardedPlayer.deferredTargetX).toBeUndefined();
        });

        test('exits automated player via beginBoarding door open callback', () => {
            const boardedPlayer = createTestPlayer({ currentFloor: 0 });
            boardedPlayer.isAutomated = true;
            boardedPlayer.forceState(PlayerState.IN_ELEVATOR);
            boardedPlayer.targetFloor = 0;
            delete boardedPlayer.deferredTargetX;

            elevatorManager.boardedPlayers = [boardedPlayer];
            elevatorManager.elevatorCurrentFloor = 0;

            scene.players = [];
            elevatorManager.activeRequest = { player: boardedPlayer, targetFloor: 0 };

            elevatorManager.beginBoarding();

            const doorOpenCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_DOOR_OPEN_DELAY_MS
            );
            doorOpenCb.callback();

            // Covers lines 144-146: automated player exit path
            expect(boardedPlayer.is(PlayerState.AUTOMATED_IDLE)).toBe(true);
            expect(boardedPlayer.idleTimer).toBe(0);
            expect(boardedPlayer.idleDuration).toBeGreaterThanOrEqual(GameConfig.NPC_IDLE_MIN);
        });

        test('boards new players and completes full post-boarding chain', () => {
            const waitingPlayer = createTestPlayer({ currentFloor: 0, x: GameConfig.ELEVATOR_X_POSITION });
            waitingPlayer.forceState(PlayerState.WAITING_FOR_ELEVATOR);
            waitingPlayer.targetFloor = 2;

            scene.players = [{ player: waitingPlayer }];
            elevatorManager.activeRequest = { player: waitingPlayer, targetFloor: 2 };
            elevatorManager.elevatorCurrentFloor = 0;

            elevatorManager.beginBoarding();

            // Trigger door open delay
            const doorOpenCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_DOOR_OPEN_DELAY_MS
            );
            doorOpenCb.callback();

            // Covers line 160: .map for newBoarders
            // sequentialBoarding will be called - tick it to board player
            const lastTimerIdx = scene._timerEvents.length - 1;
            scene._tickTimerEvent(lastTimerIdx); // Player at elevator X, boards immediately

            expect(waitingPlayer.is(PlayerState.IN_ELEVATOR)).toBe(true);

            // Now the post-boarding callback chain fires (covers lines 162-170)
            // The onComplete from sequentialBoarding queues ELEVATOR_LIGHT_FLICKER_MS
            const flickerCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_LIGHT_FLICKER_MS
            );
            expect(flickerCb).toBeDefined();
            flickerCb.callback(); // covers lines 164-165

            // Should have queued ELEVATOR_SPEED for continueElevatorTravel (line 166)
            const travelCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_SPEED && !c._removed
            );
            expect(travelCb).toBeDefined();
            travelCb.callback(); // covers line 167: continueElevatorTravel call

            // Should have moved to next floor
            expect(elevatorManager.elevatorCurrentFloor).toBe(1);
        });

        test('no-activity branch calls continueElevatorTravel via ELEVATOR_SPEED delay', () => {
            scene.players = [];
            elevatorManager.activeRequest = { player: createTestPlayer(), targetFloor: 2 };
            elevatorManager.elevatorCurrentFloor = 0;

            elevatorManager.beginBoarding();

            // Covers line 174-177: no boarders/exiters path
            const travelCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_SPEED
            );
            expect(travelCb).toBeDefined();
            travelCb.callback(); // covers line 176: continueElevatorTravel call

            // continueElevatorTravel(2, 1) should move floor 0 -> 1
            expect(elevatorManager.elevatorCurrentFloor).toBe(1);
        });
    });

    describe('continueElevatorTravel - intermediate floor with flicker', () => {
        test('flickers light off at non-target intermediate floors', () => {
            elevatorManager.elevatorCurrentFloor = 0;
            elevatorManager.activeRequest = { player: createTestPlayer(), targetFloor: 3 };
            scene.players = [];

            elevatorManager.continueElevatorTravel(3, 1);

            // Step to floor 1 (not target 3) - should queue flicker
            expect(elevatorManager.elevatorCurrentFloor).toBe(1);
            const flickerCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_LIGHT_FLICKER_MS
            );
            expect(flickerCb).toBeDefined();
            flickerCb.callback(); // covers line 289
        });
    });

    describe('continueElevatorTravel - activity with boarding at intermediate floor', () => {
        test('processes exiting and new boarders at intermediate floor with full callback chain', () => {
            // Set up: exiting player at floor 1, new boarder waiting at floor 1
            const exitingPlayer = createTestPlayer({ currentFloor: 0 });
            exitingPlayer.forceState(PlayerState.IN_ELEVATOR);
            exitingPlayer.targetFloor = 1;
            delete exitingPlayer.deferredTargetX;
            exitingPlayer.spriteRef = {
                setVisible: function() { return this; },
                setDepth: function() { return this; }
            };

            const newBoarder = createTestPlayer({ currentFloor: 1, x: GameConfig.ELEVATOR_X_POSITION });
            newBoarder.forceState(PlayerState.WAITING_FOR_ELEVATOR);
            newBoarder.targetFloor = 2;

            elevatorManager.boardedPlayers = [exitingPlayer];
            elevatorManager.elevatorCurrentFloor = 0;
            elevatorManager.activeRequest = { player: exitingPlayer, targetFloor: 2 };
            scene.players = [{ player: newBoarder }];

            elevatorManager.continueElevatorTravel(2, 1);

            // Floor 1 has activity (exiting + boarding)
            expect(elevatorManager.elevatorCurrentFloor).toBe(1);

            // Covers lines 303-307: newBoarders filter/map
            // Covers line 311-326: activity branch with nested callbacks

            // Trigger exit delay callback (ELEVATOR_EXIT_DELAY_MS / 2)
            const exitDelayCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_EXIT_DELAY_MS / 2
            );
            expect(exitDelayCb).toBeDefined();
            exitDelayCb.callback(); // covers line 314-315: sequentialExiting call

            // Tick the exit timer event
            const lastTimerIdx = scene._timerEvents.length - 1;
            scene._tickTimerEvent(lastTimerIdx);

            // Exiting player should be out
            expect(exitingPlayer.is(PlayerState.IDLE)).toBe(true);

            // Now trigger the boarding delay (ELEVATOR_EXIT_DELAY_MS * 1.5)
            const boardDelayCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_EXIT_DELAY_MS * 1.5
            );
            expect(boardDelayCb).toBeDefined();
            boardDelayCb.callback(); // covers line 316-317

            // Tick boarding timer - newBoarder is already at elevator X
            const boardTimerIdx = scene._timerEvents.length - 1;
            scene._tickTimerEvent(boardTimerIdx);

            expect(newBoarder.is(PlayerState.IN_ELEVATOR)).toBe(true);

            // Trigger door close delay (ELEVATOR_DOOR_OPEN_DELAY_MS)
            const doorCloseCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_DOOR_OPEN_DELAY_MS
            );
            expect(doorCloseCb).toBeDefined();
            doorCloseCb.callback(); // covers lines 318-321

            // Should have queued next step (ELEVATOR_SPEED/2)
            const nextStepCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.ELEVATOR_SPEED / 2
            );
            expect(nextStepCb).toBeDefined();
        });
    });
});
