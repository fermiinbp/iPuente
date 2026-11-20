// Configuración de Vite: plugin de React y alias @/ que apunta a client/src.
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En desarrollo /api se redirige a la API local. Si el puerto 3000 lo usa otra aplicación, arranca la API con
// PORT=3001 y el front con API_PROXY_TARGET=http://localhost:3001 (ver «Desarrollo en local» en el README).
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // MapLibre crea su worker con new URL(...): pre-empaquetarlo en dev rompe la ruta del worker.
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
});
