import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import esbuild from 'esbuild';

function sharedCjsToEsm() {
  return {
    name: 'shared-cjs-to-esm',
    enforce: 'pre',
    async transform(code, id) {
      const file = id.split('?')[0];
      if (!file.includes(`${path.sep}shared${path.sep}`) || !file.endsWith('.cjs')) return null;
      const result = await esbuild.transform(code, { loader: 'js', format: 'esm' });
      return { code: result.code, map: result.map || null };
    },
  };
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(repoRoot, 'shared'),
    },
  },
  plugins: [
    sharedCjsToEsm(),
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
    fs: { allow: [repoRoot] },
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
