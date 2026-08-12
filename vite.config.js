import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        desktop: 'index.html',
        web: 'web.html'
      }
    },
    // three.js is intentionally isolated behind the lazy three-engine boundary.
    chunkSizeWarningLimit: 600
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
