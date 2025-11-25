import { DiscConfig } from './DiscConfig.js';

export class Disc {
    constructor(scene, x, y) {
        this.scene = scene;
        
        // Throw parameters
        this.direction = 0;  // Angle in radians (0 = right, PI/2 = down, etc.)
        this.power = 0;      // Power/force of throw (0-100)
        this.angle = 0;      // Launch angle in degrees (for arc trajectory)
        this.hand = 'R';     // Throwing hand: 'R' (backhand/right) or 'F' (forehand)
        
        // Disc state
        this.flyingStatus = 'not thrown';
        this.isFlying = false;
        this.sprite = null;
        this.velocity = { x: 0, y: 0 };
        this.flyingTime = 0;
        this.throwStartTime = 0;
        this.elapsedTime = 0;
        this.currentAngle = 0; // Current disc angle during flight (changes based on turn)
        
        // Disc characteristics
        this.discCharacteristics = {
            speed: 0,
            glide: 0,
            turn: 0,
            fade: 0
        };
    }

    /**
     * Set the throw parameters
     * @param {number} direction - Direction angle in radians
     * @param {number} power - Throw power (0-100)
     * @param {number} angle - Launch angle in degrees (-45 to 45)
     */
    setThrowParameters(direction, power, angle) {
        this.direction = direction;
        this.power = Math.max(0, Math.min(100, power)); // Clamp 0-100
        this.angle = Math.max(DiscConfig.angle.clamp.min, Math.min(DiscConfig.angle.clamp.max, angle));
    }

    /**
     * Execute the throw with current parameters
     * @param {number} startX - Starting X position
     * @param {number} startY - Starting Y position
     * @param {Object} disc - Disc characteristics object {speed, glide, turn, fade}
     * @param {string} hand - Throwing hand: 'R' (backhand/right) or 'F' (forehand)
     */
    throw(startX, startY, disc = null, hand = 'R') {
        // Save hand
        this.hand = hand;
        
        // Save disc characteristics if provided
        // For forehand (F), invert turn and fade
        const handMultiplier = hand === 'F' ? -1 : 1;
        
        if (disc) {
            this.discCharacteristics = {
                speed: disc.speed || 0,
                glide: disc.glide || 0,
                turn: (disc.turn || 0) * handMultiplier,
                fade: (disc.fade || 0) * handMultiplier
            };
        }
        
        // Create disc sprite if it doesn't exist
        if (!this.sprite) {
            const discGraphics = this.scene.add.graphics();
            discGraphics.fillStyle(0xff0000, 1);
            discGraphics.fillCircle(8, 8, 8);
            discGraphics.lineStyle(2, 0xffffff, 1);
            discGraphics.strokeCircle(8, 8, 8);
            discGraphics.generateTexture('disc', 16, 16);
            discGraphics.destroy();

            this.sprite = this.scene.add.sprite(startX, startY, 'disc');
        } else {
            this.sprite.setPosition(startX, startY);
            this.sprite.setVisible(true);
        }

        this.isFlying = true;
        this.flyingStatus = 'started';
        this.throwStartTime = Date.now();
        this.calculateFlyingTime();
        
        // Initialize current angle with the throw angle
        this.currentAngle = this.angle;

        console.log(`Disc thrown - Direction: ${(this.direction * 180 / Math.PI).toFixed(1)}°, Speed: ${this.discCharacteristics.speed}, Initial Angle: ${this.angle}°, Hand: ${this.hand}`);
    }

    /**
     * Update the disc position and state
     */
    update() {
        this.updateFlyingPhase();
        
        // Handle disc visibility and position based on status
        if (this.sprite) {
            if (this.flyingStatus === 'not thrown') {
                // Disc is not displayed
                this.sprite.setVisible(false);
            } else if (this.flyingStatus === 'started' || this.flyingStatus === 'turn_beginning' || 
                       this.flyingStatus === 'turn_mid' || this.flyingStatus === 'turn_end' || 
                       this.flyingStatus === 'fading') {
               this.updateDiscPosition()
            } else if (this.flyingStatus === 'ended') {
                // Disc is visible but stopped moving
                this.sprite.setVisible(true);
            }
        }
    }

    /**
     * Get current throw parameters
     */
    getThrowParameters() {
        return {
            direction: this.direction,
            power: this.power,
            angle: this.angle
        };
    }


    calculateFlyingTime(){
        const baseFlyingTime = DiscConfig.flyingTime.base;
        
        // Power factor: prorate based on power (0-100)
        const powerFactor = this.power / 100;
        
        // Angle factor: higher angle = less flying time
        const normalizedAngle = Math.abs(this.angle) / DiscConfig.angle.clamp.max;
        const angleFactor = 1 - (normalizedAngle * DiscConfig.flyingTime.angleReduction);
        
        // Glide factor: affects flying time
        const baseGlide = DiscConfig.glide.base;
        const glide = this.discCharacteristics.glide || baseGlide;
        const glideBonus = ((glide - baseGlide) / 3) * DiscConfig.glide.maxBonus;
        
        // Calculate final flying time
        this.flyingTime = (baseFlyingTime * powerFactor * angleFactor) + glideBonus;
        
        return this.flyingTime;
    }

    updateFlyingPhase(){
        if (this.flyingStatus === 'not thrown') {
            return;
        }

        // Calculate elapsed time in seconds
        this.elapsedTime = (Date.now() - this.throwStartTime) / 1000;

        if (this.flyingStatus === 'started') {
            // Immediately move to beginning of turn phase
            this.flyingStatus = 'turn_beginning';
        } else if (this.flyingStatus === 'turn_beginning') {
            const turningDuration = this.flyingTime * DiscConfig.phases.turning;
            const turnBeginningEnd = turningDuration * DiscConfig.phases.turnPhases.beginning;
            if (this.elapsedTime >= turnBeginningEnd) {
                this.flyingStatus = 'turn_mid';
            }
        } else if (this.flyingStatus === 'turn_mid') {
            const turningDuration = this.flyingTime * DiscConfig.phases.turning;
            const turnMidEnd = turningDuration * (DiscConfig.phases.turnPhases.beginning + DiscConfig.phases.turnPhases.mid);
            if (this.elapsedTime >= turnMidEnd) {
                this.flyingStatus = 'turn_end';
            }
        } else if (this.flyingStatus === 'turn_end') {
            const turningDuration = this.flyingTime * DiscConfig.phases.turning;
            if (this.elapsedTime >= turningDuration) {
                this.flyingStatus = 'fading';
            }
        } else if (this.flyingStatus === 'fading') {
            if (this.elapsedTime >= this.flyingTime) {
                this.flyingStatus = 'ended';
                this.isFlying = false;
            }
        } else if (this.flyingStatus === 'ended') {
            if (this.elapsedTime >= this.flyingTime + DiscConfig.flyingTime.endedDelay) {
                this.flyingStatus = 'not thrown';
                if (this.sprite) {
                    this.sprite.setVisible(false);
                }
            }
        }
    }

    updateDiscPosition(){
        // Disc is visible and moving
        this.sprite.setVisible(true);
        
        // Calculate speed multiplier based on disc speed characteristic
        const baseSpeed = DiscConfig.speed.base;
        const speedMultiplier = (this.discCharacteristics.speed || baseSpeed) / baseSpeed;
        
        // Apply speed to movement
        const moveSpeed = DiscConfig.speed.baseMovement * speedMultiplier;
        
        // Calculate base direction movement
        let moveX = Math.cos(this.direction) * moveSpeed;
        let moveY = Math.sin(this.direction) * moveSpeed;
        
        // Apply turn during turning phases
        if (this.flyingStatus === 'turn_beginning' || this.flyingStatus === 'turn_mid' || this.flyingStatus === 'turn_end') {
            const baseTurn = DiscConfig.turn.base;
            const turn = this.discCharacteristics.turn || baseTurn;
            
            // Calculate angle change rate based on turn
            // More negative turn = more angle increase (flip to anhyzer)
            // More positive turn = less angle change
            const angleChangeRate = (-turn / 5) * DiscConfig.turn.angleChangeRate;
            
            // Apply phase-specific angle change intensity
            let phaseMultiplier = 1.0;
            if (this.flyingStatus === 'turn_beginning') {
                phaseMultiplier = DiscConfig.turn.phases.beginning;
            } else if (this.flyingStatus === 'turn_mid') {
                phaseMultiplier = DiscConfig.turn.phases.mid;
            } else if (this.flyingStatus === 'turn_end') {
                phaseMultiplier = DiscConfig.turn.phases.end;
            }
            
            // Apply power-based multiplier
            const basePower = DiscConfig.power.base;
            const powerRatio = this.power / basePower;
            let powerTurnMultiplier;
            if (this.power >= basePower) {
                powerTurnMultiplier = 1.0 + ((this.power - basePower) / (100 - basePower)) * DiscConfig.power.exaggerationFactor;
            } else {
                powerTurnMultiplier = powerRatio;
            }
            
            // Update current angle based on turn characteristic
            this.currentAngle += angleChangeRate * phaseMultiplier * powerTurnMultiplier;
            // Clamp angle to reasonable range
            this.currentAngle = Math.max(DiscConfig.angle.range.min, Math.min(DiscConfig.angle.range.max, this.currentAngle));
            
            // Move disc based on current angle
            const angleTurnStrength = this.currentAngle / DiscConfig.angle.range.max;
            const perpAngle = this.direction + Math.PI / 2;
            const angleTurnForce = DiscConfig.movement.angleTurnForce * angleTurnStrength;
            
            moveX += Math.cos(perpAngle) * angleTurnForce * moveSpeed;
            moveY += Math.sin(perpAngle) * angleTurnForce * moveSpeed;
        }
        
        // Apply fade during turn_end and fading phases
        if (this.flyingStatus === 'turn_end' || this.flyingStatus === 'fading') {
            const baseFade = DiscConfig.fade.base;
            const fade = this.discCharacteristics.fade || baseFade;
            
            // Fade always reduces angle gradually
            const fadeStrength = fade / DiscConfig.fade.range.max;
            
            // Decrease angle based on fade strength
            const angleDecreaseRate = fadeStrength * DiscConfig.fade.angleDecreaseRate;
            this.currentAngle -= angleDecreaseRate;
            this.currentAngle = Math.max(DiscConfig.angle.range.min, this.currentAngle);
            
            // Move disc based on current angle after fade adjustment
            const angleTurnStrength = this.currentAngle / DiscConfig.angle.range.max;
            const perpAngle = this.direction + Math.PI / 2;
            const angleTurnForce = DiscConfig.movement.angleTurnForce * angleTurnStrength;
            
            moveX += Math.cos(perpAngle) * angleTurnForce * moveSpeed;
            moveY += Math.sin(perpAngle) * angleTurnForce * moveSpeed;
        }
        
        this.sprite.x += moveX;
        this.sprite.y += moveY;
    }

}
