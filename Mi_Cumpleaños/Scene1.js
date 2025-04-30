
class Scene1
{

  
preload() {
  this.intro = new myIntro(this.canvas)
  this.intro.preload()
}

setup(canvas) {
  this.canvas = canvas;
  this.intro.setup(this.canvas);
  this.finished = false;
  
}

draw() {
   background('#a2d9ff');
   this.intro.draw();
   this.finished = this.intro.finished;
  
}

}
