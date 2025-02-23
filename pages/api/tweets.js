// Cache for storing tweets
let tweetCache = {
    data: null,
    timestamp: null,
    lastRequestTime: null
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const REQUEST_COOLDOWN = 2000; // 2 seconds between requests
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const TWITTER_USERNAME = 'purrg_hl'; // Twitter username

export default async function handler(req, res) {
    console.log('=== Twitter API Debug Info ===');
    console.log('Bearer token:', TWITTER_BEARER_TOKEN ? `${TWITTER_BEARER_TOKEN.substring(0, 10)}...` : 'missing');
    console.log('Username:', TWITTER_USERNAME);

    // Validate bearer token format
    if (!TWITTER_BEARER_TOKEN || !TWITTER_BEARER_TOKEN.startsWith('AAAA')) {
        console.error('Invalid Bearer Token format');
        return res.status(500).json({ 
            error: 'Twitter API not configured',
            message: 'Invalid Bearer Token format'
        });
    }

    try {
        const now = Date.now();

        // First, get the user ID from username
        console.log('Looking up user ID...');
        const userUrl = `https://api.twitter.com/2/users/by/username/${TWITTER_USERNAME}`;
        const userResponse = await fetch(userUrl, {
            headers: {
                'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`
            }
        });

        console.log('User lookup response:', userResponse.status);
        const userData = await userResponse.json();
        console.log('User data:', userData);

        if (!userResponse.ok || !userData.data || !userData.data.id) {
            throw new Error('Failed to find Twitter user: ' + TWITTER_USERNAME);
        }

        const userId = userData.data.id;
        console.log('Found user ID:', userId);

        // Now fetch tweets
        console.log('Fetching tweets...');
        const url = `https://api.twitter.com/2/users/${userId}/tweets?max_results=5&tweet.fields=created_at&exclude=retweets,replies`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
                'Accept': 'application/json'
            }
        });

        console.log('Tweet response status:', response.status);
        if (response.headers) {
            console.log('Rate limit info:', {
                limit: response.headers.get('x-rate-limit-limit'),
                remaining: response.headers.get('x-rate-limit-remaining'),
                reset: response.headers.get('x-rate-limit-reset')
            });
        }
        
        const data = await response.json();
        console.log('Raw API response:', data);

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Twitter API rate limit exceeded. Please try again in a few minutes.');
            }
            throw new Error(data.detail || data.error?.message || 'Failed to fetch tweets');
        }

        if (!data || !data.data || !Array.isArray(data.data)) {
            throw new Error('Invalid response format from Twitter API');
        }

        // Update cache with new data
        tweetCache = {
            data: data,
            timestamp: now,
            lastRequestTime: now
        };

        console.log('Successfully fetched tweets:', data.data.length);
        res.status(200).json(data);
    } catch (error) {
        console.error('=== Twitter API Error ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        // If we have cached data and hit rate limit, return cache
        if (error.message.includes('rate limit') && tweetCache.data) {
            console.log('Rate limited, returning cached data');
            return res.status(200).json(tweetCache.data);
        }
        
        res.status(500).json({ 
            error: 'Failed to fetch tweets',
            message: error.message,
            details: 'Check server logs for more information'
        });
    }
} 