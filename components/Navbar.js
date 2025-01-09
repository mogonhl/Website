import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Navbar() {
    const router = useRouter();
    const currentPath = router.pathname;

    return (
        <nav className="bg-purple-600 border-b border-[#0a2622]">
            <div className="flex justify-between items-center h-16 px-6">
                <div className="flex items-center">
                    <Link href="/" className="flex items-center justify-center h-16">
                        <img src="/assets/Purrgem.png" alt="Logo" className="h-8 w-17 object-contain" />
                    </Link>
                    <div className="flex items-center gap-8 ml-8 mt-0.5">
                        <Link 
                            href="/airdrops" 
                            className={`nav-link ${currentPath === '/airdrops' ? 'active' : ''}`}
                        >
                            Airdrops
                        </Link>
                        <Link href="#" className="nav-link">Ecosystem</Link>
                        <Link href="#" className="nav-link">Layer 1s</Link>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Link 
                        href="/explorer" 
                        className={`nav-link ${currentPath === '/airdrops' ? '' : 'active'}`}
                    >
                        Explorer
                    </Link>
                    <a 
                        href="https://x.com/purrg_hl" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center justify-center"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                    </a>
                </div>
            </div>
        </nav>
    );
} 