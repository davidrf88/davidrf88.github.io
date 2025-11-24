// Main Application
document.addEventListener('DOMContentLoaded', async function() {
    // Get the app container
    const app = document.getElementById('app');
    
    // Function to load HTML component
    async function loadComponent(path) {
        try {
            const response = await fetch(path);
            return await response.text();
        } catch (error) {
            console.error(`Error loading component ${path}:`, error);
            return '';
        }
    }
    
    // Load and render all components
    const header = await loadComponent('components/header.html');
    const intro = await loadComponent('components/intro.html');
    const sections = await loadComponent('components/ourStory.html');
    const footer = await loadComponent('components/footer.html');
    
    app.innerHTML = header + intro + sections + footer;
    
    // Scroll reveal animation
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);
    
    // Observe all fade-in-scroll elements
    document.querySelectorAll('.fade-in-scroll').forEach(el => {
        observer.observe(el);
    });
    
    // Add mobile menu toggle functionality
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
        
        // Close mobile menu when clicking on a link
        const mobileLinks = mobileMenu.querySelectorAll('a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.add('hidden');
            });
        });
    }
});
