import { useEffect } from 'react';
import Head from 'next/head';

export default function MobileHome() {
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
        <link rel="stylesheet" href="/styles.css" />
      </Head>
      
      <div className="text-wrapper mobile-only">
        <div className="text-line">
          <div className="dynamic-text-container">
            <span id="dynamic-text-mobile"></span>
          </div>
        </div>
      </div>
    </>
  );
} 