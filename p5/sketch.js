let bg;
let jeep;
function preload() {
  // Load the image in the preload function
  bg =new  myBackground()
  bg.preload();

  jeep =new  myJeep()
  jeep.preload();

  dialog =new  myDialog()
  dialog.preload();
}

function setup() {
  let canvas = createCanvas(320, 600); // Set canvas size
  canvas.parent('canvas-container');  // Attach to the div
  bg.setup();
  jeep.setup();
  dialog.setup();
  
}

function draw() {
  background('#a2d9ff');
  bg.draw()
  jeep.draw()
  dialog.draw()
  if(dialog.getStep() == 9)
  {
    jeep.runAway();

  }
  
  
}
