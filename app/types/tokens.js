// Token data structure
export const TOKENS = {
    HYPE: {
        id: 'hype',
        symbol: 'HYPE',
        name: 'Hyperliquid',
        coingeckoId: 'hyperliquid',
        initialPrice: 2.00,
        airdropAmount: 2915,
        desc1: 'The special one. The one to rule them all. The one illuminating the path forward.',
        desc2: 'Showing the true potential behind airdrops. Protocols are bound to follow. Like moths. Flying into the fire wielded by Jeff.',
        supply: 333900000
    },
    ARB: {
        id: 'arbitrum',
        symbol: 'ARB',
        name: 'Arbitrum',
        coingeckoId: 'arbitrum',
        initialPrice: 1.35,
        airdropAmount: 1859,
        desc1: 'A leading Layer 2 scaling solution built on Ethereum. Bla bla. They built a great bridge.',
        desc2: 'The ARB drop set a benchmark for how to distribute tokens. It was widely celebrated. Some would say the best L2 drop to date.',
        supply: 4210111900
    },
    FRIEND: {
        id: 'friend',
        symbol: 'FRIEND',
        name: 'Friend Tech',
        coingeckoId: 'friend-tech',
        initialPrice: 1.67,
        airdropAmount: 517,
        desc1: 'Revolutionary social trading platform on Base. A pyramid scheme for paid group avocates and KOLs.',
        desc2: 'The airdrop was... a spectacle. A prime example of the points meta acting as life support for shit products..',
        supply: 94824000
    },
    JTO: {
        id: 'jito',
        symbol: 'JTO',
        name: 'Jito',
        coingeckoId: 'jito-governance-token',
        initialPrice: 2.43,
        airdropAmount: 8120,
        desc1: 'A staking and MEV solution on Solana. Not particularly innovative as a product.',
        desc2: 'The aidrop was one of the all-time greats. Catching everyone off-guard. Pathing the way for SOl szn.',
        supply: 274669000
    },
    ME: {
        id: 'magic-eden',
        symbol: 'ME',
        name: 'Magic Eden',
        coingeckoId: 'magic-eden',
        initialPrice: 5.4,
        airdropAmount: 735.8,
        desc1: 'A protocol that benefited from the laissez-faire approach of Open Sea. Unfortunately that was their only value proposition.',
        desc2: 'Being less shit than competitors is worth something. Unlike the aidrop. Ordinals might change that...',
        supply: 129751000
    },
    PENGU: {
        id: 'pengu',
        symbol: 'PENGU',
        name: 'Pudgy Penguins',
        coingeckoId: 'pudgy-penguins',
        initialPrice: 0.0114,
        airdropAmount: 20800,
        desc1: 'An iconic NFT collection. An individuals comeback story. A global IP.',
        desc2: 'The oprah of airdrop distributions. Everyone got some dust. The real winners were long-term supporters. As it should be.',
        supply: 62860000000
    },
    UNI: {
        id: 'uniswap',
        symbol: 'UNI',
        name: 'Uniswap',
        coingeckoId: 'uniswap',
        initialPrice: 3.44,
        airdropAmount: 400,
        desc1: 'The true OG. On all levels.',
        desc2: 'A VCs dream. Infinite vesting. Why even work on anything? Thank you for DeFi Summer.',
        supply: 600480000
    },
    TIA: {
        id: 'celestia',
        symbol: 'TIA',
        name: 'Celestia',
        coingeckoId: 'celestia',
        initialPrice: 2.3,
        airdropAmount: 240,
        desc1: 'A chain to build chains to build chains to build chains...',
        desc2: 'An airdrop to get airdrops to get airdrops...',
        supply: 466000000
    },
    ENS: {
        id: 'ens',
        symbol: 'ENS',
        name: 'Ethereum Name Service',
        coingeckoId: 'ethereum-name-service',
        initialPrice: 43.44,
        airdropAmount: 182,
        desc1: 'Imagine you would have bought porn.com a few decades ago...',
        desc2: 'Well... .eth domains are worth shit now but you got a big aidrop at least.',
        supply: 33165000
    },
    JUP: {
        id: 'jupiter',
        symbol: 'JUP',
        name: 'Jupiter',
        coingeckoId: 'jupiter-exchange-solana',
        initialPrice: 0.66,
        airdropAmount: 200,
        desc1: 'An aggregator worth more than most DEXs. Showing that UX trumps everything.',
        desc2: 'The official end of Solana airdrop season. JLP is the true innovation.',
        supply: 1350000000
    },
    WEN: {
        id: 'wen',
        symbol: 'WEN',
        name: 'WEN',
        coingeckoId: 'wen-4',
        initialPrice: 0.0001,
        airdropAmount: 643652,
        desc1: 'A meme. Testing out Jupiters airdrop mechanism.',
        desc2: 'Dumped by most. Cherished by some. Who the fuck is still holding?',
        supply: 727600000000
    },
    AEVO: {
        id: 'aevo',
        symbol: 'AEVO',
        name: 'Aevo',
        coingeckoId: 'aevo-exchange',
        initialPrice: 3.22,
        airdropAmount: 120,
        desc1: 'Ribbon. More like robbin.',
        desc2: 'Create a new token, lock up the old one for a couple months. Allow your VC frens to exit. Gud tech.',
        supply: 902000000
    },
    ENA: {
        id: 'ethena',
        symbol: 'ENA',
        name: 'Ethena',
        coingeckoId: 'ethena',
        initialPrice: 0.787,
        airdropAmount: 780,
        desc1: 'Either this cycles Anchor or a revolutionary yield protocol. Why not both?',
        desc2: 'A new money block to build other shit on top of. Fun until it topples but that is crypto for you.',
        supply: 2937500000
    },
    W: {
        id: 'w',
        symbol: 'W',
        name: 'Wormhole',
        coingeckoId: 'wormhole',
        initialPrice: 1.33,
        airdropAmount: 1420,
        desc1: 'Cross-chain messaging protocol that got hacked for 320M. Now it is worth close to a bil.',
        desc2: 'TGE came out of nowhere making this one pretty big. Could have retired.',
        supply: 2790000000
    },
    ETHFI: {
        id: 'ethfi',
        symbol: 'ETHFI',
        name: 'Ether.Fi',
        coingeckoId: 'ether-fi',
        initialPrice: 3.14,
        airdropAmount: 575,
        desc1: 'The airdrop that made everyone fomo into liquid staking. Eigenlayer who?',
        desc2: 'Think 2008 housing crisis but on chain and you get a seat at the table.',
        supply: 217000000
    },
    ZRO: {
        id: 'zro',
        symbol: 'ZRO',
        name: 'LayerZero',
        coingeckoId: 'layerzero',
        initialPrice: 3.44,
        airdropAmount: 67,
        desc1: 'The OG omnichain protocol everyone loves (or not). Being first and having a moat is worth a lot.',
        desc2: 'Publicly screening for farmers and putting more work into that than in the protocol itself is a weird move.',
        supply: 111000000
    },
    STRK: {
        id: 'strk',
        symbol: 'STRK',
        name: 'Starknet',
        coingeckoId: 'starknet',
        initialPrice: 1.95,
        airdropAmount: 675,
        desc1: 'The tech is good. Supposedly...',
        desc2: 'Does not matter if you lack vibes. Cairo, zkSNARKs, Gaming, Brother.',
        supply: 2260000000
    },
    EIGEN: {
        id: 'eigen',
        symbol: 'EIGEN',
        name: 'Eigenlayer',
        coingeckoId: 'eigenlayer',
        initialPrice: 4.42,
        airdropAmount: 110,
        desc1: 'Restaking your restaked stake to restake some more. Then restake that on ETHFI. Black hole tech.',
        desc2: 'They waited just enough for the hype to die down. Sick strategy.',
        supply: 211000000
    },
    DBR: {
        id: 'dbr',
        symbol: 'DBR',
        name: 'deBridge',
        coingeckoId: 'debridge',
        initialPrice: 0.04,
        airdropAmount: 1200,
        desc1: 'First intent-based bridge. The first one to do it right. Good product. No value.',
        desc2: 'Jumping on the Points meta waggon is a dumb move. Especially for easy-to-farm bridges. See Orbiter.',
        supply: 1800000000
    }
};
