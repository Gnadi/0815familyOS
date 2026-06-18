import { Head } from 'vite-react-ssg';
import { SITE_URL, SITE_NAME, OG_IMAGE_PATH } from '../../config/site';

// Per-route SEO metadata. Built on vite-react-ssg's <Head> (react-helmet-async
// under the hood) so the tags are injected into the pre-rendered static HTML
// AND kept in sync on the client after hydration.
//
// Props:
//   title        full <title> / og:title / twitter:title
//   description   meta description (~50-160 chars, unique per page)
//   path          absolute path on the brand domain, e.g. '/' (for canonical/og:url)
//   image         OG/Twitter image path (defaults to the 1200x630 PNG)
//   type          og:type (default 'website')
//   jsonLd        optional object rendered as a JSON-LD <script>
//   noindex       when true, emit robots noindex (e.g. for thin auth pages)
export default function Seo({
  title,
  description,
  path = '/',
  image = OG_IMAGE_PATH,
  type = 'website',
  jsonLd,
  noindex = false,
}) {
  const url = `${SITE_URL}${path}`;
  const imageUrl = image.startsWith('http') ? image : `${SITE_URL}${image}`;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content={noindex ? 'noindex,follow' : 'index,follow'} />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Head>
  );
}
