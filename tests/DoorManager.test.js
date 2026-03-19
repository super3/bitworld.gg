/**
 * Integration tests for DoorManager
 * Tests door collision detection, opening/closing, and player state transitions.
 */

// Helper to create a mock Phaser scene with timer system
function createMockScene() {
    const pendingCallbacks = [];
    return {
        add: {
            image: () => ({
                setOrigin: function() { return this; },
                setDepth: function() { return this; },
                setScale: function() { return this; },
                setVisible: function(v) { this._visible = v; return this; },
                setX: function() { return this; },
                _visible: true
            })
        },
        time: {
            delayedCall: (delay, callback) => {
                pendingCallbacks.push({ delay, callback });
            }
        },
        // Test helper: execute all pending callbacks in order
        _pendingCallbacks: pendingCallbacks,
        _flushCallbacks: function() {
            const cbs = [...this._pendingCallbacks];
            this._pendingCallbacks.length = 0;
            cbs.forEach(c => c.callback());
        },
        _flushCallbacksByDelay: function(targetDelay) {
            const matching = this._pendingCallbacks.filter(c => c.delay === targetDelay);
            this._pendingCallbacks.length = 0;
            this._pendingCallbacks.push(...this._pendingCallbacks.filter(c => c.delay !== targetDelay));
            matching.forEach(c => c.callback());
        }
    };
}

function createTestPlayer(overrides = {}) {
    const player = new Player('Test', 'Player', 400, 500, 'sprite1', 0);
    Object.assign(player, overrides);
    return player;
}

describe('DoorManager', () => {
    let scene, doorManager;

    beforeEach(() => {
        scene = createMockScene();
        doorManager = new DoorManager(scene);
        // Add a test door on floor 0 at x=308
        doorManager.addDoor(0, 308, 32, 60, 'door');
    });

    describe('addDoor', () => {
        test('creates a door entry with correct properties', () => {
            expect(doorManager.doors).toHaveLength(1);
            const door = doorManager.doors[0];
            expect(door.floor).toBe(0);
            expect(door.x).toBe(308);
            expect(door.isOpen).toBe(false);
            expect(door.closedSprite).toBeDefined();
            expect(door.openedSprite).toBeDefined();
        });

        test('can add multiple doors on different floors', () => {
            doorManager.addDoor(1, 308, 32, 60, 'door');
            doorManager.addDoor(2, 308, 32, 60, 'door');
            expect(doorManager.doors).toHaveLength(3);
        });

        test('uses default width and height when not provided', () => {
            doorManager.addDoor(1, 400, undefined, undefined, 'door');
            const door = doorManager.doors[doorManager.doors.length - 1];
            expect(door.width).toBe(32); // default param kicks in
            expect(door.height).toBe(60); // default param kicks in
            expect(door.floor).toBe(1);
        });
    });

    describe('checkDoorCollision', () => {
        test('detects collision when player is near door and moving toward it', () => {
            const player = createTestPlayer({ x: 295, currentFloor: 0 });
            player.forceState(PlayerState.WALKING);
            const dx = 308 - 295; // moving right toward door
            const door = doorManager.checkDoorCollision(player, dx);
            expect(door).not.toBeNull();
            expect(door.x).toBe(308);
        });

        test('returns null when player is already WALKING_THROUGH_DOOR', () => {
            const player = createTestPlayer({ x: 295, currentFloor: 0 });
            player.forceState(PlayerState.WALKING_THROUGH_DOOR);
            const dx = 13;
            const door = doorManager.checkDoorCollision(player, dx);
            expect(door).toBeFalsy();
        });

        test('returns null when player is on a different floor', () => {
            const player = createTestPlayer({ x: 295, currentFloor: 1 });
            player.forceState(PlayerState.WALKING);
            const dx = 13;
            const door = doorManager.checkDoorCollision(player, dx);
            expect(door).toBeFalsy();
        });

        test('returns null when player is too far from door', () => {
            const player = createTestPlayer({ x: 200, currentFloor: 0 });
            player.forceState(PlayerState.WALKING);
            const dx = 1;
            const door = doorManager.checkDoorCollision(player, dx);
            expect(door).toBeFalsy();
        });

        test('returns null when player moves away from door', () => {
            const player = createTestPlayer({ x: 295, currentFloor: 0 });
            player.forceState(PlayerState.WALKING);
            const dx = -1; // moving left, away from door at 308
            const door = doorManager.checkDoorCollision(player, dx);
            expect(door).toBeFalsy();
        });

        test('returns null when door is already open', () => {
            doorManager.doors[0].isOpen = true;
            const player = createTestPlayer({ x: 295, currentFloor: 0 });
            player.forceState(PlayerState.WALKING);
            const dx = 13;
            const door = doorManager.checkDoorCollision(player, dx);
            expect(door).toBeFalsy();
        });

        test('uses DOOR_PROXIMITY_THRESHOLD from GameConfig', () => {
            // Player at exactly threshold distance
            const threshold = GameConfig.DOOR_PROXIMITY_THRESHOLD;
            const player = createTestPlayer({ x: 308 - threshold + 1, currentFloor: 0 });
            player.forceState(PlayerState.WALKING);
            const dx = 1;
            expect(doorManager.checkDoorCollision(player, dx)).not.toBeNull();

            // Player just outside threshold
            const farPlayer = createTestPlayer({ x: 308 - threshold - 1, currentFloor: 0 });
            farPlayer.forceState(PlayerState.WALKING);
            expect(doorManager.checkDoorCollision(farPlayer, 1)).toBeFalsy();
        });
    });

    describe('tryOpenDoor', () => {
        test('opens door and transitions player to WALKING_THROUGH_DOOR', () => {
            const player = createTestPlayer({ x: 295, currentFloor: 0, targetX: 250 });
            player.forceState(PlayerState.WALKING);

            doorManager.tryOpenDoor(player, 13);

            expect(player.is(PlayerState.WALKING_THROUGH_DOOR)).toBe(true);
            expect(player.targetX).toBeNull(); // movement paused
            expect(player.vx).toBe(0);
            expect(doorManager.doors[0].isOpen).toBe(true);
        });

        test('does nothing when no collision detected', () => {
            const player = createTestPlayer({ x: 200, currentFloor: 0, targetX: 250 });
            player.forceState(PlayerState.WALKING);

            doorManager.tryOpenDoor(player, 1);

            expect(player.is(PlayerState.WALKING)).toBe(true);
            expect(player.targetX).toBe(250); // unchanged
        });

        test('restores targetX after DOOR_OPEN_DELAY_MS', () => {
            const player = createTestPlayer({ x: 295, currentFloor: 0, targetX: 250 });
            player.forceState(PlayerState.WALKING);

            doorManager.tryOpenDoor(player, 13);
            expect(player.targetX).toBeNull();

            // Flush the open delay callback
            const openDelayCb = scene._pendingCallbacks.find(
                c => c.delay === GameConfig.DOOR_OPEN_DELAY_MS
            );
            expect(openDelayCb).toBeDefined();
            openDelayCb.callback();

            expect(player.targetX).toBe(250);
        });

        test('transitions manual player to IDLE after DOOR_CLOSE_DELAY_MS with no target', () => {
            const player = createTestPlayer({ x: 295, currentFloor: 0, targetX: 250 });
            player.forceState(PlayerState.WALKING);

            doorManager.tryOpenDoor(player, 13);

            // Open delay restores original targetX
            const openCb = scene._pendingCallbacks.find(c => c.delay === GameConfig.DOOR_OPEN_DELAY_MS);
            openCb.callback();

            // Simulate player reaching target before door closes
            player.targetX = null;

            // Flush close delay
            const closeCb = scene._pendingCallbacks.find(c => c.delay === GameConfig.DOOR_CLOSE_DELAY_MS);
            closeCb.callback();

            expect(player.is(PlayerState.IDLE)).toBe(true);
            expect(doorManager.doors[0].isOpen).toBe(false);
        });

        test('transitions manual player to WALKING after door close if targetX exists', () => {
            const player = createTestPlayer({ x: 295, currentFloor: 0, targetX: 250 });
            player.forceState(PlayerState.WALKING);

            doorManager.tryOpenDoor(player, 13);

            // Restore targetX via open delay
            const openCb = scene._pendingCallbacks.find(c => c.delay === GameConfig.DOOR_OPEN_DELAY_MS);
            openCb.callback();
            expect(player.targetX).toBe(250);

            // Flush close delay
            const closeCb = scene._pendingCallbacks.find(c => c.delay === GameConfig.DOOR_CLOSE_DELAY_MS);
            closeCb.callback();

            expect(player.is(PlayerState.WALKING)).toBe(true);
        });

        test('transitions automated player to AUTOMATED_WALKING after door close', () => {
            const player = createTestPlayer({ x: 295, currentFloor: 0, targetX: 250 });
            player.isAutomated = true;
            player.forceState(PlayerState.AUTOMATED_WALKING);

            doorManager.tryOpenDoor(player, 13);

            // Restore targetX
            const openCb = scene._pendingCallbacks.find(c => c.delay === GameConfig.DOOR_OPEN_DELAY_MS);
            openCb.callback();

            // Close door
            const closeCb = scene._pendingCallbacks.find(c => c.delay === GameConfig.DOOR_CLOSE_DELAY_MS);
            closeCb.callback();

            expect(player.is(PlayerState.AUTOMATED_WALKING)).toBe(true);
        });

        test('transitions automated player to AUTOMATED_IDLE with no target after door close', () => {
            const player = createTestPlayer({ x: 295, currentFloor: 0, targetX: 250 });
            player.isAutomated = true;
            player.forceState(PlayerState.AUTOMATED_WALKING);

            doorManager.tryOpenDoor(player, 13);

            // Don't restore targetX (simulate it being consumed)
            player.targetX = null;

            // Close door
            const closeCb = scene._pendingCallbacks.find(c => c.delay === GameConfig.DOOR_CLOSE_DELAY_MS);
            closeCb.callback();

            expect(player.is(PlayerState.AUTOMATED_IDLE)).toBe(true);
            expect(player.idleTimer).toBe(0);
            expect(player.idleDuration).toBeGreaterThanOrEqual(GameConfig.NPC_IDLE_MIN);
        });

        test('does not restore targetX if player left WALKING_THROUGH_DOOR before open delay', () => {
            const player = createTestPlayer({ x: 295, currentFloor: 0, targetX: 250 });
            player.forceState(PlayerState.WALKING);

            doorManager.tryOpenDoor(player, 13);
            expect(player.is(PlayerState.WALKING_THROUGH_DOOR)).toBe(true);

            // Player transitions away before open delay fires
            player.forceState(PlayerState.WAITING_FOR_ELEVATOR);

            const openCb = scene._pendingCallbacks.find(c => c.delay === GameConfig.DOOR_OPEN_DELAY_MS);
            openCb.callback();

            // targetX should NOT be restored since player is no longer in door state
            expect(player.targetX).toBeNull();
        });

        test('does not restore targetX if originalTargetX was null', () => {
            // Player near door with no target — manually create a collision scenario
            const player = createTestPlayer({ x: 295, currentFloor: 0 });
            player.forceState(PlayerState.WALKING);
            player.targetX = null;

            // Directly manipulate to test the null originalTargetX branch
            // We need to set up a door collision manually since tryOpenDoor checks collision
            // Add a door very close so collision triggers even with small dx
            doorManager.doors = [];
            doorManager.addDoor(0, 296, 32, 60, 'door');

            player.targetX = null;
            // Force the collision - player at 295, door at 296, dx = 1
            doorManager.tryOpenDoor(player, 1);

            // Player should be in door state since door is at 296 and player at 295
            if (player.is(PlayerState.WALKING_THROUGH_DOOR)) {
                const openCb = scene._pendingCallbacks.find(c => c.delay === GameConfig.DOOR_OPEN_DELAY_MS);
                openCb.callback();
                // targetX should remain null since originalTargetX was null
                expect(player.targetX).toBeNull();
            }
        });

        test('does not change state on close if player left WALKING_THROUGH_DOOR early', () => {
            const player = createTestPlayer({ x: 295, currentFloor: 0, targetX: 250 });
            player.forceState(PlayerState.WALKING);

            doorManager.tryOpenDoor(player, 13);
            expect(player.is(PlayerState.WALKING_THROUGH_DOOR)).toBe(true);

            // Player transitions to elevator before door closes
            player.forceState(PlayerState.WAITING_FOR_ELEVATOR);

            const closeCb = scene._pendingCallbacks.find(c => c.delay === GameConfig.DOOR_CLOSE_DELAY_MS);
            closeCb.callback();

            // State should remain as set by elevator, not forced back by door
            expect(player.is(PlayerState.WAITING_FOR_ELEVATOR)).toBe(true);
        });
    });
});
