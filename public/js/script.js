// Add this at the top of the file
window.updatePriceData = function() {
    // This is a stub function since we're handling price updates differently now
    console.debug('Price update requested');
};

// Initialize current token
window.currentToken = 'HYPE';

// Function to select an icon
window.selectIcon = function(element) {
    // Remove selected class from all icons
    document.querySelectorAll('.airdrop-icon').forEach(icon => {
        icon.classList.remove('selected');
    });
    
    // Add selected class to clicked icon
    element.classList.add('selected');
    
    // Update current token
    window.currentToken = element.alt;
    
    // Update price data
    window.updatePriceData();
    
    // Update chart
    if (window.updateChartForToken) {
        window.updateChartForToken(window.currentToken);
    }

    // Update TweetList if Bag Fumbled tab is active
    const bagFumbledContent = document.getElementById('bagFumbled-content');
    if (bagFumbledContent && !bagFumbledContent.classList.contains('hidden')) {
        window.refreshTweet(); // Use the existing refresh function
    }
};

// Function to handle About/Bag Fumbled tabs
window.selectContentTab = function(element, tabName) {
    // Get the About/Bag Fumbled tab group
    const tabGroup = element.closest('.flex');
    
    // Reset all tabs in this group
    tabGroup.querySelectorAll('span').forEach(tab => {
        tab.classList.remove('text-white');
        tab.classList.add('text-[rgb(148,158,156)]');
        const indicator = tab.querySelector('.tab-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    });
    
    // Activate clicked tab
    element.classList.remove('text-[rgb(148,158,156)]');
    element.classList.add('text-white');
    const indicator = element.querySelector('.tab-indicator');
    if (indicator) {
        indicator.style.display = 'block';
    }

    // Toggle content visibility
    const aboutContent = document.getElementById('about-content');
    const bagFumbledContent = document.getElementById('bagFumbled-content');
    
    if (aboutContent) aboutContent.classList.add('hidden');
    if (bagFumbledContent) bagFumbledContent.classList.add('hidden');

    const selectedContent = document.getElementById(`${tabName}-content`);
    if (selectedContent) {
        selectedContent.classList.remove('hidden');
        
        // Initialize TweetList for Bag Fumbled tab
        if (tabName === 'bagFumbled') {
            window.refreshTweet(); // Use the existing refresh function
        }
    }
};

// Function to handle Airdrops tab (always active)
window.selectAirdropsTab = function(element) {
    element.classList.remove('text-[rgb(148,158,156)]');
    element.classList.add('text-white');
    const indicator = element.querySelector('.tab-indicator');
    if (indicator) {
        indicator.style.display = 'block';
    }
};

// Function to refresh tweet
window.refreshTweet = function() {
    const container = document.getElementById('tweet-list-container');
    if (container && window.TweetList && window.tweetRoot) {
        window.tweetRoot.render(React.createElement(window.TweetList, { 
            token: window.currentToken.toLowerCase(),
            key: Date.now() // Force re-render
        }));
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Select HYPE icon by default
    const hypeIcon = document.querySelector('img[alt="HYPE"]');
    if (hypeIcon) {
        window.selectIcon(hypeIcon);
    }
    
    // Initialize price data
    window.updatePriceData();

    // Add fast.png interaction
    const fastImage = document.querySelector('img[src="assets/fast.png"]');
    if (fastImage) {
        let isAnimating = false;
        let rotation = 0;
        
        fastImage.addEventListener('click', function() {
            if (!isAnimating) {
                isAnimating = true;
                rotation += 360;
                this.style.transform = `rotate(${rotation}deg)`;
                
                setTimeout(() => {
                    isAnimating = false;
                }, 500); // Match this with your CSS transition duration
            }
        });
    }
}); 