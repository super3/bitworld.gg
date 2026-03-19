const fs = require('fs');
const path = require('path');

function loadScript(filePath) {
    const code = fs.readFileSync(path.resolve(__dirname, '..', filePath), 'utf-8');
    // Wrap in a function that returns the class, then assign to global
    return eval(code + '\n;typeof ' + getClassName(filePath) + ' !== "undefined" ? ' + getClassName(filePath) + ' : undefined;');
}

function getClassName(filePath) {
    return path.basename(filePath, '.js');
}

// Load source files into the global scope (order matters — GameConfig first)
global.GameConfig = loadScript('js/GameConfig.js');
global.Player = loadScript('js/Player.js');
