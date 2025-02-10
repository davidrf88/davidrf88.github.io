class myJeep {

    constructor(p) {
      this.p = p;
    }
    preload() {
        // Preload any assets here, e.g., images or sounds
        this.img = this.p.loadImage('/assets/jeep.png'); // Example asset
        this.btire = this.p.loadImage('/assets/tire.png'); // Example asset
      }
    
      setup() {
        // Setup any properties for this object

        this.img.resize(0, 200);
        this.btire.resize(0,80);
        this.yPos = (this.p.height/2);
        this.xPos = -1600;
        this.angle = 0;
        this.radius = 50;
        this.startTime = this.p.millis();
        this.continueMoving = false;
      }
      runAway(){
        this.continueMoving = true;


      }
    
      draw() {


        this.p.push();
        this.p.translate(this.xPos+98, (this.p.height / 2)+ 165);  // Move to tire position
        this.p.rotate(this.angle);  // Apply rotation
        this.p.imageMode(this.p.CENTER);
        this.p.image(this.btire, 0, 0, (this.radius * 2)-25, (this.radius * 2) -25);  // Draw tire
        this.p.pop();

        this.p.push();
        this.p.translate(this.xPos+210, (this.p.height / 2)+ 165);  // Move to tire position
        this.p.rotate(this.angle);  // Apply rotation
        this.p.imageMode(this.p.CENTER);
        this.p.image(this.btire, 0, 0, (this.radius * 2)-25, (this.radius * 2) -25);  // Draw tire
        this.p.pop();
    

        this.p.push();
        this.p.translate(this.xPos+40, (this.p.height / 2)+ 165);  // Move to tire position
        this.p.rotate(this.angle);  // Apply rotation
        this.p.imageMode(this.p.CENTER);
        this.p.image(this.btire, 0, 0, (this.radius * 2)-25, (this.radius * 2) -25);  // Draw tire
        this.p.pop();
        

        this.p.push();
        this.p.translate(this.xPos+160, (this.p.height / 2)+ 165);  // Move to tire position
        this.p.rotate(this.angle);  // Apply rotation
        this.p.imageMode(this.p.CENTER);
        this.p.image(this.btire, 0, 0, (this.radius * 2)-25, (this.radius * 2) -25);  // Draw tire
        this.p.pop();
        this.angle += 0.18;  // Increment angle for rotation
       

        
        this.p.image(this.img, this.xPos, this.yPos);






        if(this.xPos < 30)
        {
        this.xPos += 3
        }
             
          
          if (this.continueMoving) {
            this.xPos +=5

          }
    }
  }