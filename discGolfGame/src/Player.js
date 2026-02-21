import { ThrowEngine3 } from './ThrowEngine3.js';
import { DiscSelector } from './DiscSelector.js';

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
        this.disc = new ThrowEngine3(scene, x, y);

        // Create disc selector
        this.discSelector = new DiscSelector(scene);
        this.selectedDisc = this.discSelector.getCurrentDisc(); // Get initial disc
        
        // Throwing hand: 'F' for forehand, 'B' for backhand
        this.throwingHand = 'B'; // Default to backhand

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

        // Create disc info display
        this.createDiscInfoDisplay();

        // Setup animations
        this.createAnimations();

        // Setup controls
        this.setupControls();

        // Start with idle animation
        this.sprite.play('idle-down');
    }

    createDiscInfoDisplay() {
        // Create a small UI in the top-left showing current disc
        this.discInfoText = this.scene.add.text(
            10,
            10,
            '',
            {
                fontFamily: 'Retro Gaming',
                fontSize: '16px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'left'
            }
        );
        this.discInfoText.setScrollFactor(0);
        this.discInfoText.setDepth(1000);
        this.updateDiscInfoDisplay();
    }

    updateDiscInfoDisplay() {
        if (this.selectedDisc && this.discInfoText) {
            const disc = this.selectedDisc;
            const handName = this.throwingHand === 'F' ? 'Forehand' : 'Backhand';
            const handColor = this.throwingHand === 'F' ? '#ff8844' : '#44aaff';
            this.discInfoText.setText(
                `${disc.name}\n${disc.speed} | ${disc.glide} | ${disc.turn} | ${disc.fade}\n[D] Change Disc`
            );
            
            // Create or update throwing hand indicator
            if (!this.throwingHandText) {
                this.throwingHandText = this.scene.add.text(
                    10,
                    this.scene.scale.height - 80,
                    '',
                    {
                        fontFamily: 'Retro Gaming',
                        fontSize: '18px',
                        color: '#ffffff',
                        stroke: '#000000',
                        strokeThickness: 3,
                        align: 'left'
                    }
                );
                this.throwingHandText.setScrollFactor(0);
                this.throwingHandText.setDepth(1000);
            }
            
            this.throwingHandText.setText(`Hand: ${handName}\n[F] Forehand [B] Backhand`);
            this.throwingHandText.setColor(handColor);
        }
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
            throw: Phaser.Input.Keyboard.KeyCodes.T,
            discSelector: Phaser.Input.Keyboard.KeyCodes.D,
            forehand: Phaser.Input.Keyboard.KeyCodes.F,
            backhand: Phaser.Input.Keyboard.KeyCodes.B
        });

        // ESC key - handle specially since cursors already has it
        this.escKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // SPACE key for executing throw
        this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Number keys 1-9 for disc selection
        this.numberKeys = {};
        for (let i = 1; i <= 9; i++) {
            const keyCode = Phaser.Input.Keyboard.KeyCodes['ONE'] + (i - 1);
            this.numberKeys[i] = this.scene.input.keyboard.addKey(keyCode);
        }

        // Set up key listeners for throwing mode
        this.wasd.throw.on('down', () => {
            this.enterThrowingMode();
        });

        // D key for disc selector
        this.wasd.discSelector.on('down', () => {
            if (!this.isThrowingMode && !this.discSelector.isVisible) {
                this.discSelector.toggle();
            }
        });

        // F key for forehand
        this.wasd.forehand.on('down', () => {
            if (!this.discSelector.isVisible) {
                this.throwingHand = 'F';
                this.updateDiscInfoDisplay();
                console.log('Switched to Forehand');
            }
        });

        // B key for backhand
        this.wasd.backhand.on('down', () => {
            if (!this.discSelector.isVisible) {
                this.throwingHand = 'B';
                this.updateDiscInfoDisplay();
                console.log('Switched to Backhand');
            }
        });

        // Number keys for disc selection
        for (let i = 1; i <= 9; i++) {
            this.numberKeys[i].on('down', () => {
                if (this.discSelector.isVisible) {
                    const selectedDisc = this.discSelector.selectDiscByNumber(i);
                    if (selectedDisc) {
                        this.selectedDisc = selectedDisc;
                        this.updateDiscInfoDisplay();
                        console.log(`Selected disc: ${selectedDisc.name} (${selectedDisc.speed}|${selectedDisc.glide}|${selectedDisc.turn}|${selectedDisc.fade})`);
                    }
                }
            });
        }

        this.escKey.on('down', () => {
            console.log('ESC pressed, throwing mode:', this.isThrowingMode);
            if (this.discSelector.isVisible) {
                this.discSelector.hide();
            } else if (this.isThrowingMode) {
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
        const power = 100;    // Increased power for testing flight
        const pitch = 0;    // 10 degree launch angle

        // Set parameters and throw using selected disc and throwing hand
        this.disc.setThrowParameters(direction, power, pitch);
        this.disc.throw(this.body.position.x, this.body.position.y, this.selectedDisc, this.throwingHand);

        console.log(`Threw ${this.selectedDisc.name} with ${this.throwingHand === 'F' ? 'Forehand' : 'Backhand'}`);

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
            if (this.disc.sprite && this.disc.isFlying) {
                // Follow disc while it's in the air
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

        // Only allow movement when disc selector is not visible
        if (!this.discSelector.isVisible) {
            if (this.cursors.left.isDown || this.wasd.left.isDown) {
                velocityX = -this.moveForce;
                newDirection = 'left';
                isMoving = true;
            } else if (this.cursors.right.isDown) {
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
