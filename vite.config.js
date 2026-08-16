import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: 'esnext',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
