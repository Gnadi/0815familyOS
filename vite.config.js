import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    // Emit child routes as <route>/index.html so static hosting serves
    // /privacy and /terms directly. The flat <route>.html style would need
    // Vercel's cleanUrls, which breaks the SPA rewrite to /index.html (hard
    // navigations to app routes like /dashboard would 404).
    dirStyle: 'nested',
    // Pre-render ONLY the public marketing/legal pages. Auth/app routes stay
    // client-side (they depend on Firebase auth and must not be crawled).
    // Note: vite-react-ssg reports child routes without a leading slash.
    includedRoutes: (paths) =>
      paths.filter((path) => ['/', 'privacy', 'terms'].includes(path)),
  },
});
