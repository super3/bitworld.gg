function DoorManager(scene) {
    this.scene = scene;
    this.doors = [];
}

DoorManager.prototype.addDoor = function (floor, x, width = 32, height = 60, doorType) {
    const y = GameConfig.getPlayerFloorY(floor) - GameConfig.GROUND_HEIGHT - 4;

    const closed = this.scene.add.image(x, y, doorType+'_closed')
        .setOrigin(0.5, 1)
        .setDepth(10)
        .setScale(2);

    const opened = this.scene.add.image(x, y, doorType+'_opened')
        .setOrigin(0.5, 1)
        .setVisible(false)
        .setDepth(10)
        .setScale(2);

    // Optional: compensate for the 5 vs 13 pixel width difference
    const offset = (13 - 5) / 2;
    opened.setX(x + offset + 5); // aligns left edge

    this.doors.push({
        floor,
        x,
        y,
        width,
        height,
        isOpen: false,
        closedSprite: closed,
        openedSprite: opened
    });
};

DoorManager.prototype.checkDoorCollision = function (player, dx) {
    // State machine check replaces: player.hasEnteredDoor || player.walkingThroughDoor
    if (player.is(PlayerState.WALKING_THROUGH_DOOR)) return null;

    return this.doors.find(door =>
        door.floor === player.currentFloor &&
        Math.abs(door.x - player.x) < 20 &&
        Math.sign(dx) === Math.sign(door.x - player.x) &&
        !door.isOpen // door must be closed for collision
    );
};

DoorManager.prototype.tryOpenDoor = function (player, dx) {
    const door = this.checkDoorCollision(player, dx);
    if (!door) return;

    // Pause movement
    const originalTargetX = player.targetX;
    const wasAutomatedWalking = player.is(PlayerState.AUTOMATED_WALKING);
    player.targetX = null;
    player.vx = 0;

    // Transition to door state
    player.forceState(PlayerState.WALKING_THROUGH_DOOR);
    door.isOpen = true;

    // Visual switch: hide closed, show opened
    door.closedSprite.setVisible(false);
    door.openedSprite.setVisible(true);

    this.scene.time.delayedCall(200, () => {
        if (player.is(PlayerState.WALKING_THROUGH_DOOR) && originalTargetX !== null) {
            player.targetX = originalTargetX;
        }
    });

    this.scene.time.delayedCall(1000, () => {
        door.isOpen = false;
        door.closedSprite.setVisible(true);
        door.openedSprite.setVisible(false);

        // Transition out of door state if still in it
        if (player.is(PlayerState.WALKING_THROUGH_DOOR)) {
            if (player.isAutomated) {
                if (player.targetX !== null) {
                    player.forceState(PlayerState.AUTOMATED_WALKING);
                } else {
                    player.forceState(PlayerState.AUTOMATED_IDLE);
                    player.idleTimer = 0;
                    player.idleDuration = 1 + Math.random() * 2;
                }
            } else {
                if (player.targetX !== null) {
                    player.forceState(PlayerState.WALKING);
                } else {
                    player.forceState(PlayerState.IDLE);
                }
            }
        }
    });
};
