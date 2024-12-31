import React from 'react';
import Navbar from './Navbar';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[#002420]">
      <Navbar />
      <main className="max-w-7xl mx-auto py-6 px-4">
        {children}
      </main>
      <footer className="bg-[#0f1a1f] border-t border-[#0a2622]">
        <div className="max-w-7xl mx-auto py-4 px-4">
          <p className="text-center text-[rgb(148,158,156)] text-sm">
            Powered by Hyperliquid Protocol
          </p>
        </div>
      </footer>
    </div>
  );
} 