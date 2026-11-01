import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: fileURLToPath(new URL('../../assets/branding', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  server: { host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: Object.fromEntries([['context', 3001], ['automation', 3002], ['interaction', 3003], ['ai', 3010]].map(([service, port]) => [
      `^/services/${service}(?:/|$)`, { target: `http://127.0.0.1:${port}`, changeOrigin: true,
        rewrite: (path: string) => path.replace(new RegExp(`^/services/${service}(?=/|$)`), '') },
    ])),
  },
  build: { outDir: '../../dist/apps/web', emptyOutDir: true },
});
