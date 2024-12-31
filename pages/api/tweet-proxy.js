import fetch from 'node-fetch';

const cleanContent = (html) => {
    // Replace <br> tags with newline characters before removing HTML
    let text = html.replace(/<br\s*\/?>/gi, '\n');
    
    // Remove all HTML tags but keep their content
    text = text.replace(/<[^>]+>/g, '');
    
    // Decode HTML entities
    text = text.replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'");
    
    // Remove URLs
    text = text.replace(/https?:\/\/\S+/g, '');
    
    // Remove t.co links
    text = text.replace(/\bt\.co\/\S+\b/g, '');
    
    // Remove Twitter media links
    text = text.replace(/pic\.twitter\.com\/\S+/g, '');
    
    // Remove quoted tweet indicators
    text = text.replace(/^RT @[^:]+: /g, '');  // Remove retweet prefix
    text = text.replace(/twitter\.com\/\S+/g, '');  // Remove Twitter URLs
    
    // Remove any Twitter-specific footer numbers (like 17.1.1925)
    text = text.replace(/\d{1,2}\.\d{1,2}\.\d{4}$/, '');
    
    // Clean up whitespace
    text = text.replace(/\s*\n\s*/g, '\n')  // Clean up space around newlines
              .replace(/[^\S\n]+/g, ' ')     // Replace multiple spaces with single space (except newlines)
              .trim();                        // Trim start and end
    
    // Remove empty lines and excessive spacing
    text = text.replace(/\n{3,}/g, '\n\n');  // Replace 3+ newlines with 2
    
    return text;
};

// Extract author info and content from HTML
const extractAuthorInfo = (html) => {
    // The author name and handle are in a blockquote element
    const blockquoteMatch = html.match(/<blockquote[^>]*>(.*?)<\/blockquote>/s);
    if (!blockquoteMatch) return { name: 'Unknown', handle: '' };
    
    const blockquote = blockquoteMatch[1];
    
    // Extract author name - it's in the first <a> tag
    const nameMatch = blockquote.match(/<a[^>]*>([^<]+)<\/a>/);
    const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
    
    // Extract handle - it's in the author URL
    const handleMatch = html.match(/twitter\.com\/([^/"]+)/);
    const handle = handleMatch ? handleMatch[1] : '';
    
    return { name, handle };
};

export default async function handler(req, res) {
    const { tweetId } = req.query;

    if (!tweetId) {
        return res.status(400).json({ error: 'Tweet ID is required' });
    }

    try {
        // First try with x.com
        const tweetUrl = `https://publish.twitter.com/oembed?url=https://twitter.com/x/status/${tweetId}&omit_script=true`;
        console.log('Fetching tweet from:', tweetUrl);

        const response = await fetch(tweetUrl);
        const responseText = await response.text();
        
        if (!response.ok) {
            // Try with twitter.com if x.com fails
            const altTweetUrl = `https://publish.twitter.com/oembed?url=https://twitter.com/twitter/status/${tweetId}&omit_script=true`;
            console.log('Retrying with alternative URL:', altTweetUrl);
            
            const altResponse = await fetch(altTweetUrl);
            const altResponseText = await altResponse.text();
            
            if (!altResponse.ok) {
                // If both fail, return default data
                const tweetDate = new Date(Number(BigInt(tweetId) >> 22n) + 1288834974657);
                return res.status(200).json({
                    author: {
                        name: 'The Crypto Dog',
                        handle: 'TheCryptoDog',
                        avatar: '/assets/GF_DID_A_LOGO.png'
                    },
                    content: 'Tweet not available',
                    date: tweetDate.toISOString()
                });
            }
            
            const altData = JSON.parse(altResponseText);
            const handle = altData.author_url ? altData.author_url.split('/').pop() : 'TheCryptoDog';
            const contentMatch = altData.html.match(/<p[^>]*>(.*?)<\/p>/s);
            
            const structured = {
                author: {
                    name: altData.author_name || 'The Crypto Dog',
                    handle: handle,
                    avatar: `https://unavatar.io/twitter/${handle}`,
                },
                content: contentMatch ? cleanContent(contentMatch[1]) : '',
                date: altData.cache_age ? new Date(Date.now() - altData.cache_age * 1000).toISOString() : null,
            };
            
            res.setHeader('Cache-Control', 's-maxage=3600');
            return res.status(200).json(structured);
        }

        const data = JSON.parse(responseText);
        const handle = data.author_url ? data.author_url.split('/').pop() : 'TheCryptoDog';
        const contentMatch = data.html.match(/<p[^>]*>(.*?)<\/p>/s);
        
        // Extract date from tweet ID
        const tweetDate = new Date(Number(BigInt(tweetId) >> 22n) + 1288834974657);
        
        const structured = {
            author: {
                name: data.author_name || 'The Crypto Dog',
                handle: handle,
                avatar: `https://unavatar.io/twitter/${handle}`,
            },
            content: contentMatch ? cleanContent(contentMatch[1]) : '',
            date: tweetDate.toISOString(),
        };

        res.setHeader('Cache-Control', 's-maxage=3600');
        res.status(200).json(structured);
    } catch (error) {
        console.error('Error in tweet-proxy:', error);
        // Return default data on error
        const tweetDate = new Date(Number(BigInt(tweetId) >> 22n) + 1288834974657);
        res.status(200).json({
            author: {
                name: 'The Crypto Dog',
                handle: 'TheCryptoDog',
                avatar: '/assets/GF_DID_A_LOGO.png'
            },
            content: 'Tweet not available',
            date: tweetDate.toISOString()
        });
    }
} 