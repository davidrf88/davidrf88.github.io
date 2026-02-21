import Phaser from 'phaser';
import { Player } from './Player.js';
import { DiscConfig } from './DiscConfig.js';

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    preload() {
        // Load player assets
        Player.preload(this);
    }

    create() {
        // Set world bounds
        this.matter.world.setBounds(0, 0, DiscConfig.world.width, DiscConfig.world.height);

        // Create background grid
        this.createBackground();

        // Create player at center of world
        this.player = new Player(this, DiscConfig.world.width / 2, DiscConfig.world.height / 2);

        // Setup camera
        this.cameras.main.setBounds(0, 0, DiscConfig.world.width, DiscConfig.world.height);
        this.cameras.main.startFollow(this.player.getSprite(), true, 0.1, 0.1);
        this.cameras.main.setZoom(1);

        // Add world boundary indicators (optional - for visual reference)
        this.createBoundaryIndicators();
    }

    createBackground() {
        // Create a simple grid background
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x333333, 0.5);

        // Draw vertical lines
        for (let x = 0; x <= DiscConfig.world.width; x += DiscConfig.world.gridSize) {
            graphics.lineBetween(x, 0, x, DiscConfig.world.height);
        }

        // Draw horizontal lines
        for (let y = 0; y <= DiscConfig.world.height; y += DiscConfig.world.gridSize) {
            graphics.lineBetween(0, y, DiscConfig.world.width, y);
        }

        // Add background color
        const bg = this.add.rectangle(
            DiscConfig.world.width / 2, 
            DiscConfig.world.height / 2, 
            DiscConfig.world.width, 
            DiscConfig.world.height, 
            0x1a1a1a
        );
        bg.setDepth(-2);
        graphics.setDepth(-1);
    }

    createBoundaryIndicators() {
        // Create visual boundaries
        const boundaryGraphics = this.add.graphics();
        boundaryGraphics.lineStyle(4, 0xff0000, 0.8);
        boundaryGraphics.strokeRect(0, 0, DiscConfig.world.width, DiscConfig.world.height);
    }

    update(time, delta) {
        // Update player
        this.player.update(time, delta);
        
        // Switch camera between player and disc based on disc state
        const disc = this.player.disc;
        if (disc && (disc.flyingStatus === 'flying' || disc.flyingStatus === 'ended')) {
            // Follow disc while it's flying or in the 5-second ended state
            if (disc.sprite) {
                this.cameras.main.startFollow(disc.sprite, true, 0.1, 0.1);
            }
        } else {
            // Return to following player when disc is 'not thrown'
            this.cameras.main.startFollow(this.player.getSprite(), true, 0.1, 0.1);
        }
    }
}

// Phaser game configuration
const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight,
        parent: 'game-container'
    },
    backgroundColor: '#1a1a1a',
    physics: {
        default: 'matter',
        matter: {
            gravity: {
                x: 0,
                y: 0
            },
            debug: false,
            enableSleeping: false
        }
    },
    scene: [GameScene]
};

// Create game instance
const game = new Phaser.Game(config);
