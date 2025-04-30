class myDialog {

    constructor(canvas) {
        this.canvas = canvas;
    }
    preload() {
        // Preload any assets here, e.g., images or sounds
        this.img = loadImage('assets/dialog.png'); // Example asset
        this.btnImg = loadImage('assets/button.png'); // Example asset
        this.miguel = loadImage('assets/art/Miguel.png'); // Example asset
        this.mateo = loadImage('assets/art/Mateo.png'); // Example asset
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
    
        this.yPos = 30;
        this.xPos = 10;
        this.startTime = millis();
        this.dialogStart = 10000
        this.kidImg = this.mateo
        this.show = true;
        this.step = 1;
        this.myButton = createButton("Continuar");

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
                this.dialogText = "¿Ves algo desde \n ahí arriba?"
                this.myButton.position(this.canvas.position().x + 230, this.canvas.position().y + 110)
                console.log(this.canvas.position().x, this.canvas.position().y)
                this.myButton.show()
            }

            if (this.step == 2) {
                this.kidImg = this.miguel
                this.dialogText = "¡Nada todavía! Solo \n lianas y hojas gigantes"
            }

            if (this.step == 3) {
                this.kidImg = this.mateo
                this.dialogText = "Hmm… este camino \nse siente misterioso."
            }

            if (this.step == 4) {
                this.kidImg = this.miguel
                this.dialogText = "¡Esperaaa! \n¡Vi algo moverse!"
            }

            if (this.step == 5) {
                this.kidImg = this.mateo
                this.dialogText = "¿Un tigre? \n ¿Un elefante?"
            }

            if (this.step == 6) {
                this.kidImg = this.miguel
                this.dialogText = "¡No! ¡Un mono volando \nen trapecio!"
            }

            if (this.step == 7) {
                this.kidImg = this.mateo
                this.dialogText = "¡Entonces estamos cerca \nde los animales acrobáticos!"
            }

            if (this.step == 8) {
                this.kidImg = this.miguel
                this.dialogText = "¿Escuchas eso?"
            }

            if (this.step == 9) {
                this.kidImg = this.mateo
                this.dialogText = "¿Un tambor? \n¡Sí! ¡Allá en la selva!"
            }

            if (this.step == 10) {
                this.kidImg = this.miguel
                this.dialogText = "¡Es la señal! \n¡Están comenzando el show!"
            }

            if (this.step == 11) {
                this.kidImg = this.miguel
                this.dialogText = "¡Acelera modo safari!"
            }
            if (this.step == 12) {
                this.kidImg = this.mateo
                this.dialogText = "¡Vamos, \nque empieza la fiestaaa!"
            }

            if (this.step == 13) {
                this.show = false
                this.myButton.position(-1000,-100)
         }
            
           push()
           fill('black')
            image(this.kidImg, this.xPos + 12, this.yPos + 15);
            textSize(20)
            textFont(this.fontTitle);
            text(this.dialogText, this.xPos + 110, this.yPos + 35);
            pop()
        }

    }
}