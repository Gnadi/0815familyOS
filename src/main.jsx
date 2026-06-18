import { ViteReactSSG } from 'vite-react-ssg';
import { routes } from './routes';
import './index.css';

// vite-react-ssg owns the router (it swaps between a static router at build
// time and a browser router on the client) and the HelmetProvider used by the
// <Head> component. App-wide providers live in RootLayout (the root route).
export const createRoot = ViteReactSSG({ routes });
