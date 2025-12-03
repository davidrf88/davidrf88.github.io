export class ThrowEngine3 {
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
        this.discSpeed = 5;
        this.discGlide = 5;
        this.discTurn = 0;
        this.discFade = 3;
        
        // Physics constants
        this.drag = 0.990; // Velocity multiplier per frame (loses 0.5% speed each frame)
        this.minVelocity = 0.5; // Minimum velocity threshold - disc stops when slower than this
        this.turnVelocityThreshold = 9.0; // Turn only affects angle when velocity is above this
        this.fadeVelocityThreshold = 6.0; // Fade only affects angle when velocity is below this
        
        // Distance tracking
        this.startX = 0;
        this.startY = 0;
        this.distanceText = null;
        this.angleText = null;
        this.pixelsPerFoot = 4; // Scale: 4 pixels = 1 foot (adjust this to change distance scale)
        
        // End state tracking
        this.endTime = 0;
        this.endDelay = 5000; // 5 seconds
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
        this.startX = startX;
        this.startY = startY;
        
        // Save disc parameters
        this.discSpeed = disc ? (disc.speed || 5) : 5;
        this.discGlide = disc ? (disc.glide || 5) : 5;
        this.discTurn = disc ? (disc.turn || 0) : 0;
        this.discFade = disc ? (disc.fade || 3) : 3;
        
        // Calculate air drag based on disc speed
        // Higher speed (1-15) = less drag = flies farther
        // Speed 1 (putter): more drag, stops quickly
        // Speed 13 (driver): less drag, flies far
        const minDrag = 0.990;   // Slowest disc (speed 1)
        const maxDrag = 0.998;  // Fastest disc (speed 15)
        const speedFactor = (this.discSpeed - 1) / 14; // Normalize 1-15 to 0-1
        this.drag = minDrag + (maxDrag - minDrag) * speedFactor;
        
        // Simple initial velocity
        const initialSpeed = 8.0;
        this.vx = Math.cos(this.direction) * initialSpeed;
        this.vy = Math.sin(this.direction) * initialSpeed;
        
        // Store initial throw direction for backward flight check
        this.initialDirection = this.direction;
        
        // Create sprite if needed
        if (!this.sprite) {
            const graphics = this.scene.add.graphics();
            graphics.fillStyle(0xff0000, 1);
            graphics.fillCircle(8, 8, 8);
            graphics.generateTexture('disc3', 16, 16);
            graphics.destroy();
            
            this.sprite = this.scene.add.sprite(startX, startY, 'disc3');
        } else {
            this.sprite.setPosition(startX, startY);
        }
        
        // Create distance display text if needed
        if (!this.distanceText) {
            this.distanceText = this.scene.add.text(0, 0, '', {
                fontFamily: 'Retro Gaming',
                fontSize: '20px',
                color: '#00ff00',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            });
            this.distanceText.setOrigin(0.5, 1.5);
            this.distanceText.setDepth(1001);
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
            this.angleText.setOrigin(0.5, 3);
            this.angleText.setDepth(1001);
        }
        
        this.sprite.setVisible(true);
        this.distanceText.setVisible(true);
        this.angleText.setVisible(true);
        this.isFlying = true;
        this.flyingStatus = 'flying';
        this.endTime = 0;
        
        console.log(`ThrowEngine3: Throw started`);
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
            
            if (this.sprite) {
                this.sprite.setVisible(true);
            }
            
            if (elapsed >= this.endDelay) {
                this.flyingStatus = 'not thrown';
                if (this.sprite) {
                    this.sprite.setVisible(false);
                }
                if (this.distanceText) {
                    this.distanceText.setVisible(false);
                }
                if (this.angleText) {
                    this.angleText.setVisible(false);
                }
                this.isFlying = false;
                console.log('Disc reset to not thrown state');
            }
            return;
        }
        
        if (!this.isFlying) return;
        
        // Calculate current speed
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        
        // Calculate distance from start (in pixels)
        const dx = this.x - this.startX;
        const dy = this.y - this.startY;
        const distancePixels = Math.sqrt(dx * dx + dy * dy);
        
        // Convert to feet using scale
        const distanceFeet = distancePixels / this.pixelsPerFoot;
        
        // Update distance text
        if (this.distanceText) {
            this.distanceText.setPosition(this.x, this.y);
            this.distanceText.setText(`${Math.round(distanceFeet)}ft`);
        }
        
        // Update angle text
        if (this.angleText) {
            this.angleText.setPosition(this.x, this.y);
            this.angleText.setText(`${Math.round(this.angle)}°`);
        }
        
        // Stop if velocity is below threshold
        if (speed < this.minVelocity) {
            this.vx = 0;
            this.vy = 0;
            this.isFlying = false;
            this.flyingStatus = 'ended';
            console.log(`Disc stopped at ${Math.round(distanceFeet)}ft`);
            return;
        }
        
        // Check if disc is moving backwards relative to initial throw direction
        const flightDirection = Math.atan2(this.vy, this.vx);
        const directionDifference = flightDirection - this.initialDirection;
        
        // Normalize angle difference to -π to π
        let normalizedDiff = directionDifference;
        while (normalizedDiff > Math.PI) normalizedDiff -= 2 * Math.PI;
        while (normalizedDiff < -Math.PI) normalizedDiff += 2 * Math.PI;
        
        // If disc is moving more than 90 degrees away from initial direction, stop it
        if (Math.abs(normalizedDiff) > Math.PI / 2) {
            this.vx = 0;
            this.vy = 0;
            this.isFlying = false;
            this.flyingStatus = 'ended';
            console.log(`Disc stopped - moving backwards at ${Math.round(distanceFeet)}ft`);
            return;
        }
        
        // Apply turn effect - modifies angle based on speed and turn rating
        // Turn only affects angle when velocity is high enough
        if (speed > this.turnVelocityThreshold) {
            // Higher speed = more turn effect
            // Turn rating: negative = understable (angle increases), positive = overstable (angle decreases)
            const turnEffect = -this.discTurn * 0.06; // Reduced from 0.1 to 0.02 for gentler turn
            this.angle += turnEffect;
        }
        
        // Apply fade effect - modifies angle at low speeds (opposite of turn)
        // Fade only affects angle when velocity is low
        if (speed < this.fadeVelocityThreshold && speed > this.minVelocity) {
            // Fade makes disc hook back (decreases angle for RHBH)
            // Higher fade rating = stronger hook
            const fadeEffect = this.discFade * 0.04; // Positive fade decreases angle (hooks left for RHBH)
            this.angle -= fadeEffect;
        }
        
        // Apply angle effect - creates lateral movement
        // Positive angle = curve right, negative angle = curve left
        // Get perpendicular direction to current velocity (for lateral movement)
        const currentDirection = Math.atan2(this.vy, this.vx);
        const perpendicularDirection = currentDirection + Math.PI / 2; // 90 degrees to the right
        
        // Apply lateral force based on angle
        const lateralForce = this.angle * 0.002; // Reduced from 0.01 to 0.002 for gentler curves
        this.vx += Math.cos(perpendicularDirection) * lateralForce;
        this.vy += Math.sin(perpendicularDirection) * lateralForce;
        
        // Apply drag to gradually slow down the disc
        this.vx *= this.drag;
        this.vy *= this.drag;
        
        // Update position
        this.x += this.vx;
        this.y += this.vy;
        
        // Update sprite position
        if (this.sprite) {
            this.sprite.setPosition(this.x, this.y);
        }
    }
}
