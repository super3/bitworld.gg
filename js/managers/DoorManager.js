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
    if (player.hasEnteredDoor || player.walkingThroughDoor) return null;

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
    player.targetX = null;

    player.vx = 0;
    const directionAtStart = Math.sign(dx);

    player.hasEnteredDoor = true;
    player.walkingThroughDoor = true;
    door.isOpen = true;

    // Visual switch: hide closed, show opened
    door.closedSprite.setVisible(false);
    door.openedSprite.setVisible(true);

    this.scene.time.delayedCall(200, () => {
        if (originalTargetX !== null && player.walkingThroughDoor) {
            player.targetX = originalTargetX;
            // Make sure playerCommandedMovement flag is preserved
            if (player.playerCommandedMovement === undefined) {
                player.playerCommandedMovement = !player.isAutomated;
            }
        }
    });

    this.scene.time.delayedCall(1000, () => {
        door.isOpen = false;
        door.closedSprite.setVisible(true);
        door.openedSprite.setVisible(false);
        player.hasEnteredDoor = false;
        player.walkingThroughDoor = false;
    });
};
