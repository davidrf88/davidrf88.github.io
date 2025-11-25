export class VirtualJoystick {
    constructor(scene) {
        this.scene = scene;
        this.base = null;
        this.thumb = null;
        this.isActive = false;
        this.direction = { x: 0, y: 0 };
        this.startPos = { x: 0, y: 0 };
        
        this.createJoystick();
        this.setupInput();
    }

    createJoystick() {
        const baseSize = 120;
        const thumbSize = 60;
        const margin = 40;

        // Create base (outer circle) - centered properly
        const baseGraphics = this.scene.add.graphics();
        baseGraphics.fillStyle(0x888888, 0.3);
        baseGraphics.fillCircle(baseSize / 2, baseSize / 2, baseSize / 2);
        baseGraphics.lineStyle(3, 0xffffff, 0.5);
        baseGraphics.strokeCircle(baseSize / 2, baseSize / 2, baseSize / 2);
        baseGraphics.generateTexture('joystick_base', baseSize, baseSize);
        baseGraphics.destroy();

        // Create thumb (inner circle) - centered properly
        const thumbGraphics = this.scene.add.graphics();
        thumbGraphics.fillStyle(0xffffff, 0.7);
        thumbGraphics.fillCircle(thumbSize / 2, thumbSize / 2, thumbSize / 2);
        thumbGraphics.lineStyle(2, 0xcccccc, 0.8);
        thumbGraphics.strokeCircle(thumbSize / 2, thumbSize / 2, thumbSize / 2);
        thumbGraphics.generateTexture('joystick_thumb', thumbSize, thumbSize);
        thumbGraphics.destroy();

        // Position joystick at bottom-left
        const x = margin + baseSize / 2;
        const y = this.scene.scale.height - margin - baseSize / 2;

        this.base = this.scene.add.image(x, y, 'joystick_base');
        this.base.setScrollFactor(0);
        this.base.setDepth(1000);

        this.thumb = this.scene.add.image(x, y, 'joystick_thumb');
        this.thumb.setScrollFactor(0);
        this.thumb.setDepth(1001);

        this.baseX = x;
        this.baseY = y;
        this.maxDistance = baseSize / 2 - thumbSize / 4;
    }

    setupInput() {
        this.scene.input.on('pointerdown', (pointer) => {
            const distance = Phaser.Math.Distance.Between(
                pointer.x, 
                pointer.y, 
                this.baseX, 
                this.baseY
            );

            if (distance < 100) {
                this.isActive = true;
                this.startPos.x = pointer.x;
                this.startPos.y = pointer.y;
            }
        });

        this.scene.input.on('pointermove', (pointer) => {
            if (this.isActive) {
                const deltaX = pointer.x - this.baseX;
                const deltaY = pointer.y - this.baseY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                if (distance > this.maxDistance) {
                    const angle = Math.atan2(deltaY, deltaX);
                    this.thumb.x = this.baseX + Math.cos(angle) * this.maxDistance;
                    this.thumb.y = this.baseY + Math.sin(angle) * this.maxDistance;
                    
                    this.direction.x = Math.cos(angle);
                    this.direction.y = Math.sin(angle);
                } else {
                    this.thumb.x = pointer.x;
                    this.thumb.y = pointer.y;
                    
                    this.direction.x = deltaX / this.maxDistance;
                    this.direction.y = deltaY / this.maxDistance;
                }
            }
        });

        this.scene.input.on('pointerup', () => {
            if (this.isActive) {
                this.isActive = false;
                this.thumb.x = this.baseX;
                this.thumb.y = this.baseY;
                this.direction.x = 0;
                this.direction.y = 0;
            }
        });
    }

    getDirection() {
        return this.direction;
    }

    isPressed() {
        return this.isActive;
    }

    destroy() {
        if (this.base) this.base.destroy();
        if (this.thumb) this.thumb.destroy();
    }
}
