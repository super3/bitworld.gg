/**
 * Input manager for handling pointer input and player movement
 */
class InputManager {
    constructor(scene) {
        this.scene = scene;

        // Left click = move selected player
        this.scene.input.on('pointerdown', pointer => {
            if (pointer.rightButtonDown()) return; // handled elsewhere for selection

            const selected = this.scene.selectedPlayer;

            if (this.scene.elevatorManager.boardedPlayers.includes(selected)) return;

            if (selected) {
                if (selected.elevatorClickTimer)
                       selected.elevatorClickTimer.remove();

                // Cancel waiting/door states on new click
                if (selected.isAnyOf(PlayerState.WAITING_FOR_ELEVATOR, PlayerState.WALKING_THROUGH_DOOR, PlayerState.WALKING_TO_ELEVATOR)) {
                    selected.forceState(PlayerState.IDLE);
                }

                selected.targetX = pointer.worldX;
                if (selected.is(PlayerState.IDLE)) {
                    selected.setState(PlayerState.WALKING);
                }
                // If already WALKING, state stays — just new targetX
            }
        });
    }

    update(dt) {
        const selected = this.scene.selectedPlayer;
        if (selected) {
            // Apply constraints
            selected.x = Phaser.Math.Clamp(
                selected.x,
                0,
                GameConfig.WINDOW_WIDTH - (GameConfig.SPRITE_WIDTH * GameConfig.SCALE_FACTOR)
            );
        }
    }

    destroy() {
        // Clean up if needed later
    }
}
