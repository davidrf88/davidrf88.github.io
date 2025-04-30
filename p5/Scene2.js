
class Scene2 
{


  preload() {
    // Load the image in the preload function
    // this.bg =new myBackground()
    // this.bg.preload();
    this.mountainImage = loadImage('assets/art/mountains.png')
    this.cloudsImage = loadImage('assets/clouds.png')
    this.grassImage = loadImage('assets/art/grass.png')
    this.higrassImage = loadImage('assets/art/higrass.png')
    
    this.treesImage = loadImage('assets/art/trees.png')
  
    this.jeep =new  myJeep()
    this.jeep.preload();
  
    this.dialog =new  myDialog()
    this.dialog.preload();
  }

setup(canvas) {
  this.canvas = canvas;
  //this.bg.setup(this.canvas);
  this.jeep.setup(this.canvas);
  this.dialog.setup(this.canvas);
  this.mountains = new myBGLayer(this.mountainImage,this.canvas.height,this.canvas.height+0,0,.2,-550)
  this.mountains.setup(canvas)

  this.clouds = new myBGLayer(this.cloudsImage,this.canvas.height,this.canvas.height+100,100,.3)
  this.clouds.setup(canvas)

  this.higrass = new myBGLayer(this.higrassImage,600,(this.canvas.height)-25,-25,1.8)
  this.higrass.setup(canvas)

  this.grass = new myBGLayer(this.grassImage,700,(this.canvas.height) -100,-100,3)
  this.grass.setup(canvas)

  this.trees = new myBGLayer(this.treesImage,this.canvas.height-40,this.canvas.height+0,0,1.5,-100)
  this.trees.setup(canvas)

}

draw() {
  background('#b6cff7');
  this.clouds.draw()
  this.mountains.draw()
  this.trees.draw()
  this.higrass.draw()

  this.jeep.draw()
  this.grass.draw()


  
  this.dialog.draw()
  if(this.dialog.getStep() == 13)
  {
    setTimeout(() => {
      this.jeep.runAway();
      
    }, 2000);


    setTimeout(() => {
      this.finished = true
    }, 5000);
    
  }
}





}









