let currentSketch;

function startSketch(sketch) {
  if (currentSketch) {
    currentSketch.remove(); // Removes the old sketch but keeps the canvas
  }
  currentSketch = new p5(sketch); // Starts the new sketch
}
new p5(sketch2);
// Start with Scene 1
//startSketch(sketch2);

// Example: Switch to Scene 2 after 3 seconds
setTimeout(() => startSketch(sketch2), 10000);
