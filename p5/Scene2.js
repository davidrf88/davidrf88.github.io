
class Scene2 
{


  preload() {
    // Load the image in the preload function
    this.bg =new myBackground()
    this.bg.preload();
  
    this.jeep =new  myJeep()
    this.jeep.preload();
  
    this.dialog =new  myDialog()
    this.dialog.preload();
  }

setup(canvas) {
  this.canvas = canvas;
  this.bg.setup(this.canvas);
  this.jeep.setup(this.canvas);
  this.dialog.setup(this.canvas);
}

draw() {
  background('#a2d9ff');
  this.bg.draw()
  this.jeep.draw()
  this.dialog.draw()
  if(this.dialog.getStep() == 9)
  {
    this.jeep.runAway();
  }
}





}









