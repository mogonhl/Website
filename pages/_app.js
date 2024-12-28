import { useEffect } from 'react';
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    // Only run on root route
    if (router.pathname !== '/') {
      return;
    }

    // Client-side mobile detection
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|Windows Phone|Mobile|Tablet/i.test(navigator.userAgent);

    if (isMobile) {
      router.push('/mobile');
    }
  }, [router.pathname]);

  return <Component {...pageProps} />;
}

export default MyApp; 