// Function to determine the active page based on the current URL
function getActivePage() {
    const path = window.location.pathname;
    if (path.includes('/airdrops')) return 'airdrops';
    if (path.includes('/ecosystem')) return 'ecosystem';
    if (path.includes('/launches')) return 'launches';
    if (path.includes('/explorer')) return 'explorer';
    return '';
}

// Create and inject the navbar
async function injectNavbar() {
    try {
        const response = await fetch('/components/navbar.html');
        if (!response.ok) {
            throw new Error(`Failed to load navbar: ${response.status} ${response.statusText}`);
        }
        const html = await response.text();
        
        // Find the navbar container or create one if it doesn't exist
        let navbarContainer = document.getElementById('navbar-container');
        if (!navbarContainer) {
            navbarContainer = document.createElement('div');
            navbarContainer.id = 'navbar-container';
            document.body.insertBefore(navbarContainer, document.body.firstChild);
        }
        
        // Insert the navbar HTML
        navbarContainer.innerHTML = html;
        
        // Add active states and event listeners
        const activePage = getActivePage();
        const links = navbarContainer.querySelectorAll('.nav-link');
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href === '#' || href === '/chat') {
                link.addEventListener('click', (e) => showComingSoon(link, e));
            }
            if (href && href.includes(activePage)) {
                link.classList.add('active');
            }
        });
        
    } catch (error) {
        console.error('Failed to load navbar:', error);
        let navbarContainer = document.getElementById('navbar-container');
        if (navbarContainer) {
            navbarContainer.innerHTML = '';
        }
    }
}

// Add the showComingSoon function
window.showComingSoon = function(element, event) {
    event.preventDefault();
    
    // Remove any existing popup
    const existingPopup = document.querySelector('.coming-soon-text');
    if (existingPopup) {
        existingPopup.remove();
    }

    // Create popup
    const popup = document.createElement('div');
    popup.textContent = 'Coming Soon';
    popup.className = 'coming-soon-text';
    
    // Position the popup relative to the link
    popup.style.left = '50%';
    popup.style.transform = 'translateX(-50%)';
    popup.style.top = '100%';
    
    // Add to the link
    element.style.position = 'relative';
    element.appendChild(popup);
    
    // Remove after animation
    setTimeout(() => {
        popup.remove();
    }, 800);
};

// Inject navbar when the DOM is loaded
document.addEventListener('DOMContentLoaded', injectNavbar); 