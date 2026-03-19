module.exports = {
    testEnvironment: 'node',
    setupFiles: ['./tests/setup.js'],
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverageFrom: [
        'js/GameConfig.js',
        'js/PlayerStateMachine.js',
        'js/Player.js',
        'js/managers/DoorManager.js',
        'js/managers/ElevatorManager.js',
    ],
};
