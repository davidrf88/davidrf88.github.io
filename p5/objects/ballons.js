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
        this.ballonSpeed = 3;
        this.ballonBounceSpeed = 1;
        this.timeGap = 300;
        this.MiguellBallonColor = '#fc6f03'
        this.MateoBallonColor = '#006915'
    }

    setup()
    {
        this.letterX = this.x
        this.letterY = this.y;
        let gap = this.gap;
        
setTimeout(() => {this.ballonsMateo.push(new myBallonInstance("M",this.MateoBallonColor,this.letterX, this.letterY, 'right'))}, 1);
setTimeout(() => {this.ballonsMateo.push(new myBallonInstance("a",this.MateoBallonColor,this.letterX + gap,this.letterY, 'right'))}, this.timeGap);
setTimeout(() => {this.ballonsMateo.push(new myBallonInstance("t",this.MateoBallonColor,this.letterX + (gap*2),this.letterY, 'right'))}, this.timeGap*2);
setTimeout(() => {this.ballonsMateo.push(new myBallonInstance("e",this.MateoBallonColor,this.letterX + (gap*3),this.letterY, 'right'))}, this.timeGap*3);
setTimeout(() => {this.ballonsMateo.push(new myBallonInstance("0",this.MateoBallonColor,this.letterX + (gap*4),this.letterY, 'right'))}, this.timeGap*4);


setTimeout(() => {this.ballonY = new myBallonInstance("&","#fff",this.letterX + (gap*2),this.letterY, 'stay')}, this.timeGap * 5);


setTimeout(() => {this.ballonsMiguel.push(new myBallonInstance("M",this.MiguellBallonColor,this.letterX + gap - (gap * 1.5),this.letterY, 'left'))}, this.timeGap *2);
setTimeout(() => {this.ballonsMiguel.push(new myBallonInstance("i",this.MiguellBallonColor,this.letterX + (gap*2) - (gap*1.5),this.letterY, 'left'))}, this.timeGap*3);
setTimeout(() => {this.ballonsMiguel.push(new myBallonInstance("g",this.MiguellBallonColor,this.letterX + (gap*3) -  (gap*1.5),this.letterY, 'left'))}, this.timeGap*4);
setTimeout(() => {this.ballonsMiguel.push(new myBallonInstance("u",this.MiguellBallonColor,this.letterX + (gap*4) -  (gap*1.5),this.letterY, 'left'))}, this.timeGap*5);
setTimeout(() => {this.ballonsMiguel.push(new myBallonInstance("e",this.MiguellBallonColor,this.letterX + (gap*5) -  (gap*1.5),this.letterY, 'left'))}, this.timeGap*6);
setTimeout(() => {this.ballonsMiguel.push(new myBallonInstance("l",this.MiguellBallonColor,this.letterX + (gap*6) -  (gap*1.5),this.letterY, 'left'))}, this.timeGap*7);

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
                    this.initialX -= this.ballonSpeed
                }
                else
                { this.bouncer = true}



                if(this.bouncer && (this.frameNo == 3))
                {
                    
                    if(this.goingDown)
                    {
                        
                        this.initialX += this.ballonBounceSpeed
                    }
                    else
                    {
                        this.initialX -= this.ballonBounceSpeed

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
           

              

    }
}