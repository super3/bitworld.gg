/**
 * Static configuration class that holds all game constants and settings.
 * This centralized approach makes it easier to modify game parameters.
 */
class GameConfig {
    // Display settings
    static WINDOW_WIDTH = 800;  // Width of the main game window
    static WINDOW_HEIGHT = 600;  // Height of the main game window
    static TEXT_BOX_WIDTH = 200;  // Width of the side panel text box
    static TOTAL_WIDTH = GameConfig.WINDOW_WIDTH + GameConfig.TEXT_BOX_WIDTH;  // Total window width including text box
    
    // Color definitions in hex format
    static BACKGROUND_COLOR = 0x8ed2ff;  // Light blue sky
    static GROUND_COLOR = 0xa9574c;  // Brown earth
    static GRASS_COLOR = 0x30976c;  // Green grass
    static TEXT_BOX_COLOR = 0x0a0c1d;  // RGB(10, 12, 29) - very dark blue
    static TEXT_COLOR = 0xf5f7fa;  // Light text matching theme
    
    // Character sprite settings
    static SPRITE_WIDTH = 32;  // Width of a single sprite frame
    static SPRITE_HEIGHT = 32;  // Height of a single sprite frame
    static SCALE_FACTOR = 2;  // Scaling factor for sprites
    static CHAR_SPEED = 100;  // Character movement speed (pixels per second)
    
    // Animation timing settings
    static IDLE_ANIMATION_SPEED = 3;  // Frames per second when idle
    static WALK_ANIMATION_SPEED = 8;  // Frames per second when walking
    
    // Environment dimensions
    static GROUND_HEIGHT = 13;  // Height of the ground layer
    static GRASS_HEIGHT = 2;  // Height of the grass layer
    
    // UI settings
    static FONT_SIZE = 20;  // Size of the font in pixels
    
    // Building settings
    static BUILDING_WIDTH = 288;  // Original width of building sprites
    static BUILDING_HEIGHT = 48;  // Original height of building sprites
    static BUILDING_SCALE = 2;  // Scale factor for building sprites

    // Sidebar settings
    static SIDEBAR_BORDER_WIDTH = 2;
    static SIDEBAR_BORDER_COLOR = 0x5588bb;  // Lighter blue matching live camera border
    static SIDEBAR_MARGIN = GameConfig.WINDOW_WIDTH + 20;
    static SIDEBAR_PLAYER_Y = 30;
    static SIDEBAR_CONTROLS_Y = 80;

    // Sidebar text styles
    static SIDEBAR_PLAYER_STYLE = {
        fontSize: '18px',
        fill: '#ffffff',  // White for maximum contrast
        fontFamily: 'monospace',
        fontWeight: 'bold'
    };

    static SIDEBAR_HEADER_STYLE = {
        fontSize: '14px',
        fill: '#8ed2ff',  // Bright blue for headers
        fontFamily: 'monospace'
    };

    static SIDEBAR_CONTROLS_STYLE = {
        fontSize: '11px',
        fill: '#e0e0e0',  // Light gray for better readability
        fontFamily: 'monospace'
    };

    // Animation frame configuration
    static WALK_FRAMES = { start: 0, end: 3 };
    static IDLE_FRAMES = { start: 5, end: 7 };
    
    // Elevator settings
    static ELEVATOR_SPEED = 1500; // milliseconds

    // Floor position calculations (centralized to avoid duplication)
    static getScaledFloorHeight() {
        return GameConfig.BUILDING_HEIGHT * GameConfig.BUILDING_SCALE;
    }

    static getBuildingFloorY(floorIndex) {
        const sh = GameConfig.getScaledFloorHeight();
        return GameConfig.WINDOW_HEIGHT - GameConfig.GROUND_HEIGHT -
               sh * (floorIndex + 1) + sh / 2;
    }

    static getPlayerFloorY(floorIndex) {
        const sh = GameConfig.getScaledFloorHeight();
        return GameConfig.WINDOW_HEIGHT - GameConfig.GROUND_HEIGHT -
               (GameConfig.SPRITE_HEIGHT + 3) -
               sh * floorIndex + sh / 2;
    }

    static getElevatorY(floorIndex) {
        return GameConfig.getPlayerFloorY(floorIndex) -
               GameConfig.GROUND_HEIGHT - GameConfig.SPRITE_HEIGHT + 28;
    }
} 