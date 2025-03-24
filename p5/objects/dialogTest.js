class myDialogTest {

    constructor(canvas) {
        this.canvas = canvas;
    }
    preload() {
        // Preload any assets here, e.g., images or sounds
        this.img = loadImage('assets/dialog.png'); // Example asset
        this.btnImg = loadImage('assets/button.png'); // Example asset
        this.miguel = loadImage('assets/Miguel.png'); // Example asset
        this.mateo = loadImage('assets/Mateo.png'); // Example asset
        this.fontTitle = loadFont('assets/fonts/Main.otf');

    }

    
    setup(canvas) {
        this.canvas = canvas;
        // Setup any properties for this object
        console.log('canvas obj', canvas.position())

        this.img.resize(this.canvas.width - 20, 0);
        this.mateo.resize(this.canvas.width - 240, 0);
        this.miguel.resize(this.canvas.width - 240, 0);
        this.canvas = canvas;
    
        this.yPos = 130;
        this.xPos = 10;
        this.startTime = millis();
        this.dialogStart = 18000
        this.kidImg = this.mateo
        this.show = true;
        this.step = 1;
        this.myButton = createButton("continuar");

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

    }

     handleClick(that) {
        console.log("Button clicked!" + that.step);
        that.step++;
      }

      getStep()
    {
        return this.step;
    }

    draw() {

        // Check if 10 seconds (10,000 milliseconds) have passed
        if ( this.show && millis() - this.startTime >= this.dialogStart) {
            image(this.img, this.xPos, this.yPos);
           
            
            if (this.step == 1) {
                this.kidImg = this.mateo
                this.dialogText = "¡Hey Miguel! \n¿Seguro que vamos por \n el camino correcto?"
                this.myButton.position(this.canvas.position().x + this.xPos + 220, this.canvas.position().y+ this.yPos + 80)
                console.log(this.canvas.position().x, this.canvas.position().y)
                this.myButton.show()
            }

            if (this.step == 2) {
                this.kidImg = this.miguel
                this.dialogText = "Hmm… ¡Creo que sí! \n Solo sigue recto…"
            }

            if (this.step == 3) {
                this.kidImg = this.miguel
                this.dialogText = "¡Mira, allá adelante \n hay una señal!"
            }

            if (this.step == 4) {
                this.kidImg = this.mateo
                this.dialogText = "¿Qué dice?"
            }

            if (this.step == 5) {
                this.kidImg = this.miguel
                this.dialogText = "dice.."
            }

            if (this.step == 6) {
                this.kidImg = this.miguel
                this.dialogText = "dice.. \nFiesta de..."
            }

            if (this.step == 7) {
                this.kidImg = this.miguel
                this.dialogText = "dice.. \nFiesta de...\n cumpleaños de\n Miguel y Mateo!"
            }

            if (this.step == 8) {
                this.kidImg = this.mateo
                this.dialogText = "Tenemos que darnos prisa \n ya se escucha musica \ny huele a carne asada!"
            }

            if (this.step == 9) {
                this.show = false
                this.myButton.position(-1000,-100)
         }
            
           
            image(this.kidImg, this.xPos + 12, this.yPos + 15);
            textSize(15)
            textFont(this.fontTitle);
            text(this.dialogText, this.xPos + 150, this.yPos + 30);
        }

    }
}