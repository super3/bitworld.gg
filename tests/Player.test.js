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
            expect(player.isWalking).toBe(false);
            expect(player.vx).toBe(0);
            expect(player.targetX).toBeNull();
            expect(player.facingRight).toBe(true);
        });

        it('should initialize elevator state as inactive', () => {
            expect(player.waitingForElevator).toBe(false);
            expect(player.inElevator).toBe(false);
            expect(player.targetFloor).toBeNull();
            expect(player.walkingThroughDoor).toBe(false);
        });
    });

    describe('moveTowardTarget', () => {
        it('should move right toward a target to the right', () => {
            player.targetX = 500;
            player.moveTowardTarget(0.1);

            expect(player.vx).toBeGreaterThan(0);
            expect(player.x).toBeGreaterThan(400);
            expect(player.facingRight).toBe(true);
            expect(player.isWalking).toBe(true);
        });

        it('should move left toward a target to the left', () => {
            player.targetX = 300;
            player.moveTowardTarget(0.1);

            expect(player.vx).toBeLessThan(0);
            expect(player.x).toBeLessThan(400);
            expect(player.facingRight).toBe(false);
            expect(player.isWalking).toBe(true);
        });

        it('should stop when within 2px of target', () => {
            player.targetX = 401; // 1px away
            player.moveTowardTarget(0.001);

            expect(player.x).toBe(401);
            expect(player.vx).toBe(0);
            expect(player.targetX).toBeNull();
            expect(player.isWalking).toBe(false);
        });

        it('should not move when targetX is null', () => {
            player.targetX = null;
            player.moveTowardTarget(0.1);

            expect(player.x).toBe(400);
            expect(player.vx).toBe(0);
            expect(player.isWalking).toBe(false);
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
        it('should reset velocity, target, and walking state', () => {
            player.vx = 100;
            player.targetX = 500;
            player.isWalking = true;

            player.stop();

            expect(player.vx).toBe(0);
            expect(player.targetX).toBeNull();
            expect(player.isWalking).toBe(false);
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
});
