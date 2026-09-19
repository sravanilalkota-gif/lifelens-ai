import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The dev server binds 0.0.0.0 so it works inside containers / previews,
 * and proxies /api to the Express backend so the browser never needs to
 * know another origin (no CORS pain, no leaked API URLs).
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
