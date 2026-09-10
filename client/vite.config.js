import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    {
      name: 'share-noindex',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = (req.url || '').split('?')[0];
          if (/^\/engagements\/[^/]+\/?$/.test(path)) {
            res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
          }
          next();
        });
      },
    },
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/output': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/pacq-app': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/assets': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: { outDir: 'dist' }
});
