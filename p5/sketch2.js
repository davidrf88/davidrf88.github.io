

let intro;
function preload() {

  // Load the image in the preload function
  // bg =new  myBackground()
  // bg.preload();
  intro = new myIntro()
  intro.preload()
  // jeep =new  myJeep()
  // jeep.preload();

  // dialog =new  myDialog()
  // dialog.preload();
}

function setup() {
   let canvas = createCanvas(320, 600).parent('canvas-container');  // Set canvas size
  // bg.setup();
  // jeep.setup();
  // dialog.setup(canvas);
  intro.setup(canvas);
  
}

function draw() {
   background('#a2d9ff');
  // bg.draw()
  // jeep.draw()
  // dialog.draw()
  // if(dialog.getStep() == 9)
  // {
  //   jeep.runAway();

  // }
  intro.draw();
  
  
}
