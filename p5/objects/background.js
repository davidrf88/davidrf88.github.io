class myBackground {

    constructor(p) {
      this.p = p;
    }
    preload() {
        // Preload any assets here, e.g., images or sounds
        this.img = this.p.loadImage('/assets/woods.jpg'); // Example asset
      }
    
      setup() {
        // Setup any properties for this object

        this.img.resize(0, this.p.height);
        this.yPos = (this.p.height);
        this.xPos = 0;
      }
    
      draw() {
        this.p.image(this.img, this.xPos, this.yPos);
        this.p.image(this.img, this.xPos + this.img.width, this.yPos);

        this.xPos -= 5;
        //Reset the image position when it reaches the top
        if (this.yPos > 0) {
            this.yPos -= 2; 
        
        }
    
        if (this.xPos <= -this.img.width) {
            this.xPos = 0;
        }
             
          }
  }