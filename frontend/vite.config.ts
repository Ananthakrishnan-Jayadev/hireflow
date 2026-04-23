import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'static',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        career: resolve(__dirname, 'career.html'),
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:8000', changeOrigin: true },
      '/assets': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
});
