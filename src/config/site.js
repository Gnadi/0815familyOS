// Single source of truth for the public brand origin used in canonical/OG
// URLs and the sitemap. Override per environment with VITE_SITE_URL (e.g. on
// Vercel) — never point canonical URLs at a *.vercel.app preview domain.
// Keep this default in sync with public/robots.txt + public/sitemap.xml.
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || 'https://myfaos.app'
).replace(/\/$/, '');

export const SITE_NAME = 'myFAOS';

// Default social preview image (PNG, 1200x630). Lives in /public.
export const OG_IMAGE_PATH = '/og-image.png';
