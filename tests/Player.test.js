describe('GameConfig', () => {
    describe('static helper methods', () => {
        it('should calculate scaled floor height', () => {
            const expected = GameConfig.BUILDING_HEIGHT * GameConfig.BUILDING_SCALE;
            expect(GameConfig.getScaledFloorHeight()).toBe(expected);
        });

        it('should calculate building floor Y position', () => {
            const sh = GameConfig.getScaledFloorHeight();
            const y = GameConfig.getBuildingFloorY(0);
            const expected = GameConfig.WINDOW_HEIGHT - GameConfig.GROUND_HEIGHT - sh * 1 + sh / 2;
            expect(y).toBe(expected);
        });

        it('should calculate different Y for higher floors', () => {
            const y0 = GameConfig.getBuildingFloorY(0);
            const y1 = GameConfig.getBuildingFloorY(1);
            expect(y1).toBeLessThan(y0); // Higher floors have lower Y
        });

        it('should calculate player floor Y position', () => {
            const y = GameConfig.getPlayerFloorY(0);
            const sh = GameConfig.getScaledFloorHeight();
            const expected = GameConfig.WINDOW_HEIGHT - GameConfig.GROUND_HEIGHT -
                (GameConfig.SPRITE_HEIGHT + 3) - sh * 0 + sh / 2;
            expect(y).toBe(expected);
        });

        it('should calculate player Y for higher floors', () => {
            const y0 = GameConfig.getPlayerFloorY(0);
            const y2 = GameConfig.getPlayerFloorY(2);
            expect(y2).toBeLessThan(y0);
        });

        it('should calculate elevator Y position', () => {
            const y = GameConfig.getElevatorY(0);
            const expected = GameConfig.getPlayerFloorY(0) -
                GameConfig.GROUND_HEIGHT - GameConfig.SPRITE_HEIGHT + 28;
            expect(y).toBe(expected);
        });

        it('should calculate elevator Y for higher floors', () => {
            const y0 = GameConfig.getElevatorY(0);
            const y1 = GameConfig.getElevatorY(1);
            expect(y1).toBeLessThan(y0);
        });
    });
});

describe('Player', () => {
    let player;

    beforeEach(() => {
        player = new Player('John', 'Sim', 400, 500, 'npc1', 0);
    });

    describe('constructor', () => {
        it('should initialize name and position', () => {
            expect(player.firstName).toBe('John');
            expect(player.lastName).toBe('Sim');
            expect(player.x).toBe(400);
            expect(player.y).toBe(500);
        });

        it('should initialize sprite and floor', () => {
            expect(player.spriteKey).toBe('npc1');
            expect(player.currentFloor).toBe(0);
        });

        it('should default to floor 0 when not specified', () => {
            const p = new Player('A', 'B', 0, 0, 'npc1');
            expect(p.currentFloor).toBe(0);
        });

        it('should initialize speed from GameConfig', () => {
            expect(player.speed).toBe(GameConfig.CHAR_SPEED);
        });

        it('should initialize all status attributes to 100', () => {
            expect(player.thirst).toBe(100);
            expect(player.hunger).toBe(100);
            expect(player.sleep).toBe(100);
            expect(player.toilet).toBe(100);
        });

        it('should initialize movement state as idle', () => {
            expect(player.vx).toBe(0);
            expect(player.targetX).toBeNull();
            expect(player.facingRight).toBe(true);
        });

        it('should initialize elevator state as inactive', () => {
            expect(player.targetFloor).toBeNull();
            expect(player.deferredTargetX).toBeNull();
        });

        it('should initialize state machine in IDLE state', () => {
            expect(player.state).toBe(PlayerState.IDLE);
        });

        it('should initialize isAutomated to false', () => {
            expect(player.isAutomated).toBe(false);
        });
    });

    describe('moveTowardTarget', () => {
        it('should move right toward a target to the right', () => {
            player.targetX = 500;
            player.moveTowardTarget(0.1);

            expect(player.vx).toBeGreaterThan(0);
            expect(player.x).toBeGreaterThan(400);
            expect(player.facingRight).toBe(true);
        });

        it('should move left toward a target to the left', () => {
            player.targetX = 300;
            player.moveTowardTarget(0.1);

            expect(player.vx).toBeLessThan(0);
            expect(player.x).toBeLessThan(400);
            expect(player.facingRight).toBe(false);
        });

        it('should return true and stop when within 2px of target', () => {
            player.targetX = 401; // 1px away
            const reached = player.moveTowardTarget(0.001);

            expect(reached).toBe(true);
            expect(player.x).toBe(401);
            expect(player.vx).toBe(0);
            expect(player.targetX).toBeNull();
        });

        it('should return false when targetX is null', () => {
            player.targetX = null;
            const reached = player.moveTowardTarget(0.1);

            expect(reached).toBe(false);
            expect(player.x).toBe(400);
            expect(player.vx).toBe(0);
        });

        it('should return false when still moving', () => {
            player.targetX = 600;
            const reached = player.moveTowardTarget(0.5);

            expect(reached).toBe(false);
            expect(player.x).toBeCloseTo(450, 0);
        });

        it('should update position based on speed and delta time', () => {
            player.targetX = 600;
            const dt = 0.5;
            player.moveTowardTarget(dt);

            // speed = 100, dt = 0.5, so should move 50px
            expect(player.x).toBeCloseTo(450, 0);
        });
    });

    describe('stop', () => {
        it('should reset velocity and target', () => {
            player.vx = 100;
            player.targetX = 500;

            player.stop();

            expect(player.vx).toBe(0);
            expect(player.targetX).toBeNull();
        });

        it('should not change state machine state', () => {
            player.setState(PlayerState.WALKING);
            player.stop();

            // stop() is physics-only, does not manage state
            expect(player.state).toBe(PlayerState.WALKING);
        });
    });

    describe('updateStatus', () => {
        it('should degrade thirst at 0.5 per second', () => {
            player.updateStatus(1);
            expect(player.thirst).toBeCloseTo(99.5);
        });

        it('should degrade hunger at 0.3 per second', () => {
            player.updateStatus(1);
            expect(player.hunger).toBeCloseTo(99.7);
        });

        it('should degrade sleep at 0.2 per second', () => {
            player.updateStatus(1);
            expect(player.sleep).toBeCloseTo(99.8);
        });

        it('should degrade toilet at 0.4 per second', () => {
            player.updateStatus(1);
            expect(player.toilet).toBeCloseTo(99.6);
        });

        it('should scale degradation with delta time', () => {
            player.updateStatus(10);

            expect(player.thirst).toBeCloseTo(95);
            expect(player.hunger).toBeCloseTo(97);
            expect(player.sleep).toBeCloseTo(98);
            expect(player.toilet).toBeCloseTo(96);
        });

        it('should clamp all values at 0', () => {
            player.thirst = 0.1;
            player.hunger = 0.1;
            player.sleep = 0.1;
            player.toilet = 0.1;

            player.updateStatus(10);

            expect(player.thirst).toBe(0);
            expect(player.hunger).toBe(0);
            expect(player.sleep).toBe(0);
            expect(player.toilet).toBe(0);
        });

        it('should not go below 0', () => {
            player.updateStatus(1000);

            expect(player.thirst).toBe(0);
            expect(player.hunger).toBe(0);
            expect(player.sleep).toBe(0);
            expect(player.toilet).toBe(0);
        });
    });

    describe('state machine integration', () => {
        it('should expose state convenience methods', () => {
            expect(player.state).toBe(PlayerState.IDLE);
            expect(player.is(PlayerState.IDLE)).toBe(true);
            expect(player.isAnyOf(PlayerState.IDLE, PlayerState.WALKING)).toBe(true);
            expect(player.isAnyOf(PlayerState.WALKING, PlayerState.IN_ELEVATOR)).toBe(false);
        });

        it('should allow valid transitions via setState', () => {
            const result = player.setState(PlayerState.WALKING);
            expect(result).toBe(true);
            expect(player.state).toBe(PlayerState.WALKING);
        });

        it('should reject invalid transitions via setState', () => {
            // IDLE → IN_ELEVATOR is not a valid transition
            const result = player.setState(PlayerState.IN_ELEVATOR);
            expect(result).toBe(false);
            expect(player.state).toBe(PlayerState.IDLE);
        });

        it('should allow forceState to bypass validation', () => {
            player.forceState(PlayerState.IN_ELEVATOR);
            expect(player.state).toBe(PlayerState.IN_ELEVATOR);
        });
    });
});

describe('PlayerStateMachine', () => {
    let sm;

    beforeEach(() => {
        sm = new PlayerStateMachine(PlayerState.IDLE);
    });

    describe('constructor', () => {
        it('should start in the given initial state', () => {
            expect(sm.state).toBe(PlayerState.IDLE);
        });

        it('should default to IDLE when no argument provided', () => {
            const defaultSm = new PlayerStateMachine();
            expect(defaultSm.state).toBe(PlayerState.IDLE);
        });

        it('should accept a custom initial state', () => {
            const customSm = new PlayerStateMachine(PlayerState.WALKING);
            expect(customSm.state).toBe(PlayerState.WALKING);
        });

        it('should have null previousState initially', () => {
            expect(sm.previousState).toBeNull();
        });
    });

    describe('setState', () => {
        it('should transition between valid states', () => {
            expect(sm.setState(PlayerState.WALKING)).toBe(true);
            expect(sm.state).toBe(PlayerState.WALKING);
        });

        it('should track previous state', () => {
            sm.setState(PlayerState.WALKING);
            expect(sm.previousState).toBe(PlayerState.IDLE);
        });

        it('should reject invalid transitions', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation();
            expect(sm.setState(PlayerState.IN_ELEVATOR)).toBe(false);
            expect(sm.state).toBe(PlayerState.IDLE);
            warn.mockRestore();
        });

        it('should return true for same-state transitions (no-op)', () => {
            expect(sm.setState(PlayerState.IDLE)).toBe(true);
            expect(sm.state).toBe(PlayerState.IDLE);
        });
    });

    describe('forceState', () => {
        it('should bypass validation', () => {
            sm.forceState(PlayerState.IN_ELEVATOR);
            expect(sm.state).toBe(PlayerState.IN_ELEVATOR);
            expect(sm.previousState).toBe(PlayerState.IDLE);
        });
    });

    describe('is / isAnyOf', () => {
        it('should check current state', () => {
            expect(sm.is(PlayerState.IDLE)).toBe(true);
            expect(sm.is(PlayerState.WALKING)).toBe(false);
        });

        it('should check against multiple states', () => {
            expect(sm.isAnyOf(PlayerState.IDLE, PlayerState.WALKING)).toBe(true);
            expect(sm.isAnyOf(PlayerState.WALKING, PlayerState.IN_ELEVATOR)).toBe(false);
        });
    });

    describe('full transition chains', () => {
        it('should support IDLE → WALKING → IDLE', () => {
            expect(sm.setState(PlayerState.WALKING)).toBe(true);
            expect(sm.setState(PlayerState.IDLE)).toBe(true);
            expect(sm.state).toBe(PlayerState.IDLE);
        });

        it('should support automated cycle: IDLE → AUTO_IDLE → AUTO_WALKING → AUTO_IDLE', () => {
            sm.setState(PlayerState.AUTOMATED_IDLE);
            expect(sm.state).toBe(PlayerState.AUTOMATED_IDLE);

            sm.setState(PlayerState.AUTOMATED_WALKING);
            expect(sm.state).toBe(PlayerState.AUTOMATED_WALKING);

            sm.setState(PlayerState.AUTOMATED_IDLE);
            expect(sm.state).toBe(PlayerState.AUTOMATED_IDLE);
        });

        it('should support elevator flow: IDLE → WALKING → WALK_TO_ELEV → WAITING → IN_ELEV → IDLE', () => {
            sm.setState(PlayerState.WALKING);
            sm.setState(PlayerState.WALKING_TO_ELEVATOR);
            sm.setState(PlayerState.WAITING_FOR_ELEVATOR);
            sm.setState(PlayerState.IN_ELEVATOR);
            sm.setState(PlayerState.IDLE);
            expect(sm.state).toBe(PlayerState.IDLE);
        });

        it('should support door flow: WALKING → DOOR → WALKING', () => {
            sm.setState(PlayerState.WALKING);
            sm.setState(PlayerState.WALKING_THROUGH_DOOR);
            sm.setState(PlayerState.WALKING);
            expect(sm.state).toBe(PlayerState.WALKING);
        });

        it('should support automated door flow: AUTO_WALKING → DOOR → AUTO_WALKING', () => {
            sm.setState(PlayerState.AUTOMATED_IDLE);
            sm.setState(PlayerState.AUTOMATED_WALKING);
            sm.setState(PlayerState.WALKING_THROUGH_DOOR);
            sm.setState(PlayerState.AUTOMATED_WALKING);
            expect(sm.state).toBe(PlayerState.AUTOMATED_WALKING);
        });

        it('should support door-to-elevator flow: DOOR → WAITING_FOR_ELEVATOR', () => {
            // Player walks through door on the way to elevator, reaches elevator
            // zone while door cooldown (1000ms) is still active
            sm.setState(PlayerState.WALKING);
            sm.setState(PlayerState.WALKING_THROUGH_DOOR);
            expect(sm.setState(PlayerState.WAITING_FOR_ELEVATOR)).toBe(true);
            expect(sm.state).toBe(PlayerState.WAITING_FOR_ELEVATOR);
        });

        it('should support door-to-elevator-click flow: DOOR → WALKING_TO_ELEVATOR', () => {
            sm.setState(PlayerState.WALKING);
            sm.setState(PlayerState.WALKING_THROUGH_DOOR);
            expect(sm.setState(PlayerState.WALKING_TO_ELEVATOR)).toBe(true);
            expect(sm.state).toBe(PlayerState.WALKING_TO_ELEVATOR);
        });
    });
});
