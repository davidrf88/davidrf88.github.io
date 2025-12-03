export class ThrowEngine2 {
    constructor(scene, x, y) {
        this.scene = scene;
        this.sprite = null;
        this.isFlying = false;
        this.flyingStatus = 'not thrown';
        
        // Position and velocity
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        
        // Disc characteristics
        this.discSpeed = 5; // Default mid-range speed
        this.discTurn = 0; // Turn rating (-5 to 1)
        this.currentAngle = 0; // Current pitch angle (-90 to 90 degrees)
        
        // End state tracking
        this.endTime = 0; // Time when disc stopped flying
        this.endDelay = 5000; // Wait 5 seconds before changing to 'not thrown' (in milliseconds)
    }

    /**
     * Set the throw parameters
     */
    setThrowParameters(direction, power, angle) {
        this.direction = direction;
        this.power = power;
        this.angle = angle;
    }

    /**
     * Execute the throw
     */
    throw(startX, startY, disc, hand) {
        // Set starting position
        this.x = startX;
        this.y = startY;
        
        // Save disc speed (higher speed = less drag)
        this.discSpeed = disc ? (disc.speed || 5) : 5;
        
        // Save disc turn (-5 understable to 1 overstable)
        this.discTurn = disc ? (disc.turn || 0) : 0;
        
        // Save initial angle (pitch at release)
        this.currentAngle = this.angle || 0;
        
        // Calculate initial velocity from direction
        const initialSpeed = 5; // Base initial speed
        this.vx = Math.cos(this.direction) * initialSpeed;
        this.vy = Math.sin(this.direction) * initialSpeed;
        
        // Create sprite if needed
        if (!this.sprite) {
            const graphics = this.scene.add.graphics();
            graphics.fillStyle(0xff0000, 1);
            graphics.fillCircle(8, 8, 8);
            graphics.generateTexture('disc2', 16, 16);
            graphics.destroy();
            
            this.sprite = this.scene.add.sprite(startX, startY, 'disc2');
        } else {
            this.sprite.setPosition(startX, startY);
        }
        
        // Create angle display text if needed
        if (!this.angleText) {
            this.angleText = this.scene.add.text(0, 0, '', {
                fontFamily: 'Retro Gaming',
                fontSize: '16px',
                color: '#ffff00',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            });
            this.angleText.setOrigin(0.5, 1.5);
            this.angleText.setDepth(1001);
        }
        
        this.sprite.setVisible(true);
        this.isFlying = true;
        this.flyingStatus = 'flying';
        this.endTime = 0; // Reset end time
        
        console.log(`ThrowEngine2: Speed ${this.discSpeed}, Turn ${this.discTurn}, initial angle ${this.currentAngle.toFixed(1)}°`);
    }

    /**
     * Update disc position
     */
    update(delta) {
        // Handle 'ended' state - wait 5 seconds before changing to 'not thrown'
        if (this.flyingStatus === 'ended') {
            if (this.endTime === 0) {
                this.endTime = Date.now();
            }
            const elapsed = Date.now() - this.endTime;
            
            // Keep sprite visible during the wait period
            if (this.sprite) {
                this.sprite.setVisible(true);
            }
            
            if (elapsed >= this.endDelay) {
                this.flyingStatus = 'not thrown';
                if (this.sprite) {
                    this.sprite.setVisible(false);
                }
                if (this.angleText) {
                    this.angleText.setVisible(false);
                }
                console.log('Disc reset to not thrown state');
            }
            return;
        }
        
        if (!this.isFlying) return;
        
        // Calculate drag based on disc speed
        // Higher speed (thinner disc) = less drag
        // Speed range typically 1-15, so normalize it
        const baseDrag = 0.995; // Base drag multiplier per frame (0.5% speed loss)
        const speedFactor = this.discSpeed / 15; // Normalize to 0-1 range
        const speedDragMultiplier = baseDrag + (speedFactor * 0.004); // Range: 0.995 to 0.999
        
        // Calculate drag based on angle (pitch)
        // Flat angle (0°) = no additional drag
        // Extreme angles (±90°) = maximum additional drag
        const angleAbsolute = Math.abs(this.currentAngle);
        const angleFactor = angleAbsolute / 90; // Normalize to 0-1 (0° = 0, 90° = 1)
        const angleExtraDrag = angleFactor * 0.01; // Up to 1% additional drag at 90°
        const angleDragMultiplier = 1.0 - angleExtraDrag; // Range: 1.0 to 0.99
        
        // Combine speed-based and angle-based drag
        const totalDragMultiplier = speedDragMultiplier * angleDragMultiplier;
        
        // Apply drag to velocity
        this.vx *= totalDragMultiplier;
        this.vy *= totalDragMultiplier;
        
        // Calculate current speed (needed for turn calculation)
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        
        // Update angle based on turn parameter
        // Turn range: -5 (very understable, angle increases) to 1 (overstable, angle decreases)
        // Negative turn = angle increases (disc flips up)
        // Positive turn = angle decreases (disc fights back down)
        // 0 = neutral (angle stays relatively stable)
        // Speed affects turn: faster disc = more turn effect, slower disc = less turn effect
        const initialSpeed = 5; // Reference to initial speed
        const speedRatio = currentSpeed / initialSpeed; // 0 to 1+ (1 = full speed)
        const angleChangeRate = -this.discTurn * 0.1 * speedRatio; // Rate per frame scaled by speed
        this.currentAngle += angleChangeRate;
        
        // Clamp angle to -90 to 90 range
        this.currentAngle = Math.max(-90, Math.min(90, this.currentAngle));

        
        // Stop if velocity is too low (minimum flight speed threshold)
        const minSpeed = 2.2; // Disc stops when speed drops below this
        if (currentSpeed < minSpeed) {
            this.isFlying = false;
            this.flyingStatus = 'ended';
            this.endTime = Date.now(); // Record when disc stopped
            if (this.angleText) {
                this.angleText.setVisible(false);
            }
            console.log(`Disc stopped at (${this.x.toFixed(1)}, ${this.y.toFixed(1)}) - speed: ${currentSpeed.toFixed(2)}`);
            console.log('Waiting 5 seconds before reset...');
            return;
        }
        
        // Move in straight line
        this.x += this.vx;
        this.y += this.vy;
        
        // Update sprite position
        if (this.sprite) {
            this.sprite.x = this.x;
            this.sprite.y = this.y;
        }
        
        // Update angle text position and content
        if (this.angleText) {
            this.angleText.setVisible(true);
            this.angleText.setPosition(this.x, this.y);
            this.angleText.setText(`${this.currentAngle.toFixed(1)}°`);
        }
    }
}
