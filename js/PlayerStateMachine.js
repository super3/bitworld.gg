/**
 * Player state constants.
 * Replaces scattered boolean flags (isWalking, waitingForElevator, inElevator,
 * walkingThroughDoor, hasEnteredDoor, isIdling, playerCommandedMovement) with
 * a single, explicit state value.
 */
const PlayerState = Object.freeze({
    IDLE: 'IDLE',
    WALKING: 'WALKING',
    AUTOMATED_IDLE: 'AUTOMATED_IDLE',
    AUTOMATED_WALKING: 'AUTOMATED_WALKING',
    WALKING_TO_ELEVATOR: 'WALKING_TO_ELEVATOR',
    WAITING_FOR_ELEVATOR: 'WAITING_FOR_ELEVATOR',
    IN_ELEVATOR: 'IN_ELEVATOR',
    WALKING_THROUGH_DOOR: 'WALKING_THROUGH_DOOR',
});

/**
 * Valid state transitions. Any transition not listed here will be rejected
 * by setState() (use forceState() for recovery / cancellation scenarios).
 */
const VALID_TRANSITIONS = {
    [PlayerState.IDLE]: [
        PlayerState.WALKING,
        PlayerState.AUTOMATED_IDLE,
        PlayerState.AUTOMATED_WALKING,
        PlayerState.WALKING_TO_ELEVATOR,
    ],
    [PlayerState.WALKING]: [
        PlayerState.IDLE,
        PlayerState.WALKING_TO_ELEVATOR,
        PlayerState.WALKING_THROUGH_DOOR,
        PlayerState.AUTOMATED_IDLE,
        PlayerState.WAITING_FOR_ELEVATOR,
    ],
    [PlayerState.AUTOMATED_IDLE]: [
        PlayerState.AUTOMATED_WALKING,
        PlayerState.WALKING,
        PlayerState.IDLE,
        PlayerState.WALKING_TO_ELEVATOR,
    ],
    [PlayerState.AUTOMATED_WALKING]: [
        PlayerState.AUTOMATED_IDLE,
        PlayerState.WALKING,
        PlayerState.IDLE,
        PlayerState.WALKING_THROUGH_DOOR,
        PlayerState.WALKING_TO_ELEVATOR,
    ],
    [PlayerState.WALKING_TO_ELEVATOR]: [
        PlayerState.WAITING_FOR_ELEVATOR,
        PlayerState.IDLE,
        PlayerState.WALKING,
        PlayerState.WALKING_THROUGH_DOOR,
    ],
    [PlayerState.WAITING_FOR_ELEVATOR]: [
        PlayerState.IN_ELEVATOR,
        PlayerState.IDLE,
        PlayerState.WALKING,
        PlayerState.WALKING_TO_ELEVATOR,
    ],
    [PlayerState.IN_ELEVATOR]: [
        PlayerState.IDLE,
        PlayerState.WALKING,
        PlayerState.AUTOMATED_IDLE,
    ],
    [PlayerState.WALKING_THROUGH_DOOR]: [
        PlayerState.WALKING,
        PlayerState.IDLE,
        PlayerState.AUTOMATED_WALKING,
        PlayerState.AUTOMATED_IDLE,
        PlayerState.WAITING_FOR_ELEVATOR,  // Can reach elevator zone while door cooldown active
        PlayerState.WALKING_TO_ELEVATOR,   // Can click different floor during door transition
    ],
};

/**
 * Manages player state transitions with validation.
 */
class PlayerStateMachine {
    /**
     * @param {string} initialState - One of PlayerState values
     */
    constructor(initialState = PlayerState.IDLE) {
        this._state = initialState;
        this._previousState = null;
    }

    /** @returns {string} Current state */
    get state() {
        return this._state;
    }

    /** @returns {string|null} Previous state before last transition */
    get previousState() {
        return this._previousState;
    }

    /**
     * Attempt a validated state transition.
     * @param {string} newState - Target state
     * @returns {boolean} Whether the transition succeeded
     */
    setState(newState) {
        if (newState === this._state) return true;

        const valid = VALID_TRANSITIONS[this._state];
        if (!valid || !valid.includes(newState)) {
            console.warn(`Invalid state transition: ${this._state} → ${newState}`);
            return false;
        }

        this._previousState = this._state;
        this._state = newState;
        return true;
    }

    /**
     * Force-set state without validation. Use for user-initiated cancellations
     * or recovery scenarios where the normal transition graph doesn't apply.
     * @param {string} newState - Target state
     */
    forceState(newState) {
        this._previousState = this._state;
        this._state = newState;
    }

    /**
     * Check if current state matches.
     * @param {string} state
     * @returns {boolean}
     */
    is(state) {
        return this._state === state;
    }

    /**
     * Check if current state is any of the given states.
     * @param {...string} states
     * @returns {boolean}
     */
    isAnyOf(...states) {
        return states.includes(this._state);
    }
}

/* istanbul ignore next */
if (typeof module !== 'undefined') module.exports = { PlayerState, VALID_TRANSITIONS, PlayerStateMachine };
