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
    // Inline the above-the-fold CSS into the pre-rendered <head> and load the
    // rest asynchronously, so first paint no longer blocks on a separate CSS
    // request (big FCP/LCP win on high-latency networks).
    beastiesOptions: {
      // media-swap keeps the full stylesheet off the critical path: it loads
      // as media="print" then flips to all on load — reliably non-blocking.
      preload: 'media',
      pruneSource: true,
    },
  },
});
