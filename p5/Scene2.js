
class Scene2 
{


  preload() {
    // Load the image in the preload function
    // this.bg =new myBackground()
    // this.bg.preload();
    this.mountainImage = loadImage('assets/mountains.png')
    this.cloudsImage = loadImage('assets/clouds.png')
    this.grassImage = loadImage('assets/grass.png')
    this.higrassImage = loadImage('assets/higrass.png')
    
    this.treesImage = loadImage('assets/trees.png')
  
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
  this.mountains = new myBGLayer(this.mountainImage,this.canvas.height,this.canvas.height+100,100,.3)
  this.mountains.setup(canvas)

  this.clouds = new myBGLayer(this.cloudsImage,this.canvas.height,this.canvas.height+100,100,.3)
  this.clouds.setup(canvas)

  this.higrass = new myBGLayer(this.higrassImage,600,(this.canvas.height)-25,-25,1.8)
  this.higrass.setup(canvas)

  this.grass = new myBGLayer(this.grassImage,700,(this.canvas.height) -100,-100,3)
  this.grass.setup(canvas)

  this.trees = new myBGLayer(this.treesImage,this.canvas.height+500,this.canvas.height-400,-400,1)
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
  if(this.dialog.getStep() == 9)
  {
    setTimeout(() => {
      this.jeep.runAway();
      
    }, 2000);
    
  }
}





}









