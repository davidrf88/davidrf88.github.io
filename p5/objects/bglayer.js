class myBGLayer {

    constructor( image,resize, ypos,finalypos, speed,initialx) {
        this.image = image;
        this.resize = resize;
        this.ypos = ypos;
        this.finalypos = finalypos;
        this.speed = speed;
        this.initialx = (initialx)?initialx:0;
    }
    setup(canvas)
    {
        this.canvas = canvas;
        // Setup any properties for this object
        this.image.resize(0, this.resize);
       
        this.imageYPos = this.ypos;
        this.imageXPos = this.initialx;
    }

    draw() {

        image(this.image, this.imageXPos, this.imageYPos);
        image(this.image, this.imageXPos + this.image.width, this.imageYPos);
        this.imageXPos -= this.speed;
        //Reset the image position when it reaches the top
        if (this.imageYPos > this.finalypos) {
            this.imageYPos -= 2; 
        }
        if (this.imageXPos <= -this.image.width) {
            this.imageXPos = 0;
        }

    }
}