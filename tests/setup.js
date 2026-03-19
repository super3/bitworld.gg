const fs = require('fs');
const path = require('path');

function loadScript(filePath) {
    const code = fs.readFileSync(path.resolve(__dirname, '..', filePath), 'utf-8');
    return eval(code + '\n;typeof ' + getClassName(filePath) + ' !== "undefined" ? ' + getClassName(filePath) + ' : undefined;');
}

function getClassName(filePath) {
    return path.basename(filePath, '.js');
}

function loadMultipleExports(filePath, names) {
    const code = fs.readFileSync(path.resolve(__dirname, '..', filePath), 'utf-8');
    const result = {};
    // Build a return expression that captures all named exports
    const returnExpr = names.map(n => `"${n}": typeof ${n} !== "undefined" ? ${n} : undefined`).join(',');
    const wrapped = code + '\n;({' + returnExpr + '})';
    const exports = eval(wrapped);
    names.forEach(n => {
        if (exports[n] !== undefined) {
            global[n] = exports[n];
        }
    });
}

// Load source files into the global scope (order matters)
global.GameConfig = loadScript('js/GameConfig.js');

// PlayerStateMachine.js defines PlayerState, VALID_TRANSITIONS, and PlayerStateMachine
loadMultipleExports('js/PlayerStateMachine.js', ['PlayerState', 'VALID_TRANSITIONS', 'PlayerStateMachine']);

global.Player = loadScript('js/Player.js');
