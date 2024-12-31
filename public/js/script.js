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
};

// Function to select a tab
window.selectTab = function(element, tabName) {
    // Remove active state from all tabs in the same group
    const tabGroup = element.closest('.flex');
    tabGroup.querySelectorAll('.text-sm').forEach(tab => {
        tab.classList.remove('text-white');
        tab.classList.add('text-[rgb(148,158,156)]');
        const indicator = tab.querySelector('.tab-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    });
    
    // Add active state to selected tab
    element.classList.remove('text-[rgb(148,158,156)]');
    element.classList.add('text-white');
    const indicator = element.querySelector('.tab-indicator');
    if (indicator) {
        indicator.style.display = 'block';
    }

    // Hide all content sections
    document.querySelectorAll('[id$="-content"]').forEach(content => {
        content.classList.add('hidden');
    });

    // Show selected content
    const selectedContent = document.getElementById(`${tabName}-content`);
    if (selectedContent) {
        selectedContent.classList.remove('hidden');
        
        // Initialize TweetList for Bag Fumbled tab
        if (tabName === 'bagFumbled') {
            const container = document.getElementById('tweet-list-container');
            if (container && window.TweetList) {
                if (!window.tweetRoot) {
                    window.tweetRoot = ReactDOM.createRoot(container);
                }
                window.tweetRoot.render(React.createElement(window.TweetList, { 
                    token: window.currentToken.toLowerCase()
                }));
            }
        }
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