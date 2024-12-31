// Function to handle icon selection
window.selectIcon = function(element) {
    // Remove selected class from all icons
    document.querySelectorAll('.airdrop-icon').forEach(icon => {
        icon.classList.remove('selected');
    });
    
    // Add selected class to clicked icon
    element.classList.add('selected');
    
    // Get the token symbol from the alt attribute
    const token = element.alt;
    
    // Update the current token
    window.currentToken = token;
    
    // Update price data and metrics
    if (window.updatePriceData) {
        window.updatePriceData();
    }
    
    // Update chart
    const timeRange = '7D';
    if (window.updateChart) {
        window.updateChart(token, timeRange);
    }
}; 