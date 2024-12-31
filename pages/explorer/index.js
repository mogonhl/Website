import Head from 'next/head';
import ExplorerData from '../../components/ExplorerData';
import MainLayout from '../../components/MainLayout';
import '../../styles/navbar.css';

export default function Explorer() {
    return (
        <MainLayout>
            <Head>
                <title>Hyperliquid Explorer</title>
                <meta name="description" content="Real-time explorer for Hyperliquid trades and market data" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main>
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    <div className="px-4 sm:px-0">
                        <h1 className="text-4xl font-bold text-[rgba(72,255,225,0.9)] mb-8">
                            Hyperliquid Explorer
                        </h1>
                        <ExplorerData />
                    </div>
                </div>
            </main>
        </MainLayout>
    );
} 