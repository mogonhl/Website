import Head from 'next/head';
import { useEffect } from 'react';

export default function MobilePage() {
  useEffect(() => {
    // Import mobile-specific scripts
    const script = document.createElement('script');
    script.src = '/script.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <>
      <Head>
        <title>Mog Analytics - Mobile</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/mobile.css" />
      </Head>
      <div className="mobile-container">
        <div className="text-wrapper">
          <img src="/assets/logo.png" alt="Mog Logo" className="center-logo" />
          <div className="text-line">
            <div className="dynamic-text-container">
              <span id="dynamic-text-mobile"></span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 