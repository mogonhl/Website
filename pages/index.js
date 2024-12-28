import { useEffect } from 'react';
import fs from 'fs';
import path from 'path';

export default function Home({ html }) {
  useEffect(() => {
    // Import scripts
    const script = document.createElement('script');
    script.src = '/script.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  );
}

export async function getStaticProps() {
  const htmlPath = path.join(process.cwd(), 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  
  return {
    props: {
      html,
    },
  };
} 