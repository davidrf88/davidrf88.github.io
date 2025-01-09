// Add a click event listener
var btn = document.getElementById('btnbackground');
btn.addEventListener("click", changeBackground);

var btn2 = document.getElementById('btnPattern');
btn2.addEventListener("click", changePattern);

var btn3 = document.getElementById('btnFace');
btn3.addEventListener("click", changeFace);

var btn4 = document.getElementById('btnFaceColor');
btn4.addEventListener("click", changeFaceColor);


var btn4 = document.getElementById('btnBody');
btn4.addEventListener("click", changeBodyPattern);
btnBody

let colorindex = 0; // Track the current color index
let patternindex = 0; // Track the current pattern index
let miguelindex = 1; // Track the current Miguel index
let miguelcolorindex = 0; // Track the current Miguel index
let bdyindex = 0;

 // Preset colors
 const facecolors = [
    "#AD343E",
     "#A9AFD1", 
     "#FEFAE0", 
     "#DDA15E"
    ]; // Red, Green, Blue, Gold

    const colors = [
      "#454ADE",
       "#E54F6D", 
       "#ECA72C", 
       "#4C2719"
      ]; // Red, Green, Blue, Gold
const patterns = [
    `linear-gradient(45deg, rgba(255, 255, 255, 0.3) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.3) 50%, rgba(255, 255, 255, 0.3) 75%, transparent 75%, transparent)`, // Diagonal stripes
    `radial-gradient(circle, rgba(255, 255, 255, 0.2) 20%, transparent 20%, transparent 80%, rgba(255, 255, 255, 0.2) 80%, rgba(255, 255, 255, 0.2))`, // Circles
    `repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.2) 10px, transparent 10px, transparent 20px)`, // Horizontal stripes
    `repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.2) 10px, transparent 10px, transparent 20px)` // Vertical stripes
  ];

  const miguelFaces = [
    "url('MiguelFace.png')",
    "url('MiguelFace1.png')",
    "url('MiguelFace2.png')",
    "url('MiguelFace3.png')",

    ];

    const mateoFaces = [
      "url('MiguelFace2.png')",
      "url('MiguelFace3.png')",
      "url('MiguelFace.png')",
      "url('MiguelFace1.png')",
  
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

function changeFace()
{
    var miguel = document.getElementById('miguel');
    var mateo = document.getElementById('mateo');
    // Set the background color to the current color in the array
    console.log(miguel)
    miguel.style.backgroundImage = miguelFaces[miguelindex % miguelFaces.length]
    mateo.style.backgroundImage = mateoFaces[miguelindex % miguelFaces.length]
    miguelindex++;

}

function changeFaceColor()
{
    var miguel = document.getElementById('miguel');
    var mateo = document.getElementById('mateo');
    // Set the background color to the current color in the array
    console.log(miguel)
    miguel.style.backgroundColor = facecolors[miguelcolorindex % facecolors.length]
    mateo.style.backgroundColor = facecolors[miguelcolorindex % facecolors.length]
    miguelcolorindex++;

}

function changeBodyPattern()
{
    var bdy= document.getElementsByTagName('body')[0];
    bdy.style.backgroundImage = patterns[bdyindex % patterns.length];
    bdy.style.backgroundSize = "30px 30px"; // Adjust pattern size

    bdyindex++;
}