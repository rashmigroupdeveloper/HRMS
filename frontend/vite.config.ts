import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Same-origin API during development; production is a vhost proxy (docs/02 §2).
      '/api': process.env['VITE_API_TARGET'] ?? 'http://localhost:5100',
    },
  },
});
