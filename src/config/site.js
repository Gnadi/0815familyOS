// Single source of truth for the public brand origin used in canonical/OG
// URLs and the sitemap. Override per environment with VITE_SITE_URL (e.g. on
// Vercel) — never point canonical URLs at a *.vercel.app preview domain.
// Update this default (and public/robots.txt + public/sitemap.xml) once the
// production domain is finalized.
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || 'https://familyos.example'
).replace(/\/$/, '');

export const SITE_NAME = 'Family OS';

// Default social preview image (PNG, 1200x630). Lives in /public.
export const OG_IMAGE_PATH = '/og-image.png';
