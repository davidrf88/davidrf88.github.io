// Add a click event listener
var btn = document.getElementById('btnbackground');
btn.addEventListener("click", changeBackground);

var btn2 = document.getElementById('btnPattern');
btn2.addEventListener("click", changePattern);
let colorindex = 0; // Track the current color index
let patternindex = 0; // Track the current color index

 // Preset colors
 const colors = [
    "#FF5733",
     "rgb(0 115 20)", 
     "#3357FF", 
     "rgb(144 123 7)"
    ]; // Red, Green, Blue, Gold
const patterns = [
    `linear-gradient(45deg, rgba(255, 255, 255, 0.3) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.3) 50%, rgba(255, 255, 255, 0.3) 75%, transparent 75%, transparent)`, // Diagonal stripes
    `radial-gradient(circle, rgba(255, 255, 255, 0.2) 20%, transparent 20%, transparent 80%, rgba(255, 255, 255, 0.2) 80%, rgba(255, 255, 255, 0.2))`, // Circles
    `repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.2) 10px, transparent 10px, transparent 20px)`, // Horizontal stripes
    `repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.2) 10px, transparent 10px, transparent 20px)` // Vertical stripes
  ];

 


function changeBackground()
{
    var windshield = document.getElementById('windshield');
    // Set the background color to the current color in the array
    windshield.style.backgroundColor = colors[colorindex];

  // Move to the next color, looping back to the start if needed
  colorindex = (colorindex + 1) % colors.length;
}

function changePattern()
{
    var windshield = document.getElementById('windshield');
    windshield.style.backgroundImage = patterns[patternindex % patterns.length];
    windshield.style.backgroundSize = "20px 20px"; // Adjust pattern size

    patternindex++;
}