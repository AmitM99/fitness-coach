import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  // Root by default. Set VITE_BASE when serving from a sub-path, e.g. a
  // GitHub Pages project site: VITE_BASE=/FitnessCoach/ npm run build
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    port: 5180,
    // Localhost only by default; `npm run dev:lan` opens it to the Wi-Fi for the phone.
    host: '127.0.0.1',
  },
});
