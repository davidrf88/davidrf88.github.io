class myBallonInstance {

    constructor( letter,color, x, y) {
        this.letter = letter;
        this.color = color;
        this.x = x;
        this.y = y;
        this.posIndex = 0;
        this.randDirection;
    }
    updateY(y)
    {
        this.y = y
    }

    updateRandomX()
    {
        if(this.randDirection == undefined)
        {
            this.randDirection =  random() < 0.5
        }

         if(this.randDirection )
         {
            this.x = this.x +2
         }
         else
         {
            this.x = this.x -2
         }
        
    }

    updateRandomY()
    {
        this.y = this.y - random(1,3)
    }
    updatePosIndex()
    {
        this.posIndex++
    }
   
    draw() {
        fill(this.color)
        text(this.letter,this.x, this.y);

            

        // if(this.posIndex == 999)
        // {
        //     this.posIndex = 999
        // }
        // else
        // {
        // this.posIndex++
        // }
    }
}