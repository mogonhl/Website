/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async headers() {
        return [
            {
                source: '/api/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Origin', value: '*' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
                    { key: 'Access-Control-Allow-Headers', value: 'Content-Type' }
                ]
            }
        ];
    },
    async rewrites() {
        return [
            {
                source: '/',
                destination: '/index.html'
            },
            {
                source: '/mobile',
                destination: '/pages/mobile/index.html'
            },
            {
                source: '/airdrops',
                destination: '/pages/airdrops/index.html'
            },
            {
                source: '/ecosystem',
                destination: '/pages/ecosystem/index.html'
            },
            {
                source: '/launches',
                destination: '/pages/launches/index.html'
            },
            {
                source: '/dashboard',
                destination: '/pages/dashboard/index.html'
            },
            {
                source: '/api/:path*',
                destination: '/api/:path*'
            },
            {
                source: '/assets/:path*',
                destination: '/assets/:path*'
            }
        ];
    }
}

module.exports = nextConfig 