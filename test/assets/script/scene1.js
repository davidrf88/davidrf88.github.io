function scene1Start(){

   //REMOVE Intro section
   removeIntro()

}

function removeIntro()
{
    var intro = document.getElementById('intro');
    intro.style.animation= "bounce 4s"
    setTimeout(() => {
        intro.remove()
        fadeInScene1()
    }, 2000);

}

function fadeInScene1()
{
    var intro = document.getElementById('scene1');
    intro.style.animation= "fadeInUp 4s ease-in-out forwards"
    
    setTimeout(() => {
       
    }, 2000);

}

