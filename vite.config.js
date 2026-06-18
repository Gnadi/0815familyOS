import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    // Pre-render ONLY the public marketing landing page. Auth/app routes stay
    // client-side (they depend on Firebase auth and must not be crawled).
    includedRoutes: (paths) => paths.filter((path) => path === '/'),
  },
});
