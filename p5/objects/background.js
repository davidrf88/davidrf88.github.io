class myBackground {

    constructor() {
    }
    preload() {
        // Preload any assets here, e.g., images or sounds
        this.img = loadImage('../assets/woods.jpg'); // Example asset
      }
    
      setup() {
        // Setup any properties for this object

        this.img.resize(0, height);
        this.yPos = (height);
        this.xPos = 0;
      }
    
      draw() {
        image(this.img, this.xPos, this.yPos);
        image(this.img, this.xPos + this.img.width, this.yPos);

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