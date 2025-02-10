class myBallons {

    constructor(p, letter, x, y, gap) {
        this.p= p;
        this.letter = letter;
        this.x = x;
        this.y = y;
        this.gap = gap
        this.initialX = 700
        this.bouncer = false;
        this.goingDown = true;
        this.frameNo = 0;
        this.posIndex = 0;
        this.positions = [9999,9999]
        this.ballonsMiguel = []
        this.ballonsMateo = []
        this.flyAway = false;
    }

    setup()
    {
        this.letterX = this.x
        this.letterY = this.y;
        let gap = this.gap;
        
setTimeout(() => {this.ballonsMateo.push(new myBallonInstance("M","#64B6AC",this.letterX, this.letterY))}, 1);
setTimeout(() => {this.ballonsMateo.push(new myBallonInstance("a","#64B6AC",this.letterX + gap,this.letterY))}, 500);
setTimeout(() => {this.ballonsMateo.push(new myBallonInstance("t","#64B6AC",this.letterX + (gap*2),this.letterY))}, 1000);
setTimeout(() => {this.ballonsMateo.push(new myBallonInstance("e","#64B6AC",this.letterX + (gap*3),this.letterY))}, 1500);
setTimeout(() => {this.ballonsMateo.push(new myBallonInstance("0","#64B6AC",this.letterX + (gap*4),this.letterY))}, 2000);


setTimeout(() => {this.ballonY = new myBallonInstance("&","#fff",this.letterX + (gap*2),this.letterY)}, 3000);


setTimeout(() => {this.ballonsMiguel.push(new myBallonInstance("M","#05668D",this.letterX + gap - (gap * 1.5),this.letterY))}, 3500);
setTimeout(() => {this.ballonsMiguel.push(new myBallonInstance("i","#05668D",this.letterX + (gap*2) - (gap*1.5),this.letterY))}, 4000);
setTimeout(() => {this.ballonsMiguel.push(new myBallonInstance("g","#05668D",this.letterX + (gap*3) -  (gap*1.5),this.letterY))}, 4500);
setTimeout(() => {this.ballonsMiguel.push(new myBallonInstance("u","#05668D",this.letterX + (gap*4) -  (gap*1.5),this.letterY))}, 5000);
setTimeout(() => {this.ballonsMiguel.push(new myBallonInstance("e","#05668D",this.letterX + (gap*5) -  (gap*1.5),this.letterY))}, 5500);
setTimeout(() => {this.ballonsMiguel.push(new myBallonInstance("l",'#05668D',this.letterX + (gap*6) -  (gap*1.5),this.letterY))}, 6000);

    }

    addPosition(pos)
    {
        this.positions.push(pos)
        if(this.positions.length > 999)
        {
            this.positions.shift();
        }
        

    }
    calculateY()
    {
        


        if(this.frameNo > 5)
            {
                this.frameNo = 1;
            }
            else
            {
                this.frameNo = this.frameNo + 1
            }

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

                this.addPosition(this.initialX+0)

    }

    setFlyAway()
    {
        console.log('flying away')
        this.flyAway = true;

    }

    randomFly()
    {

        this.ballonY.updateRandomX()
        this.ballonY.updateRandomY();
        this.ballonY.draw();

        this.ballonsMiguel.forEach(ballon => {
            
            ballon.updateRandomX();
            ballon.updateRandomY();
            ballon.draw();
        });

        this.ballonsMateo.forEach(ballon => {
            
            ballon.updateRandomX();
            ballon.updateRandomY();
            ballon.draw();
        });


    }

    draw() {
        
            if(this.flyAway)
            {
                this.randomFly();
                return;
            }




        this.calculateY();
        //console.log('ballos', this.ballons.length, this.initialX, this.positions[this.posIndex])
        this.ballonsMateo.forEach(ballon => {
            
            if(this.positions.length < 999)
            {
                ballon.updatePosIndex();
                
            }
               
            ballon.updateY(this.positions[ballon.posIndex] );
           
            ballon.draw();
            
        });

        if(this.ballonY){
            if(this.positions.length < 999)
                this.ballonY.updatePosIndex();
        this.ballonY.updateY(this.positions[this.ballonY.posIndex] + (this.gap*3) ) ;
        this.ballonY.draw();
        }
        this.ballonsMiguel.forEach(ballon => {
            if(this.positions.length < 999)
                ballon.updatePosIndex();
            ballon.updateY(this.positions[ballon.posIndex] + (this.gap*5));
            ballon.draw();
        });
           
        
        

        
        
        

        // if(this.posIndex == 999)
        // {
        //     this.posIndex = 999
        // }
        // else
        // {
        // this.posIndex++
        // }

        // if(this.posIndex > 100)
        // {
        //     addNextBallon()
        // }
              
              
              

    }
}