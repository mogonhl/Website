import React from 'react';
import Navbar from './Navbar';

export default function MainLayout({ children }) {
    return (
        <div className="min-h-screen">
            <Navbar />
            <main>
                {children}
            </main>
        </div>
    );
} 