

let scene1 = new Scene1();
let scene2 = new Scene2();
let scenes = [];
scenes.push(scene1);
scenes.push(scene2);

let currentScene = 0


function preload(){
  scene1.preload()
  scene2.preload()
}

function setup() {


  this.canvas = createCanvas(320, 600).parent('canvas-container'); // Set canvas size // Attach to the div
  scene1.setup(this.canvas)


}

function animationEnd()
{
  noLoop();
  this.canvas.remove()
  let container = document.getElementById('canvas-container');
  if (container) {
    container.remove();
  }

   // Fade in the main content
   let mainWeb = document.querySelector('.MainWeb');
   if (mainWeb) {
     mainWeb.style.display = 'block';  // Make it visible to allow transition
     // Force a reflow so the transition triggers properly
     void mainWeb.offsetWidth;
     mainWeb.classList.add('visible');
   }

}

function draw() {
  scenes[currentScene].draw()
  if(scenes[currentScene].finished)
    {
      currentScene++;
     
      if(scenes.length <= currentScene)
      {
        animationEnd();
      }
      scenes[currentScene].setup(this.canvas);
      
  
  
    }

}
