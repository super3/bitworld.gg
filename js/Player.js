/**
 * Player class representing the game character.
 * Handles player state, movement, and attributes.
 */
class Player {
    /**
     * Initialize a new player character.
     *
     * @param {string} firstName - Player's first name
     * @param {string} lastName - Player's last name
     * @param {number} x - Initial x position
     * @param {number} y - Initial y position
     * @param {string} spriteKey - Sprite sheet key
     * @param {number} floorIndex - Starting floor (default 0)
     */
    constructor(firstName, lastName, x, y, spriteKey, floorIndex = 0) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.x = x;
        this.y = y;
        this.facingRight = true;
        this.speed = GameConfig.CHAR_SPEED;

        this.spriteKey = spriteKey;
        this.currentFloor = floorIndex;
        this.vx = 0;
        this.targetX = null;
        this.deferredTargetX = null;
        this.targetFloor = null;
        this.elevatorClickTimer = null;

        // State machine replaces: isWalking, waitingForElevator, inElevator,
        // walkingThroughDoor, hasEnteredDoor, isIdling, playerCommandedMovement
        this.stateMachine = new PlayerStateMachine(PlayerState.IDLE);

        // Mode flag — determines behavior mode, not a movement state
        this.isAutomated = false;

        // Automation properties (initialized by GameScene.initializeNPCBehaviors)
        this.direction = 1;
        this.automatedSpeed = GameConfig.CHAR_SPEED * 0.4;
        this.idleTimer = 0;
        this.idleDuration = 0;
        this.minX = 0;
        this.maxX = 0;

        // Status attributes (0-100 scale)
        this.thirst = 100;  // 100 = fully hydrated, 0 = extremely thirsty
        this.hunger = 100;  // 100 = full, 0 = starving
        this.sleep = 100;   // 100 = well-rested, 0 = exhausted
        this.toilet = 100;  // 100 = no need, 0 = urgent need
    }

    // ── State convenience methods ──────────────────────────────────────

    /** @returns {string} Current PlayerState value */
    get state() { return this.stateMachine.state; }

    /**
     * Attempt a validated state transition.
     * @param {string} newState - A PlayerState value
     * @returns {boolean} Whether the transition succeeded
     */
    setState(newState) { return this.stateMachine.setState(newState); }

    /**
     * Force-set state (for cancellations / recovery).
     * @param {string} newState - A PlayerState value
     */
    forceState(newState) { this.stateMachine.forceState(newState); }

    /**
     * @param {string} state - A PlayerState value
     * @returns {boolean}
     */
    is(state) { return this.stateMachine.is(state); }

    /**
     * @param {...string} states - PlayerState values
     * @returns {boolean}
     */
    isAnyOf(...states) { return this.stateMachine.isAnyOf(...states); }

    // ── Movement ───────────────────────────────────────────────────────

    /**
     * Move toward targetX. Returns true if the target was reached.
     * Does NOT manage state transitions — callers are responsible for that.
     * @param {number} dt - Delta time in seconds
     * @returns {boolean} Whether the player reached the target
     */
    moveTowardTarget(dt) {
        if (this.targetX !== null) {
            const dx = this.targetX - this.x;
            const dir = Math.sign(dx);
            this.vx = dir * this.speed;
            this.x += this.vx * dt;
            this.facingRight = dir > 0;

            if (Math.abs(dx) < 2) {
                this.x = this.targetX;
                this.stop();
                return true;
            }
            return false;
        } else {
            this.vx = 0;
            return false;
        }
    }

    /**
     * Halt movement (physics only — does not change state).
     */
    stop() {
        this.vx = 0;
        this.targetX = null;
    }

    /**
     * Update player status values over time
     * @param {number} dt - Delta time in seconds
     */
    updateStatus(dt) {
        // Status degradation rates per second
        const THIRST_RATE = 0.5;  // Lose 0.5% thirst per second
        const HUNGER_RATE = 0.3;  // Lose 0.3% hunger per second
        const SLEEP_RATE = 0.2;   // Lose 0.2% sleep per second
        const TOILET_RATE = 0.4;  // Lose 0.4% toilet per second

        // Update status values
        this.thirst = Math.max(0, this.thirst - (THIRST_RATE * dt));
        this.hunger = Math.max(0, this.hunger - (HUNGER_RATE * dt));
        this.sleep = Math.max(0, this.sleep - (SLEEP_RATE * dt));
        this.toilet = Math.max(0, this.toilet - (TOILET_RATE * dt));
    }
}

/* istanbul ignore next */
if (typeof module !== 'undefined') module.exports = Player;
