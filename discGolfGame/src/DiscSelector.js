export class DiscSelector {
    constructor(scene) {
        this.scene = scene;
        this.isVisible = false;
        this.selectedSlot = 0; // Currently highlighted slot (0-8)
        this.currentDiscIndex = 0; // The disc that's currently equipped
        
        // Define 9 different discs with various flight characteristics
        this.discs = [
            { name: 'Putter', speed: 2, glide: 3, turn: 0, fade: 1, image: 'disc1' },
            { name: 'Mid-Range', speed: 5, glide: 5, turn: 0, fade: 2, image: 'disc2' },
            { name: 'Fairway', speed: 7, glide: 5, turn: -1, fade: 2, image: 'disc3' },
            { name: 'Driver', speed: 11, glide: 5, turn: -2, fade: 3, image: 'disc4' },
            { name: 'Understable', speed: 9, glide: 5, turn: -3, fade: 1, image: 'disc5' },
            { name: 'Overstable', speed: 9, glide: 4, turn: 0, fade: 4, image: 'disc6' },
            { name: 'Turnover', speed: 7, glide: 6, turn: -4, fade: 0, image: 'disc7' },
            { name: 'Utility', speed: 5, glide: 2, turn: 0, fade: 4, image: 'disc8' },
            { name: 'Distance', speed: 13, glide: 5, turn: -1, fade: 3, image: 'disc9' }
        ];
        
        // UI elements container
        this.container = null;
        this.background = null;
        this.slots = [];
        this.titleText = null;
        this.instructionText = null;
        
        this.createUI();
    }
    
    createUI() {
        // Create a container for all UI elements (fixed to camera)
        this.container = this.scene.add.container(0, 0);
        this.container.setScrollFactor(0);
        this.container.setDepth(2000);
        this.container.setVisible(false);
        
        const screenWidth = this.scene.scale.width;
        const screenHeight = this.scene.scale.height;
        
        // Semi-transparent background overlay
        this.background = this.scene.add.rectangle(
            screenWidth / 2,
            screenHeight / 2,
            screenWidth,
            screenHeight,
            0x000000,
            0.8
        );
        this.container.add(this.background);
        
        // Title
        this.titleText = this.scene.add.text(
            screenWidth / 2,
            60,
            'SELECT DISC',
            {
                fontFamily: 'Retro Gaming',
                fontSize: '48px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 6,
                align: 'center'
            }
        );
        this.titleText.setOrigin(0.5, 0.5);
        this.container.add(this.titleText);
        
        // Instructions
        this.instructionText = this.scene.add.text(
            screenWidth / 2,
            screenHeight - 60,
            'Press 1-9 to select disc | Press D or ESC to close',
            {
                fontFamily: 'Retro Gaming',
                fontSize: '20px',
                color: '#cccccc',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            }
        );
        this.instructionText.setOrigin(0.5, 0.5);
        this.container.add(this.instructionText);
        
        // Create 9 disc slots in a 3x3 grid
        this.createDiscSlots();
        
        // Listen for window resize
        this.scene.scale.on('resize', this.onResize, this);
    }
    
    createDiscSlots() {
        const screenWidth = this.scene.scale.width;
        const screenHeight = this.scene.scale.height;
        
        const slotWidth = 200;
        const slotHeight = 160;
        const spacing = 20;
        const cols = 3;
        const rows = 3;
        
        const totalWidth = (slotWidth * cols) + (spacing * (cols - 1));
        const totalHeight = (slotHeight * rows) + (spacing * (rows - 1));
        
        const startX = (screenWidth - totalWidth) / 2;
        const startY = (screenHeight - totalHeight) / 2;
        
        for (let i = 0; i < 9; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            const x = startX + (col * (slotWidth + spacing));
            const y = startY + (row * (slotHeight + spacing));
            
            const slot = this.createDiscSlot(x, y, slotWidth, slotHeight, i);
            this.slots.push(slot);
        }
    }
    
    createDiscSlot(x, y, width, height, index) {
        const slot = this.scene.add.container(x, y);
        const disc = this.discs[index];
        
        // Slot background
        const bg = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x333333);
        bg.setStrokeStyle(3, 0x666666);
        slot.add(bg);
        
        // Selection highlight (hidden by default)
        const highlight = this.scene.add.rectangle(width / 2, height / 2, width, height);
        highlight.setStrokeStyle(4, 0xffff00);
        highlight.setFillStyle(0xffff00, 0.2);
        highlight.setVisible(false);
        slot.add(highlight);
        
        // Equipped indicator (hidden by default)
        const equippedIndicator = this.scene.add.text(
            width / 2,
            10,
            'EQUIPPED',
            {
                fontFamily: 'Retro Gaming',
                fontSize: '14px',
                color: '#00ff00',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        equippedIndicator.setOrigin(0.5, 0);
        equippedIndicator.setVisible(false);
        slot.add(equippedIndicator);
        
        // Disc image placeholder (colored circle for now)
        const discColor = this.getDiscColor(disc.speed);
        const discImage = this.scene.add.circle(width / 2, height / 2 - 10, 30, discColor);
        slot.add(discImage);
        
        // Disc name
        const nameText = this.scene.add.text(
            width / 2,
            height / 2 + 30,
            disc.name,
            {
                fontFamily: 'Retro Gaming',
                fontSize: '16px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3,
                align: 'center'
            }
        );
        nameText.setOrigin(0.5, 0);
        slot.add(nameText);
        
        // Flight numbers
        const flightText = this.scene.add.text(
            width / 2,
            height / 2 + 55,
            `${disc.speed} | ${disc.glide} | ${disc.turn} | ${disc.fade}`,
            {
                fontFamily: 'Retro Gaming',
                fontSize: '12px',
                color: '#aaaaaa',
                stroke: '#000000',
                strokeThickness: 2,
                align: 'center'
            }
        );
        flightText.setOrigin(0.5, 0);
        slot.add(flightText);
        
        // Slot number indicator
        const numberText = this.scene.add.text(
            10,
            10,
            `${index + 1}`,
            {
                fontFamily: 'Retro Gaming',
                fontSize: '18px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 3
            }
        );
        numberText.setOrigin(0, 0);
        slot.add(numberText);
        
        // Store references for later
        slot.background = bg;
        slot.highlight = highlight;
        slot.equippedIndicator = equippedIndicator;
        slot.index = index;
        
        this.container.add(slot);
        return slot;
    }
    
    getDiscColor(speed) {
        // Color code discs by speed
        if (speed <= 3) return 0x4444ff; // Blue - Putters
        if (speed <= 6) return 0xff4444; // Red - Mids
        if (speed <= 9) return 0xffaa44; // Orange - Fairways
        return 0xff44ff; // Magenta - Drivers
    }
    
    show() {
        if (this.isVisible) return;
        
        this.isVisible = true;
        this.container.setVisible(true);
        this.updateSlotHighlights();
    }
    
    hide() {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        this.container.setVisible(false);
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    selectDisc(index) {
        if (index < 0 || index >= this.discs.length) return;
        
        this.currentDiscIndex = index;
        this.selectedSlot = index;
        this.updateSlotHighlights();
        this.hide();
        
        return this.discs[index];
    }
    
    selectDiscByNumber(number) {
        // Number keys 1-9 correspond to indices 0-8
        const index = number - 1;
        return this.selectDisc(index);
    }
    
    updateSlotHighlights() {
        this.slots.forEach((slot, index) => {
            // Update selection highlight
            slot.highlight.setVisible(index === this.selectedSlot && this.isVisible);
            
            // Update equipped indicator
            slot.equippedIndicator.setVisible(index === this.currentDiscIndex);
        });
    }
    
    getCurrentDisc() {
        return this.discs[this.currentDiscIndex];
    }
    
    onResize(gameSize) {
        // Update positions when window resizes
        const screenWidth = gameSize.width;
        const screenHeight = gameSize.height;
        
        // Update background
        this.background.setPosition(screenWidth / 2, screenHeight / 2);
        this.background.setSize(screenWidth, screenHeight);
        
        // Update title
        this.titleText.setPosition(screenWidth / 2, 60);
        
        // Update instructions
        this.instructionText.setPosition(screenWidth / 2, screenHeight - 60);
        
        // Recreate disc slots with new positions
        this.slots.forEach(slot => slot.destroy());
        this.slots = [];
        this.createDiscSlots();
        this.updateSlotHighlights();
    }
    
    destroy() {
        this.scene.scale.off('resize', this.onResize, this);
        this.container.destroy();
    }
}
