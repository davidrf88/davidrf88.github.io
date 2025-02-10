class myIntro {

    constructor() {

    }
    preload() {

        this.font = loadFont('/assets/fonts/ballon.ttf');
        this.fontTitle = loadFont('/assets/fonts/main.otf');

    }

    
    setup(canvas) {
        this.canvas = canvas;
        // Setup any properties for this object
        this.myButton = createButton("empezar");

        // Add styles using .style()
        this.myButton.style("background-color", "#4CAF50");
        this.myButton.style("color", "white");
        this.myButton.style("border", "none");
        this.myButton.style("padding", "3px 6px");
        this.myButton.style("font-size", "12px");
        this.myButton.style("border-radius", "5px");
        this.myButton.style("cursor", "pointer");
        this.myButton.mousePressed(() => {this.handleClick(this)});
        this.myButton.hide()
        this.initialX = this.canvas.height -30
        this.bouncer = false;
        this.goingDown = true;
        this.frameNo = 0;
        this.flyAway = false;
        this.moverY = -.5;
        this.lerpAmount = 0;

        console.log(this.font)
        textFont(this.font);
        textSize(120)
        fill('#851818'); 
        textAlign(CENTER, CENTER);
        

       
        this.letterX = 60
        this.letterY = 200;
       this.ballons = new myBallons(this.p,"X",90,180, 30)
       this.ballons.setup()

       this.titlex =width/1.9
       this.titley = 60

       this.numStars = 150
       this.stars = [];
       for (let i = 0; i < this.numStars; i++) {
        this.stars.push({
          x: random(width + 500),
          y: random(height + 300),
          speed: random(0.02, 0.05), // Different fade speeds
          size: random(2, 5) // Different star sizes
        });
      }

      setTimeout(() => {
        this.flyAway = true;
        this.ballons.setFlyAway()
        
      }, 15000);

      setTimeout(() => {
       // remove();  // Clean up the current sketch
        new p5(sketch1); // Start the second sketch
        
      }, 25000);

 


    }

    flyAwayMode()
    {
        background('#050004');
        let bgColor = lerpColor(color('#050004'), color('#a2d9ff'), this.lerpAmount); // Interpolate colors
        background(bgColor);
        this.lerpAmount = constrain(this.lerpAmount + 0.002, 0, 1);

        this.titley = this.titley + this.moverY;
        this.titlex = this.titlex + this.moverY;
        


        for (let star of this.stars) {
            let alpha = map(sin(frameCount * star.speed), -1, 1, 50, 255); // Fade in & out
            star.y += (this.moverY * 3);
            star.x += (this.moverY * 3);
            fill(255, 255, 200, alpha); // Yellowish white with transparency
            noStroke();
            ellipse(star.x, star.y, star.size);
        }
       

        push();
        
        textFont(this.fontTitle)
        textSize(60)
        fill('#B1B1B1'); 
        text("Cumpleaños de ", this.titlex,this.titley)
        pop();
        this.ballons.draw()



    }


    draw() {

            if( this.flyAway)
            {
                this.flyAwayMode()
                return;
            }




        background('#050004');
           


            for (let star of this.stars) {
                let alpha = map(sin(frameCount * star.speed), -1, 1, 50, 255); // Fade in & out
                
                fill(255, 255, 200, alpha); // Yellowish white with transparency
                noStroke();
                ellipse(star.x, star.y, star.size);
            }
           

            push();
            
            textFont(this.fontTitle)
            textSize(60)
            fill('#B1B1B1'); 
            text("Cumpleaños de ", this.titlex,this.titley)
            pop();
            this.ballons.draw()

              

    }
}