// Sections Component
function createSections() {
    return `
        <section id="sections" class="py-16">
            <div class="container mx-auto px-6">
                <h2 class="text-4xl font-bold text-center text-gray-800 mb-12">
                    Our Features
                </h2>
                <div class="grid md:grid-cols-3 gap-8">
                    <!-- Section 1 -->
                    <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition">
                        <div class="text-blue-500 mb-4">
                            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 mb-2">Fast Performance</h3>
                        <p class="text-gray-600">
                            Lightning-fast load times and smooth interactions for the best user experience.
                        </p>
                    </div>
                    
                    <!-- Section 2 -->
                    <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition">
                        <div class="text-purple-500 mb-4">
                            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
                            </svg>
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 mb-2">Customizable</h3>
                        <p class="text-gray-600">
                            Tailor every aspect to match your unique needs and preferences.
                        </p>
                    </div>
                    
                    <!-- Section 3 -->
                    <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition">
                        <div class="text-green-500 mb-4">
                            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                            </svg>
                        </div>
                        <h3 class="text-xl font-bold text-gray-800 mb-2">Secure</h3>
                        <p class="text-gray-600">
                            Built with security in mind to protect your data and privacy.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    `;
}
