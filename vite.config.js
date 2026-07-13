import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    // Pre-render ONLY the public marketing/legal pages. Auth/app routes stay
    // client-side (they depend on Firebase auth and must not be crawled).
    // Note: vite-react-ssg reports child routes without a leading slash.
    includedRoutes: (paths) =>
      paths.filter((path) => ['/', 'privacy', 'terms'].includes(path)),
  },
});
