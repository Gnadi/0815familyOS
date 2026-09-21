import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const apiDir = fileURLToPath(new URL('./api/', import.meta.url));

// `vite dev` only serves the SPA; the functions in api/ are a Vercel thing and
// would 404 locally, which makes anything that talks to one (the calendar feed
// proxy, the voice assistant) undevelopable without deploying. This runs them
// in-process with a minimal Vercel-shaped req/res, and only during `dev`.
function devApiPlugin() {
  return {
    name: 'faos-dev-api',
    apply: 'serve',

    // Server-side secrets (provider API keys) are deliberately NOT VITE_*, so
    // Vite does not expose them to the client -- which also means it does not
    // load them at all. Read the same .env into process.env for the handlers,
    // without overriding anything the shell already set.
    config(_config, { mode }) {
      const env = loadEnv(mode, process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
      return null;
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        const [pathname, search = ''] = req.url.split('?');
        const name = pathname.slice('/api/'.length).replace(/\/+$/, '');
        // Same routing rules as Vercel: one file per route, `_`-prefixed files
        // are helpers and never routes.
        if (!/^[A-Za-z0-9-]+$/.test(name)) return next();
        const file = `${apiDir}${name}.js`;
        if (!existsSync(file)) return next();

        req.query = Object.fromEntries(new URLSearchParams(search));
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString('utf-8');
          try {
            req.body = raw ? JSON.parse(raw) : undefined;
          } catch {
            req.body = raw;
          }
        }
        res.status = (code) => {
          res.statusCode = code;
          return res;
        };
        res.json = (payload) => {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(payload));
          return res;
        };
        res.send = (payload) => {
          res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
          return res;
        };

        try {
          const mod = await server.ssrLoadModule(`/api/${name}.js`);
          await mod.default(req, res);
        } catch (err) {
          server.config.logger.error(`[dev-api] ${name}: ${err?.stack || err}`);
          if (!res.headersSent) res.status(500).json({ error: String(err?.message || err) });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApiPlugin()],
  server: { port: 5173, host: true },
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    // Emit child routes as <route>/index.html so static hosting serves
    // /privacy and /terms directly. The flat <route>.html style would need
    // Vercel's cleanUrls, which breaks the SPA rewrite (hard navigations to
    // app routes like /dashboard would 404).
    dirStyle: 'nested',
    // Pre-render ONLY the public marketing/legal pages. Auth/app routes stay
    // client-side (they depend on Firebase auth and must not be crawled).
    // Note: vite-react-ssg reports child routes without a leading slash.
    includedRoutes: (paths) =>
      paths.filter((path) => ['/', 'privacy', 'terms'].includes(path)),
  },
});
