import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: 'esnext',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        marketing: resolve(import.meta.dirname, 'index.html'),
        freeTrial: resolve(import.meta.dirname, 'free-trial.html'),
        register: resolve(import.meta.dirname, 'register.html'),
        trialRegister: resolve(import.meta.dirname, 'trial-register.html'),
        app: resolve(import.meta.dirname, 'app.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
