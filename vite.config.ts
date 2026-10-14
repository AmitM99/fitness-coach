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
    host: true, // reachable from the phone on the same Wi-Fi
  },
});
