// Function to determine the active page based on the current URL
function getActivePage() {
    const path = window.location.pathname;
    if (path.includes('/airdrops')) return 'airdrops';
    if (path.includes('/ecosystem')) return 'ecosystem';
    if (path.includes('/launches')) return 'launches';
    if (path.includes('/explorer')) return 'explorer';
    if (path.includes('/dashboard')) return 'dashboard';
    return '';
}

// Create and inject the navbar
async function injectNavbar() {
    try {
        // Create or get navbar container
        let navbarContainer = document.getElementById('navbar-container');
        if (!navbarContainer) {
            navbarContainer = document.createElement('div');
            navbarContainer.id = 'navbar-container';
            navbarContainer.style.position = 'relative';
            navbarContainer.style.height = '64px'; // Match navbar height
            document.body.insertBefore(navbarContainer, document.body.firstChild);
        }

        // Show skeleton immediately
        const skeletonNav = document.createElement('nav');
        skeletonNav.className = 'bg-[#0f1a1f] border-b border-[#0a2622]';
        skeletonNav.style.position = 'absolute';
        skeletonNav.style.top = '0';
        skeletonNav.style.left = '0';
        skeletonNav.style.right = '0';
        skeletonNav.style.zIndex = '10';
        
        // Create skeleton structure that matches the navbar exactly
        skeletonNav.innerHTML = `
            <div class="flex justify-between items-center h-16 px-8">
                <div class="flex items-center">
                    <a class="flex items-center justify-center h-16 mr-8">
                        <div class="h-8 w-8 bg-white/10 rounded animate-pulse"></div>
                    </a>
                    <div class="flex items-center space-x-8">
                        <div class="h-4 w-[72px] bg-white/10 rounded animate-pulse"></div>
                        <div class="h-4 w-[64px] bg-white/10 rounded animate-pulse"></div>
                        <div class="h-4 w-[72px] bg-white/10 rounded animate-pulse"></div>
                        <div class="h-4 w-[64px] bg-white/10 rounded animate-pulse"></div>
                        <div class="h-4 w-[72px] bg-white/10 rounded animate-pulse"></div>
                    </div>
                </div>
                <div class="flex items-center space-x-6">
                    <div class="h-4 w-[40px] bg-white/10 rounded animate-pulse"></div>
                    <div class="flex items-center">
                        <div class="h-7 w-[72px] bg-[rgba(72,255,225,0.2)] rounded animate-pulse"></div>
                        <div class="mx-3 h-4 w-px bg-white/10"></div>
                        <div class="h-7 w-[72px] bg-white/10 rounded animate-pulse"></div>
                    </div>
                    <div class="h-[18px] w-[18px] bg-white/10 rounded animate-pulse"></div>
                </div>
            </div>
        `;
        
        // Clear container and add skeleton
        navbarContainer.innerHTML = '';
        navbarContainer.appendChild(skeletonNav);

        // Load actual navbar
        const response = await fetch('/components/navbar.html');
        if (!response.ok) {
            throw new Error(`Failed to load navbar: ${response.status} ${response.statusText}`);
        }
        const html = await response.text();
        
        // Create a temporary container for the actual navbar
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const actualNav = tempDiv.querySelector('nav');
        
        if (!actualNav) {
            throw new Error('Could not find nav element in navbar HTML');
        }
        
        // Set up actual navbar
        actualNav.style.position = 'absolute';
        actualNav.style.top = '0';
        actualNav.style.left = '0';
        actualNav.style.right = '0';
        actualNav.style.opacity = '0';
        actualNav.style.transition = 'opacity 0.2s ease';
        actualNav.style.zIndex = '20';
        
        // Add the actual navbar but keep it invisible
        navbarContainer.appendChild(actualNav);
        
        // Force reflow
        actualNav.offsetHeight;
        
        // Fade in the actual navbar and remove skeleton
        requestAnimationFrame(() => {
            actualNav.style.opacity = '1';
            skeletonNav.style.opacity = '0';
            skeletonNav.style.transition = 'opacity 0.2s ease';
            
            // Remove skeleton after transition
            setTimeout(() => {
                if (skeletonNav.parentNode === navbarContainer) {
                    navbarContainer.removeChild(skeletonNav);
                }
            }, 200);
        });
        
        // Add active states and event listeners
        const activePage = getActivePage();
        const links = actualNav.querySelectorAll('.nav-link');
        
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