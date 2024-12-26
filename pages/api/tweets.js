// Sample tweet data
const PAPER_HANDS_TWEETS = [
    {
        id: '1',
        author: {
            name: 'Anon',
            handle: '0xfren',
            avatar: '/assets/anon.png'
        },
        content: 'Just sold my $HYPE airdrop for 2x. Easy money! 🎯',
        date: '2023-12-21',
        metrics: {
            likes: 2100,
            comments: 1400
        },
        sale: {
            price: 2.00,
            currentValue: 5830,
            multiplier: 191.5
        }
    },
    {
        id: '2',
        author: {
            name: 'DegenTrader',
            handle: 'degenfren',
            avatar: '/assets/anon.png'
        },
        content: '$HYPE is just another airdrop. Sold everything at $3.50. Don\'t be greedy anon. 🤝',
        date: '2023-12-22',
        metrics: {
            likes: 3200,
            comments: 2800
        },
        sale: {
            price: 3.50,
            currentValue: 10202,
            multiplier: 109.4
        }
    },
    {
        id: '3',
        author: {
            name: 'CryptoWizard',
            handle: 'wizardofcrypto',
            avatar: '/assets/anon.png'
        },
        content: 'Technical Analysis shows $HYPE is overbought at $5. Just sold my entire stack. Good luck holding the bag! 📊',
        date: '2023-12-23',
        metrics: {
            likes: 4500,
            comments: 3900
        },
        sale: {
            price: 5.00,
            currentValue: 14575,
            multiplier: 76.3
        }
    }
];

export default function handler(req, res) {
    if (req.method === 'GET') {
        // Return all tweets
        res.status(200).json(PAPER_HANDS_TWEETS);
    } else {
        res.status(405).json({ message: 'Method not allowed' });
    }
} 