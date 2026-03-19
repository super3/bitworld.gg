const path = require('path');

// Load source files via require() so Jest can instrument them for coverage
global.GameConfig = require(path.resolve(__dirname, '..', 'js/GameConfig.js'));

const { PlayerState, VALID_TRANSITIONS, PlayerStateMachine } = require(path.resolve(__dirname, '..', 'js/PlayerStateMachine.js'));
global.PlayerState = PlayerState;
global.VALID_TRANSITIONS = VALID_TRANSITIONS;
global.PlayerStateMachine = PlayerStateMachine;

global.Player = require(path.resolve(__dirname, '..', 'js/Player.js'));
global.DoorManager = require(path.resolve(__dirname, '..', 'js/managers/DoorManager.js'));
global.ElevatorManager = require(path.resolve(__dirname, '..', 'js/managers/ElevatorManager.js'));
