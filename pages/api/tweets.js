// Cache for storing tweets
let tweetCache = {
    data: null,
    timestamp: null,
    lastRequestTime: null,
    errorCount: 0
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const REQUEST_COOLDOWN = 2000; // 2 seconds between requests
const MAX_ERROR_COUNT = 3;
const USER_ID = '841892678040190976';
const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAAPFyxwEAAAAA1X4W1ezVhEAzXwpTdyw2cMdqlag%3DNCLw8e3kFYimKV6ChVILcCnF5DGia7NhW5ENqv259JiOG1P6mz';

// Upstash Redis configuration
const UPSTASH_REDIS_REST_URL = 'https://witty-dassie-40050.upstash.io';
const UPSTASH_REDIS_REST_TOKEN = 'AZxyAAIjcDE3Mzk2MTJkNzJjMDg0Yzk0ODMyZWE3YmRjOGRmZTQxZHAxMA';

async function saveToRedis(data) {
    try {
        console.log('Attempting to save to Redis...');
        console.log('Data length:', data.length);
        console.log('Data sample:', data[0]);
        
        const response = await fetch(`${UPSTASH_REDIS_REST_URL}/set/Twitter`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        console.log('Redis response status:', response.status);
        const result = await response.json();
        console.log('Redis response:', result);

        if (!response.ok) {
            throw new Error(`Failed to save to Redis: ${response.status}`);
        }

        return result;
    } catch (error) {
        console.error('Redis save error:', error);
        throw error;
    }
}

function extractPURRGLogNumber(text) {
    const match = text.match(/\/PURRG_LOG\s*#?(\d+)/);
    return match ? match[1] : null;
}

function formatTweetText(text, urls) {
    // Remove URLs from the text
    if (urls) {
        urls.forEach(url => {
            text = text.replace(url.url, '');
        });
    }

    // Clean up the text
    text = text.trim();

    // Split into paragraphs
    const paragraphs = text.split('\n\n').map(p => p.trim()).filter(Boolean);
    
    return {
        title: paragraphs[0], // First paragraph (contains PURRG_LOG)
        text: paragraphs[1] || '' // Second paragraph if it exists
    };
}

async function fetchTweets() {
    try {
        const response = await fetch(
            `https://api.twitter.com/2/users/${USER_ID}/tweets?max_results=100&tweet.fields=created_at,entities&expansions=attachments.media_keys&media.fields=url,preview_image_url,type`, {
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch tweets: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.data || !Array.isArray(data.data)) {
            throw new Error('Invalid response format');
        }

        // Filter and format tweets
        const formattedTweets = data.data
            .filter(tweet => tweet.text.includes('/PURRG_LOG'))
            .map(tweet => {
                const mediaKeys = tweet.attachments?.media_keys || [];
                const firstMedia = mediaKeys.length > 0 ? 
                    data.includes?.media?.find(m => m.media_key === mediaKeys[0]) : null;

                const { title, text } = formatTweetText(tweet.text, tweet.entities?.urls);
                const logNumber = extractPURRGLogNumber(title);

                return {
                    id: tweet.id,
                    date: tweet.created_at,
                    image: firstMedia ? (firstMedia.url || firstMedia.preview_image_url) : null,
                    title: logNumber ? `#${logNumber}` : title,
                    text: text
                };
            });

        // Save to Redis
        await saveToRedis(formattedTweets);

        return formattedTweets;
    } catch (error) {
        console.error('Fetch error:', error);
        throw error;
    }
}

async function fetchAndSaveTweets() {
    try {
        console.log('Fetching tweets from Twitter API...');
        const response = await fetch(
            `https://api.twitter.com/2/users/${USER_ID}/tweets?max_results=100&tweet.fields=created_at,entities&expansions=attachments.media_keys&media.fields=url,preview_image_url,type`, {
            headers: {
                'Authorization': `Bearer ${BEARER_TOKEN}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch tweets: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.data || !Array.isArray(data.data)) {
            throw new Error('Invalid response format');
        }

        // Filter and format tweets
        const formattedTweets = data.data
            .filter(tweet => tweet.text.includes('/PURRG_LOG'))
            .map(tweet => {
                const mediaKeys = tweet.attachments?.media_keys || [];
                const firstMedia = mediaKeys.length > 0 ? 
                    data.includes?.media?.find(m => m.media_key === mediaKeys[0]) : null;

                const { title, text } = formatTweetText(tweet.text, tweet.entities?.urls);
                const logNumber = extractPURRGLogNumber(title);

                return {
                    id: tweet.id,
                    date: tweet.created_at,
                    image: firstMedia ? (firstMedia.url || firstMedia.preview_image_url) : null,
                    title: logNumber ? `#${logNumber}` : title,
                    text: text
                };
            });

        // Save to Redis
        console.log('Saving tweets to Redis...');
        await saveToRedis(formattedTweets);
        console.log('Successfully saved tweets to Redis');

        return formattedTweets;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}

// Execute the script
fetchAndSaveTweets()
    .then(() => {
        console.log('Script completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    }); 