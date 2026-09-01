import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ mode }) => {
  const publicPreview = mode === 'public-preview';
  const previewLock = {
    name: 'shoort-clips-public-preview-lock',
    transformIndexHtml(html) {
      if (!publicPreview) return html;
      return html
        .replace('<body id="top">', '<body id="top" data-public-preview="true">')
        .replace(/href="(?:app|register|trial-register|payment-success)\.html[^\"]*"/g, 'href="#preview-notice" data-preview-action="true" aria-disabled="true"')
        .replace('<a class="skip-link"', '<aside class="preview-banner" id="preview-notice" tabindex="-1" role="status"><strong>Website preview</strong><span>Accounts, applications, and purchases are currently closed.</span></aside><a class="skip-link"');
    },
  };

  return {
    root: './',
    publicDir: 'public',
    plugins: publicPreview ? [previewLock] : [],
    build: {
      outDir: 'dist',
      target: 'esnext',
      emptyOutDir: true,
      rollupOptions: {
        input: publicPreview ? {
          marketing: resolve(import.meta.dirname, 'index.html'),
          freeTrial: resolve(import.meta.dirname, 'free-trial.html'),
        } : {
          marketing: resolve(import.meta.dirname, 'index.html'),
          freeTrial: resolve(import.meta.dirname, 'free-trial.html'),
          register: resolve(import.meta.dirname, 'register.html'),
          trialRegister: resolve(import.meta.dirname, 'trial-register.html'),
          paymentSuccess: resolve(import.meta.dirname, 'payment-success.html'),
          app: resolve(import.meta.dirname, 'app.html'),
        },
      },
    },
    server: { port: 5173, open: false },
  };
});
