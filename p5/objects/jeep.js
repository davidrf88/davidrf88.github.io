class myJeep {

    constructor(canvas) {
      this.canvas = canvas;
    }
    preload() {
        // Preload any assets here, e.g., images or sounds
        this.img = loadImage('assets/jeep.png'); // Example asset
        this.btire = loadImage('assets/tire.png'); // Example asset
      }
    
      setup(canvas) {
        // Setup any properties for this object
        this.canvas = canvas;
        this.img.resize(0, 200);
        this.btire.resize(0,80);
        this.yPos = this.canvas.height -250;
        this.xPos = -1600;
        this.angle = 0;
        this.radius = 50;
        this.startTime = millis();
        this.continueMoving = false;
      }
      runAway(){
        this.continueMoving = true;


      }
    
      draw() {


        // push();
        // translate(this.xPos+98, (this.canvas.height / 2)+ 165);  // Move to tire position
        // rotate(this.angle);  // Apply rotation
        // imageMode(this.canvas.CENTER);
        // image(this.btire, 0, 0, (this.radius * 2)-25, (this.radius * 2) -25);  // Draw tire
        // pop();

        // push();
        // translate(this.xPos+210, (this.canvas.height / 2)+ 165);  // Move to tire position
        // rotate(this.angle);  // Apply rotation
        // imageMode(this.canvas.CENTER);
        // image(this.btire, 0, 0, (this.radius * 2)-25, (this.radius * 2) -25);  // Draw tire
        // pop();
    

        // push();
        // translate(this.xPos+40, (this.canvas.height / 2)+ 165);  // Move to tire position
        // rotate(this.angle);  // Apply rotation
        // imageMode(this.canvas.CENTER);
        // image(this.btire, 0, 0, (this.radius * 2)-25, (this.radius * 2) -25);  // Draw tire
        // pop();
        

        // push();
        // translate(this.xPos+160, (this.canvas.height / 2)+ 165);  // Move to tire position
        // rotate(this.angle);  // Apply rotation
        // imageMode(this.canvas.CENTER);
        // image(this.btire, 0, 0, (this.radius * 2)-25, (this.radius * 2) -25);  // Draw tire
        // pop();
        // this.angle += 0.18;  // Increment angle for rotation
       

      
        image(this.img, this.xPos, this.yPos);






        if(this.xPos < 30)
        {
        this.xPos += 3
        }
             
          
          if (this.continueMoving) {
            this.xPos +=5

          }
    }
  }