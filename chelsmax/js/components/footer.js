// Footer Component
function createFooter() {
    return `
        <footer id="footer" class="bg-gray-800 text-white py-12">
            <div class="container mx-auto px-6">
                <div class="grid md:grid-cols-3 gap-8">
                    <!-- Company Info -->
                    <div>
                        <h3 class="text-xl font-bold mb-4">Company</h3>
                        <p class="text-gray-400">
                            Building amazing experiences for the web.
                        </p>
                    </div>
                    
                    <!-- Quick Links -->
                    <div>
                        <h3 class="text-xl font-bold mb-4">Quick Links</h3>
                        <ul class="space-y-2">
                            <li><a href="#intro" class="text-gray-400 hover:text-white transition">Home</a></li>
                            <li><a href="#sections" class="text-gray-400 hover:text-white transition">About</a></li>
                            <li><a href="#footer" class="text-gray-400 hover:text-white transition">Contact</a></li>
                        </ul>
                    </div>
                    
                    <!-- Contact -->
                    <div>
                        <h3 class="text-xl font-bold mb-4">Contact</h3>
                        <ul class="space-y-2 text-gray-400">
                            <li>Email: info@example.com</li>
                            <li>Phone: (123) 456-7890</li>
                        </ul>
                    </div>
                </div>
                
                <div class="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
                    <p>&copy; 2025 Your Company. All rights reserved.</p>
                </div>
            </div>
        </footer>
    `;
}
