
class ElevatorManager {
    constructor(scene) {
        this.scene = scene;
        this.isLocked = false;

        this.currentDoorState = Array(this.scene.buildingManager.floors.length).fill('closed');
        this.elevatorCurrentFloor = scene.currentFloor;

        const elevatorX = this.scene.elevator_X_position;

        this.activeRequest = null;
        this.boardedPlayers = [];
        this.elevatorSprites = [];
        for (let i = 0; i < scene.buildingManager.floors.length; i++) {
            const elevatorY = GameConfig.getElevatorY(i);

            const elevatorSprite = this.scene.add.image(elevatorX, elevatorY, 'Elevator_closed');
            elevatorSprite.setDepth(1);
            elevatorSprite.setScale(2);
            elevatorSprite.setOrigin(0.5, 1);

            //elevator backdrop
            const tileSize = 16;
            const backdropRT = this.scene.add.renderTexture(elevatorX, elevatorY + 5, 32, 32);
            backdropRT.setOrigin(0.5, 1);
            backdropRT.setDepth(0);
            backdropRT.setScale(2);

            // Top-left of red background is tile index 512
            const indices = [1225, 1226, 1260, 1261];

            let bdrop = 0;
            for (let row = 0; row < 2; row++) {
                for (let col = 0; col < 2; col++) {
                    backdropRT.drawFrame('wallpaper_tiles', indices[bdrop], col * tileSize, row * tileSize);
                    bdrop++;
                }
            }

            this.elevatorSprites.push(elevatorSprite);
        }

        // Create elevator light sprite (starts on the current floor)
        this.elevatorLight = scene.add.image(elevatorX, GameConfig.getElevatorY(this.elevatorCurrentFloor), 'Elevator_light');
        this.elevatorLight.setDepth(2); // Make sure it's above the elevator sprite
        this.elevatorLight.setScale(2); // Match elevator door scale if needed
        this.elevatorLight.setOrigin(0.5, 1); // Align with elevator door bottom

    }

    requestElevator(player, targetFloor) {
        // Player should already be in WAITING_FOR_ELEVATOR state
        player.targetFloor = targetFloor;

        if (!this.activeRequest) {

            this.activeRequest = { player, targetFloor };
            this.processQueue();
        }
    }

    processQueue() {
        if (this.isLocked || !this.activeRequest) return;

        const { player } = this.activeRequest;
        const startFloor = this.elevatorCurrentFloor;
        const endFloor = player.currentFloor;

        if (startFloor === endFloor) {
     this.elevatorLightFlicker(1);
            this.beginBoarding();
        } else {
            this.moveToFloor(endFloor, () => {

                this.beginBoarding();
            });
        }
    }

    moveToFloor(targetFloor, onArriveCallback) {
        this.isLocked = true;
        const direction = Math.sign(targetFloor - this.elevatorCurrentFloor);
        const steps = Math.abs(targetFloor - this.elevatorCurrentFloor);
        let count = 0;

        this.elevatorLightFlicker(0);
        const timer = this.scene.time.addEvent({
            delay: GameConfig.ELEVATOR_SPEED,
            repeat: steps,
            callback: () => {
                this.elevatorCurrentFloor += direction;
                count++;

                // Only flicker light off if not at target floor yet
                if (count < steps) {
                    this.scene.time.delayedCall(GameConfig.ELEVATOR_LIGHT_FLICKER_MS, () => {
                        this.elevatorLightFlicker(0);
                    });
                }

                // Move elevator light to match new floor
                this.elevatorLight.y = GameConfig.getElevatorY(this.elevatorCurrentFloor);
                this.elevatorLightFlicker(1);

                if (count === steps) {
                    timer.remove();
                    onArriveCallback();
                }
            }
        });
    }

    beginBoarding() {
        const originalTarget = this.activeRequest.targetFloor;
        const direction = Math.sign(originalTarget - this.elevatorCurrentFloor);
        const floor = this.elevatorCurrentFloor;

        const hasBoarders = this.scene.players.some(({ player }) =>
            player.currentFloor === floor &&
            player.is(PlayerState.WAITING_FOR_ELEVATOR) &&
            Math.sign(player.targetFloor - player.currentFloor) === direction
        );

        const hasExiters = this.boardedPlayers.some(p => p.targetFloor === floor);
        if (hasBoarders || hasExiters) {
            this.updateElevatorSprite(floor, true); // Open doors

            // Step 1: small delay to simulate door open
            this.scene.time.delayedCall(GameConfig.ELEVATOR_DOOR_OPEN_DELAY_MS, () => {
                // Step 2: show exiting players
                const exiting = this.boardedPlayers.filter(p => p.targetFloor === floor);
                exiting.forEach(player => {
                    player.currentFloor = floor;
                    player.y = GameConfig.getPlayerFloorY(floor);
                    player.targetFloor = null;
                    player.spriteRef.setVisible(true);
                    if (player.deferredTargetX !== undefined) {
                        player.targetX = player.deferredTargetX;
                        delete player.deferredTargetX;
                        player.forceState(PlayerState.WALKING);
                    } else {
                        if (player.isAutomated) {
                            player.forceState(PlayerState.AUTOMATED_IDLE);
                            player.idleTimer = 0;
                            player.idleDuration = GameConfig.NPC_IDLE_MIN + Math.random() * GameConfig.NPC_IDLE_RANGE;
                        } else {
                            player.forceState(PlayerState.IDLE);
                        }
                    }
                });
                this.boardedPlayers = this.boardedPlayers.filter(p => p.targetFloor !== floor);

                const newBoarders = this.scene.players
                    .filter(({ player }) =>
                        player.currentFloor === floor &&
                        player.is(PlayerState.WAITING_FOR_ELEVATOR) &&
                        Math.sign(player.targetFloor - player.currentFloor) === direction
                    )
                    .map(({ player }) => player);

                this.sequentialBoarding([...newBoarders], () => {
                    this.scene.time.delayedCall(GameConfig.ELEVATOR_LIGHT_FLICKER_MS, () => {
                        this.elevatorLightFlicker(0);
                     this.updateElevatorSprite(floor, false); // Close doors
                            this.scene.time.delayedCall(GameConfig.ELEVATOR_SPEED, () => {
                            this.continueElevatorTravel(originalTarget, direction);
                        });
                    });
                });
            });
        } else {
            // No one getting on or off — continue immediately
             this.elevatorLightFlicker(0);
             this.scene.time.delayedCall(GameConfig.ELEVATOR_SPEED, () => {
            this.continueElevatorTravel(originalTarget, direction);
         });
        }
    }

    sequentialBoarding(players, onComplete) {
        if (players.length === 0) {
            onComplete();
            return;
        }

        const player = players.shift();
        const targetX = this.scene.elevator_X_position;
        player.targetX = targetX;
        const walkInterval = this.scene.time.addEvent({
            delay: GameConfig.ELEVATOR_BOARDING_POLL_MS,
            loop: true,
            callback: () => {
                const dx = targetX - player.x;
                if (Math.abs(dx) < GameConfig.MOVE_SNAP_THRESHOLD) {
                    player.x = targetX;
                    player.vx = 0;
                    player.spriteRef.setDepth(0); // Behind the elevator door
                    player.setState(PlayerState.IN_ELEVATOR);
                    this.boardedPlayers.push(player);
                    walkInterval.remove();

                    this.sequentialBoarding(players, onComplete);
                } else {
                    player.vx = Math.sign(dx) * player.speed;
                }
            }
        });
    }

    sequentialExiting(players, floor, onComplete) {
    if (players.length === 0) {
        onComplete();
        return;
    }

    const player = players.shift();

    const walkInterval = this.scene.time.addEvent({
        delay: GameConfig.ELEVATOR_EXIT_DELAY_MS,
        loop: true,
        callback: () => {
            player.y = GameConfig.getPlayerFloorY(floor);
            player.currentFloor = floor;
            player.targetFloor = null;
            player.spriteRef.setDepth(20); // Return to default front layer
            if (player.deferredTargetX !== undefined) {
                player.targetX = player.deferredTargetX;
                delete player.deferredTargetX;
                player.forceState(PlayerState.WALKING);
            } else {
                if (player.isAutomated) {
                    player.forceState(PlayerState.AUTOMATED_IDLE);
                    player.idleTimer = 0;
                    player.idleDuration = 1 + Math.random() * 2;
                } else {
                    player.forceState(PlayerState.IDLE);
                }
            }
            walkInterval.remove();
            this.sequentialExiting(players, floor, onComplete);

        }
    });
}

continueElevatorTravel(originalTarget, direction) {
    let stepsRemaining = Math.abs(originalTarget - this.elevatorCurrentFloor);

    const step = () => {

        if (stepsRemaining <= 0) {
            this.isLocked = false;
            this.activeRequest = null;

            const remainingPassenger = this.boardedPlayers.find(p => p.targetFloor != null);
            if (remainingPassenger) {
                this.activeRequest = {
                    player: remainingPassenger,
                    targetFloor: remainingPassenger.targetFloor,
                    endFloor: this.elevatorCurrentFloor,
                    startFloor: this.elevatorCurrentFloor
                };
                this.processQueue();
            } else {
                const next = this.scene.players.find(({ player }) => player.is(PlayerState.WAITING_FOR_ELEVATOR));
                if (next) {
                    this.activeRequest = {
                        player: next.player,
                        targetFloor: next.player.targetFloor
                    };
                    this.elevatorLightFlicker(0);
                    this.processQueue();
                } else {
                    this.elevatorLightFlicker(1);
                    this.updateElevatorSprite(this.elevatorCurrentFloor, false); // Close doors
                }
            }
            return;
        }

        // Move to next floor
        this.elevatorCurrentFloor += direction;
        const floor = this.elevatorCurrentFloor;

        // Only flicker light off if not at target floor yet
        if (this.elevatorCurrentFloor !== originalTarget) {
            this.scene.time.delayedCall(GameConfig.ELEVATOR_LIGHT_FLICKER_MS, () => {
                this.elevatorLightFlicker(0);
            });
        }

        // Move elevator light to match new floor
        this.elevatorLight.y = GameConfig.getElevatorY(floor);
        this.elevatorLightFlicker(1);

        this.boardedPlayers.forEach(p => p.y = GameConfig.getPlayerFloorY(floor));
        const exiting = this.boardedPlayers.filter(p => p.targetFloor === floor);
        this.boardedPlayers = this.boardedPlayers.filter(p => p.targetFloor !== floor);

        const newBoarders = this.scene.players
            .filter(({ player }) =>
                player.currentFloor === floor &&
                player.is(PlayerState.WAITING_FOR_ELEVATOR) &&
                Math.sign(player.targetFloor - player.currentFloor) === direction
            )
            .map(({ player }) => player);

        const hasActivity = exiting.length > 0 || newBoarders.length > 0;

        if (hasActivity) {
            this.updateElevatorSprite(floor, true); // Open doors

            this.scene.time.delayedCall(GameConfig.ELEVATOR_EXIT_DELAY_MS / 2, () => {
                this.sequentialExiting([...exiting], floor, () => {
                    this.scene.time.delayedCall(GameConfig.ELEVATOR_EXIT_DELAY_MS * 1.5, () => {
                        this.sequentialBoarding([...newBoarders], () => {
                            this.scene.time.delayedCall(GameConfig.ELEVATOR_DOOR_OPEN_DELAY_MS, () => {
                                this.updateElevatorSprite(floor, false); // Close doors
                                stepsRemaining--;
                                this.scene.time.delayedCall(GameConfig.ELEVATOR_SPEED/2, step); // Call next step after short pause
                            });
                        });
                    });
                });
            });
        } else {
            // No one getting on/off, just move on
            stepsRemaining--;
            this.scene.time.delayedCall(GameConfig.ELEVATOR_SPEED, step);
        }
    };

    step(); // Start the loop
}


updateElevatorSprite(floorIndex, isOpen) {
    const sprite = this.elevatorSprites[floorIndex];
    if (!sprite) return;

    const desiredState = isOpen ? 'open' : 'closed';
    if (this.currentDoorState[floorIndex] === desiredState) return;

    // Step 1: transition to slightly opened first
    sprite.setTexture('Elevator_slightlyOpened');
    this.currentDoorState[floorIndex] = 'slightly';

    this.scene.time.delayedCall(GameConfig.ELEVATOR_DOOR_TRANSITION_MS, () => {
        // Step 2: finish to fully opened or closed
        const finalKey = isOpen ? 'Elevator_opened' : 'Elevator_closed';
        sprite.setTexture(finalKey);
        this.currentDoorState[floorIndex] = desiredState;
    });
}

elevatorLightFlicker(alpha)
{
    this.scene.tweens.add({
    targets: this.elevatorLight,
    alpha: alpha,
    duration: GameConfig.ELEVATOR_DOOR_TRANSITION_MS * 2,
    ease: 'Power2'
    });
}
}

/* istanbul ignore next */
if (typeof module !== 'undefined') module.exports = ElevatorManager;
