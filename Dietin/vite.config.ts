import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import fs from 'fs'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      devOptions: {
        enabled: true,
        type: 'module'
      },
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', '11.png'],
      workbox: {
        navigateFallback: 'index.html',
        // Increase the max file size Workbox will precache (default is 2 MiB)
        // This avoids build errors when a generated JS chunk slightly exceeds the default threshold
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,gif,webp,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      },
      manifest: {
        name: 'Dietin',
        short_name: 'Dietin',
        description: 'AI-Powered Health & Nutrition Assistant',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen', 'minimal-ui'],
        background_color: '#ffffff',
        theme_color: '#ffffff',
        orientation: 'portrait-primary',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    }),
    {
      name: 'configure-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Handle video files with special headers to prevent caching issues
          if (req.url && req.url.match(/\.(mp4|webm|ogg)$/)) {
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

            // For local files, check if they exist and serve them directly
            const filePath = path.join(process.cwd(), 'public', req.url);
            if (fs.existsSync(filePath)) {
              const stream = fs.createReadStream(filePath);
              res.setHeader('Content-Type', `video/${path.extname(req.url).substring(1)}`);
              stream.pipe(res);
              return;
            }
          }
          next();
        });
      }
    }
  ],
  publicDir: 'public',
  base: './',
  server: {
    port: 3000,
    host: true, // Allow external access
    allowedHosts: ['c3ca67c6a535.ngrok-free.app', '.ngrok-free.app'],
    // Use standard HMR for local development; ngrok/proxies will still work if configured correctly
    // Removing the hardcoded wss/443 protocol which causes ERR_CONNECTION_REFUSED on localhost
    hmr: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    fs: {
      strict: false,
      allow: ['..']
    },
    proxy: {
      // Proxy backend PHP during local dev so PHP executes instead of serving raw source
      '/backend/cpanel': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend\/cpanel/, ''),
      },
      // Direct PHP endpoint used by Google OAuth token exchange
      // e.g., frontend calls fetch('/google-exchange.php', ...)
      '/google-exchange.php': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
      // If you have other PHP endpoints at web root during dev, add them here as needed
      // '/auth': { target: 'http://127.0.0.1:8081', changeOrigin: true },
      // '/api': { target: 'http://127.0.0.1:8081', changeOrigin: true },
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    },
  },
  define: {
    'process.env': {},
    'process.browser': true,
    'process.version': JSON.stringify(process.version)
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    copyPublicDir: true,
    assetsInlineLimit: 0, // Don't inline any assets as data URLs
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          animations: ['framer-motion']
        },
        assetFileNames: (assetInfo) => {
          // Keep the original file structure for media files
          const ext = assetInfo.name ? path.extname(assetInfo.name).toLowerCase() : '';
          if (ext.match(/\.(png|jpe?g|svg|gif)$/)) {
            return 'images/[name][extname]';
          }
          if (ext.match(/\.(mp4|webm|ogg)$/)) {
            return 'videos/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js'
      }
    }
  }
})
