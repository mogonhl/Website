const LoadingScreen = ({ onLoadComplete }) => {
    const [showLogo, setShowLogo] = React.useState(false);
    const [stickers, setStickers] = React.useState([]);
    const nextStickerId = React.useRef(0);
    const containerRef = React.useRef(null);

    React.useEffect(() => {
        // Prevent scrolling when loading screen is shown
        document.body.style.overflow = 'hidden';
        
        // Show logo after a delay
        const timer = setTimeout(() => {
            setShowLogo(true);
        }, 2000);

        return () => {
            clearTimeout(timer);
            // Re-enable scrolling when component unmounts
            document.body.style.overflow = '';
        };
    }, []);

    const handleLogoClick = () => {
        const newSticker = {
            id: nextStickerId.current++
        };
        setStickers(prev => [...prev, newSticker]);
    };

    const handleStickerAnimationEnd = (stickerId) => {
        setStickers(prev => prev.filter(s => s.id !== stickerId));
    };

    return React.createElement('div', {
        ref: containerRef,
        className: 'fixed top-0 left-0 w-full h-screen bg-black',
        style: { zIndex: 50 }
    },
        // Container for stickers and logo
        React.createElement('div', {
            className: 'relative w-full h-full'
        },
            // Stickers container
            React.createElement('div', {
                className: 'absolute inset-0 overflow-hidden pointer-events-none'
            },
                stickers.map(sticker => 
                    React.createElement(FallingSticker, {
                        key: sticker.id,
                        onAnimationEnd: () => handleStickerAnimationEnd(sticker.id)
                    })
                )
            ),
            // Logo container
            React.createElement('div', {
                className: 'relative h-full flex items-center justify-center'
            },
                showLogo && React.createElement('img', {
                    src: '/assets/logo.png',
                    alt: 'Logo',
                    className: 'w-64 h-64 cursor-pointer transition-opacity duration-1000 opacity-100',
                    onClick: handleLogoClick,
                    onDoubleClick: onLoadComplete
                })
            )
        )
    );
};

export default LoadingScreen; 