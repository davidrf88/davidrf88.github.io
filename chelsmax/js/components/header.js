// Header Component
function createHeader() {
    return `
        <header class="bg-white shadow-md sticky top-0 z-50">
            <nav class="container mx-auto px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="text-2xl font-bold text-gray-800">
                        Logo
                    </div>
                    <div class="hidden md:flex space-x-8">
                        <a href="#intro" class="text-gray-600 hover:text-gray-900 transition">Home</a>
                        <a href="#sections" class="text-gray-600 hover:text-gray-900 transition">About</a>
                        <a href="#footer" class="text-gray-600 hover:text-gray-900 transition">Contact</a>
                    </div>
                    <div class="md:hidden">
                        <button id="mobile-menu-btn" class="text-gray-600 hover:text-gray-900">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <!-- Mobile menu -->
                <div id="mobile-menu" class="hidden md:hidden mt-4 pb-4">
                    <a href="#intro" class="block py-2 text-gray-600 hover:text-gray-900">Home</a>
                    <a href="#sections" class="block py-2 text-gray-600 hover:text-gray-900">About</a>
                    <a href="#footer" class="block py-2 text-gray-600 hover:text-gray-900">Contact</a>
                </div>
            </nav>
        </header>
    `;
}
