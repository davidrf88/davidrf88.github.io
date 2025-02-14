class myIntro {

    constructor(canvas) {
        this.canvas = canvas
    }
    preload() {

        this.font = loadFont('assets/fonts/ballon.ttf');
        this.fontTitle = loadFont('assets/fonts/Main.otf');

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
        this.myButton.style("width", "150px")
        this.myButton.style("height", "30px")
        this.myButton.mousePressed(() => {this.handleClick(this)});
        this.myButton.hide()
        this.myButton.style("opacity", "0")
        this.initialX = this.canvas.height -30
        this.bouncer = false;
        this.goingDown = true;
        this.frameNo = 0;
        this.flyAway = false;
        this.moverY = -.8;
        this.lerpAmount = 0;
        this.showButton = false;
        this.buttonOpacity = 0;
        this.finished = false;

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
          y: random(height),
          speed: random(0.02, 0.05), // Different fade speeds
          size: random(2, 5) // Different star sizes
        });
      }

    //   setTimeout(() => {
    //     this.flyAway = true;
    //     this.ballons.setFlyAway()
        
    //   }, 10000);
      setTimeout(() => {
        this.showButton = true;
        
      }, 6000);
;

 


    }

    handleClick()
    {
        this.flyAway = true;
        this.ballons.setFlyAway()

        setTimeout(() => {
            this.finished = true;
        }, 5000);

    }

    flyAwayMode()
    {
        background('#050004');
        let bgColor = lerpColor(color('#050004'), color('#b6cff7'), this.lerpAmount); // Interpolate colors
        background(bgColor);
        this.lerpAmount = constrain(this.lerpAmount + 0.005, 0, 1);

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

        this.myButton.style("disabled", true)
        this.buttonOpacity = this.buttonOpacity - .02
        this.myButton.style("opacity", this.buttonOpacity)



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

            if(this.showButton)
            {
                if(this.buttonOpacity < 1)
                {
                    this.buttonOpacity = this.buttonOpacity + .02
                    this.myButton.style("opacity", this.buttonOpacity)
                    
                }

              

            
            this.myButton.position((this.canvas.position().x + 77) , this.canvas.position().y + 400)
            this.myButton.show()
            }
              

    }
}