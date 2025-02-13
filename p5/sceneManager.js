

let scene1 = new Scene1();
let scene2 = new Scene2();
let currentScene = scene1


function preload(){
  scene1.preload()
  scene2.preload()
}

function setup() {
  this.canvas = createCanvas(320, 600).parent('canvas-container'); // Set canvas size // Attach to the div
  scene1.setup(this.canvas)

}

function draw() {
  currentScene.draw()
  if(currentScene.finished)
  {
    scene2.setup(this.canvas);
    currentScene = scene2;
  }
 
}
