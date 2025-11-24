// Intro Component
function createIntro() {
    return `
        <section id="intro" class="bg-gradient-to-r from-blue-500 to-purple-600 text-white py-20">
            <div class="container mx-auto px-6 text-center">
                <h1 class="text-5xl md:text-6xl font-bold mb-4">
                    Welcome to Our Application
                </h1>
                <p class="text-xl md:text-2xl mb-8 text-blue-100">
                    Building something amazing, one step at a time
                </p>
                <button class="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition shadow-lg">
                    Get Started
                </button>
            </div>
        </section>
    `;
}
