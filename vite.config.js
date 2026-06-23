import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? '/taco/' : '/',
  optimizeDeps: {
    exclude: ['mapbox-gl'],
  },
  build: {
    chunkSizeWarningLimit: 2000,
  }
});
