class myBallonInstance {

    constructor( letter,color, x, y,flyDirectio) {
        this.letter = letter;
        this.color = color;
        this.x = x;
        this.y = y;
        this.posIndex = 0;
        this.flyDirection = flyDirectio
    }
    updateY(y)
    {
        this.y = y
    }

    updateRandomX()
    {
         if(this.flyDirection == 'stay')
         {
            this.y = this.y-2
         }

         if(this.flyDirection == 'right')
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