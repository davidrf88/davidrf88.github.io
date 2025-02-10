class myBallon {

    constructor( letter, x, y) {
        this.letter = letter;
        this.x = x;
        this.y = y;
        this.initialX = 700
        this.bouncer = false;
        this.goingDown = true;
        this.frameNo = 0;
    }

    draw() {
           
            if(this.frameNo > 9)
            {
                this.frameNo = 1;
            }
            else
            {
                this.frameNo = this.frameNo + 1
            }

                text(this.letter,this.x, this.initialX);


                if( !(this.bouncer) && this.initialX > (this.y -5))
                {
                    this.initialX -= 2
                }
                else
                { this.bouncer = true}



                if(this.bouncer && (this.frameNo == 3))
                {
                    
                    if(this.goingDown)
                    {
                        
                        this.initialX += 1
                    }
                    else
                    {
                        this.initialX -= 1

                    }
                    if( this.initialX > (this.y +5))
                    {
                    this.goingDown = false;
                    }

                    if( this.initialX < this.y)
                        {
                        this.goingDown = true;
                        }
                    //console.log((this.goingDown)?'going down':"going up", this.initialX)

                }


              
              
              

    }
}