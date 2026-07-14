import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frontend wird nach ../frontend/dist gebaut und vom Express-Backend ausgeliefert.
// Im Dev-Modus proxyt Vite /api an das Backend auf Port 3000.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // im gesamten LAN erreichbar (Zugriff vom Handy via http://<Laptop-IP>:5173)
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Stabile Vendor-Bundles separat halten (Caching über App-Updates hinweg).
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': ['@mui/material', '@emotion/react', '@emotion/styled'],
        },
      },
    },
  },
});
