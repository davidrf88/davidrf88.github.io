function click_button_start() {

    // Select all elements with the class "intro"
    const introElements = document.querySelectorAll('.intro');
  
    introElements.forEach(element => {
      // Apply fade-out animation
      element.style.animation = 'fadeOut 1s forwards';
      // Remove the element from the DOM after the animation ends
      element.addEventListener('animationend', () => {
        element.remove();
      });
    });
  
    // call next function 
    setTimeout(() => {
        scene_2_start()
    }, 1000); // Match the duration of the fade-out animation

}

function scene_2_start()
{
    const introElements = document.querySelectorAll('.scene1');

    introElements.forEach(element => {
        // Apply fade-out animation
        element.style.animation = 'fadeIn 4s forwards';
   
      });
   


}