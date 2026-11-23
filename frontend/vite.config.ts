import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    // In development the browser calls /api on the Vite server, which forwards to the backend. xfwd passes the
    // browser's address on (X-Forwarded-For), so the backend records the real IP, not Vite's.
    proxy: {
      '/api': { target: 'http://localhost:5200', xfwd: true },
    },
  },
})
