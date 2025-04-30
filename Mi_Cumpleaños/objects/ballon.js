class myBallon {

    constructor( letter, x, y) {
        this.letter = letter;
        this.x = x;
        this.y = y;
        this.initialX = 700
        this.bouncer = false;
        this.goingDown = true;
        this.frameNo = 0;
        this.speed = 1.4;
        this.goAwaySpeed = 2;
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
                    this.initialX -= this.goAwaySpeed
                }
                else
                { this.bouncer = true}



                if(this.bouncer && (this.frameNo == 3))
                {
                    
                    if(this.goingDown)
                    {
                        
                        this.initialX += this.speed
                    }
                    else
                    {
                        this.initialX -= this.speed

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