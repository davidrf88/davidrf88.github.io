import { Disc } from './Disc.js';

export class Player {
    constructor(scene, x, y) {
        this.scene = scene;
        this.moveForce = 0.0008;
        this.currentDirection = 'down';
        this.isThrowingMode = false;

        // Create physics body with higher friction to reduce skating
        this.body = scene.matter.add.circle(x, y, 20, {
            friction: 0.1,
            frictionAir: 0.15,
            density: 0.001
        });

        // Create sprite
        this.sprite = scene.add.sprite(x, y, 'playerSprite', 0);

        // Create disc for throwing
        this.disc = new Disc(scene, x, y);

        // Create throwing mode text indicator
        this.throwingModeText = scene.add.text(
            scene.scale.width / 2,
            40,
            'Throwing Mode',
            {
                fontFamily: 'Retro Gaming',
                fontSize: '32px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 6,
                align: 'center'
            }
        );
        this.throwingModeText.setOrigin(0.5, 0.5);
        this.throwingModeText.setScrollFactor(0);
        this.throwingModeText.setDepth(1000);
        this.throwingModeText.setVisible(false);

        // Setup animations
        this.createAnimations();

        // Setup controls
        this.setupControls();

        // Start with idle animation
        this.sprite.play('idle-down');
    }

    static preload(scene) {
        // Load isometric spritesheet (32x48, 4 rows for directions)
        scene.load.spritesheet('playerSprite', 'assets/sprites/sprite.png', {
            frameWidth: 32,
            frameHeight: 48
        });
    }

    createAnimations() {
        const framesPerRow = 4;

        // Down animations (row 0)
        this.scene.anims.create({
            key: 'walk-down',
            frames: this.scene.anims.generateFrameNumbers('playerSprite', {
                start: 1,
                end: framesPerRow - 1
            }),
            frameRate: 10,
            repeat: -1
        });

        this.scene.anims.create({
            key: 'idle-down',
            frames: [{ key: 'playerSprite', frame: 0 }],
            frameRate: 1
        });

        // Left animations (row 1)
        this.scene.anims.create({
            key: 'walk-left',
            frames: this.scene.anims.generateFrameNumbers('playerSprite', {
                start: framesPerRow + 1,
                end: framesPerRow * 2 - 1
            }),
            frameRate: 10,
            repeat: -1
        });

        this.scene.anims.create({
            key: 'idle-left',
            frames: [{ key: 'playerSprite', frame: framesPerRow }],
            frameRate: 1
        });

        // Right animations (row 2)
        this.scene.anims.create({
            key: 'walk-right',
            frames: this.scene.anims.generateFrameNumbers('playerSprite', {
                start: framesPerRow * 2 + 1,
                end: framesPerRow * 3 - 1
            }),
            frameRate: 10,
            repeat: -1
        });

        this.scene.anims.create({
            key: 'idle-right',
            frames: [{ key: 'playerSprite', frame: framesPerRow * 2 }],
            frameRate: 1
        });

        // Up animations (row 3)
        this.scene.anims.create({
            key: 'walk-up',
            frames: this.scene.anims.generateFrameNumbers('playerSprite', {
                start: framesPerRow * 3 + 1,
                end: framesPerRow * 4 - 1
            }),
            frameRate: 10,
            repeat: -1
        });

        this.scene.anims.create({
            key: 'idle-up',
            frames: [{ key: 'playerSprite', frame: framesPerRow * 3 }],
            frameRate: 1
        });
    }

    setupControls() {
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.wasd = this.scene.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            throw: Phaser.Input.Keyboard.KeyCodes.T
        });

        // ESC key - handle specially since cursors already has it
        this.escKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // SPACE key for executing throw
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Set up key listeners for throwing mode
        this.wasd.throw.on('down', () => {
            this.enterThrowingMode();
        });

        this.escKey.on('down', () => {
            console.log('ESC pressed, throwing mode:', this.isThrowingMode);
            if (this.isThrowingMode) {
                this.exitThrowingMode();
            }
        });

        // SPACE to execute throw
        this.spaceKey.on('down', () => {
            if (this.isThrowingMode) {
                this.executeThrow();
            }
        });
    }

    enterThrowingMode() {
        if (!this.isThrowingMode) {
            this.isThrowingMode = true;
            this.throwingModeText.setVisible(true);
            console.log('Entered throwing mode - Press SPACE to throw');
            // Stop player movement
            this.scene.matter.body.setVelocity(this.body, { x: 0, y: 0 });
        }
    }

    exitThrowingMode() {
        this.isThrowingMode = false;
        this.throwingModeText.setVisible(false);
        console.log('Exited throwing mode');
    }

    executeThrow() {
        // Get direction based on where player is facing
        const directionMap = {
            'down': Math.PI / 2,      // 90 degrees (down)
            'up': -Math.PI / 2,       // -90 degrees (up)
            'left': Math.PI,          // 180 degrees (left)
            'right': 0                // 0 degrees (right)
        };

        const direction = directionMap[this.currentDirection] || 0;

        // Hardcoded values for testing
        const power = 70;    // Increased power for testing flight
        const pitch = 10;    // 10 degree launch angle

        // Set parameters and throw
        var selectedDisc = {speed: 6, glide:3, turn:-5, fade:1}
        this.disc.setThrowParameters(direction, power, pitch);
        this.disc.throw(this.body.position.x, this.body.position.y,selectedDisc,'F');

        // Keep throwing mode active, camera will follow disc
    }

    update(time, delta) {
        // Update sprite position to match physics body
        this.sprite.x = this.body.position.x;
        this.sprite.y = this.body.position.y;

        // Always update disc regardless of throwing mode
        this.disc.update(delta);

        // Handle camera following based on throwing mode and disc status
        if (this.isThrowingMode) {
            // If disc is flying, follow disc; otherwise follow player
            if (this.disc.sprite && this.disc.flyingStatus !== 'not thrown') {
                // Follow disc while it's in the air or landed
                this.scene.cameras.main.startFollow(this.disc.sprite, true, 0.1, 0.1);
            } else {
                // Follow player when disc is not thrown
                this.scene.cameras.main.startFollow(this.sprite, true, 0.1, 0.1);
            }
            
            // Play idle animation in throwing mode
            const idleKey = `idle-${this.currentDirection}`;
            if (this.sprite.anims.currentAnim?.key !== idleKey) {
                this.sprite.play(idleKey);
            }
            // Don't allow movement in throwing mode
            return;
        } else {
            // Not in throwing mode - always follow player
            this.scene.cameras.main.startFollow(this.sprite, true, 0.1, 0.1);
        }

        // Handle input for movement
        let velocityX = 0;
        let velocityY = 0;
        let isMoving = false;
        let newDirection = this.currentDirection;

        if (this.cursors.left.isDown || this.wasd.left.isDown) {
            velocityX = -this.moveForce;
            newDirection = 'left';
            isMoving = true;
        } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
            velocityX = this.moveForce;
            newDirection = 'right';
            isMoving = true;
        }

        if (this.cursors.up.isDown || this.wasd.up.isDown) {
            velocityY = -this.moveForce;
            newDirection = 'up';
            isMoving = true;
        } else if (this.cursors.down.isDown || this.wasd.down.isDown) {
            velocityY = this.moveForce;
            newDirection = 'down';
            isMoving = true;
        }

        // Update direction if changed
        if (newDirection !== this.currentDirection) {
            this.currentDirection = newDirection;
        }

        // Play appropriate animation
        if (isMoving) {
            const animKey = `walk-${this.currentDirection}`;
            if (this.sprite.anims.currentAnim?.key !== animKey) {
                this.sprite.play(animKey);
            }
        } else {
            const idleKey = `idle-${this.currentDirection}`;
            if (this.sprite.anims.currentAnim?.key !== idleKey) {
                this.sprite.play(idleKey);
            }
        }

        // Apply force to player
        if (velocityX !== 0 || velocityY !== 0) {
            this.scene.matter.applyForce(this.body, {
                x: velocityX,
                y: velocityY
            });
        }
    }

    getSprite() {
        return this.sprite;
    }

    getBody() {
        return this.body;
    }
}
