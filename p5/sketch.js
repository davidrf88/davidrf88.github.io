
let sketch1 = function(p)
{

let bg;
let jeep;

p.setup = function setup() {
  let canvas = p.createCanvas(320, 600).parent('canvas-container'); // Set canvas size // Attach to the div
  bg.setup();
  jeep.setup();
  dialog.setup(canvas);
  
}

p.draw = function draw() {
  p.background('#a2d9ff');
  bg.draw()
  jeep.draw()
  dialog.draw()
  if(dialog.getStep() == 9)
  {
    jeep.runAway();

  }
  
  
}

p.preload = function preload() {
  // Load the image in the preload function
  bg =new  myBackground(p)
  bg.preload();

  jeep =new  myJeep(p)
  jeep.preload();

  dialog =new  myDialog(p)
  dialog.preload();
}



}









