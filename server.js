require('dotenv').config();
const express = require('express');
const next = require('next');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = express();

    // Mobile detection middleware - must come before static file serving
    server.use((req, res, next) => {
        // Skip for certain paths
        if (
            req.path.startsWith('/api') ||
            req.path.startsWith('/_next') ||
            req.path.startsWith('/assets') ||
            req.path === '/mobile' ||
            req.path.includes('.') // Skip for static files
        ) {
            return next();
        }

        // Check both standard user-agent and Chrome's mobile emulation header
        const userAgent = req.headers['user-agent'] || '';
        const isMobileDevice = /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent);
        const isMobileEmulation = req.headers['sec-ch-ua-mobile'] === '?1';

        if ((isMobileDevice || isMobileEmulation) && req.path === '/') {
            console.log('Mobile device detected, redirecting to mobile version');
            return res.redirect('/mobile');
        }

        next();
    });

    // Serve static files
    server.use(express.static(path.join(__dirname)));

    // Let next handle everything else
    server.all('*', (req, res) => {
        return handle(req, res);
    });

    server.listen(3000, (err) => {
        if (err) throw err;
        console.log('> Ready on http://localhost:3000');
    });
}); 