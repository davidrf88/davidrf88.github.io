class myBackground {

    preload() {
        // Preload any assets here, e.g., images or sounds
        //this.img = loadImage('assets/woods.jpg'); // Example asset
        this.mountain = loadImage('assets/mountains.png')
        this.clouds = loadImage('assets/clouds.png')
        this.grass = loadImage('assets/grass.png')
        this.trees = loadImage('assets/trees.png')
      }
    
      setup(canvas) {
        this.canvas = canvas;
        // Setup any properties for this object

        this.mountain.resize(0, this.canvas.height);
        this.grass.resize(0, this.canvas.height - 300);
        this.clouds.resize(0, this.canvas.height );
        this.trees.resize(0, this.canvas.height );
        this.mountainYPos = (this.canvas.height+100);
        this.mountainXPos = 0;
        this.mountainSpeed = .3

        this.grassYPos = (this.canvas.height) + 300;
        this.grassXPos = 0;
        this.grassSpeed = 5

        this.cloudsYPos = (this.canvas.height) +100;
        this.cloudsXPos = 0;
        this.cloudsSpeed = 7

        this.treesYPos = (this.canvas.height) +100;
        this.treesXPos = 0;
        this.treesSpeed = 6
      }
    
      draw() {
        image(this.mountain, this.mountainXPos, this.mountainYPos);
        image(this.mountain, this.mountainXPos + this.mountain.width, this.mountainYPos);
        this.mountainXPos -= this.mountainSpeed;
        //Reset the image position when it reaches the top
        if (this.mountainYPos > 100) {
            this.mountainYPos -= 2; 
        }
        if (this.mountainXPos <= -this.mountain.width) {
            this.mountainXPos = 0;
        }


        image(this.clouds, this.cloudsXPos, this.cloudsYPos);
        image(this.clouds, this.cloudsXPos + this.clouds.width, this.cloudsYPos);
        this.cloudsXPos -= this.cloudsSpeed;
        //Reset the image position when it reaches the top
        if (this.cloudsYPos > 100) {
            this.cloudsYPos -= 2; 
        }
        if (this.cloudsXPos <= -this.clouds.width) {
            this.cloudsXPos = 0;
        }


        image(this.trees, this.treesXPos, this.treesYPos);
        image(this.trees, this.treesXPos + this.trees.width, this.treesYPos);
        this.treesXPos -= this.treesSpeed;
        //Reset the image position when it reaches the top
        if (this.treesYPos > 100) {
            this.treesYPos -= 2; 
        }
        if (this.treesXPos <= -this.trees.width) {
            this.treesXPos = 0;
        }
        

        image(this.grass, this.grassXPos, this.grassYPos);
        image(this.grass, this.grassXPos + this.grass.width, this.grassYPos);
        this.grassXPos -= this.grassSpeed;
        //Reset the image position when it reaches the top
        if (this.grassYPos > 300) {
            this.grassYPos -= 2; 
        }
        if (this.grassXPos <= -this.grass.width) {
            this.grassXPos = 0;
        }
             
          }
  }