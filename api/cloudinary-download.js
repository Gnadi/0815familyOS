import { createHash } from 'crypto';

export default function handler(req, res) {
  const secret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME;

  if (!secret || !cloudName) {
    return res.status(500).json({ error: 'Not configured' });
  }

  const { path: pathToSign, rt: resourceType = 'image' } = req.query;

  // Allow only paths within our documents folder to prevent signing
  // arbitrary Cloudinary paths.
  if (!pathToSign || !pathToSign.match(/familyos\/documents\//)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // Cloudinary signed URL: SHA-1 of (path_after_upload + api_secret), hex, first 8 chars.
  // The browser is redirected to the signed URL and loads the file
  // directly from Cloudinary CDN — no large-file streaming through Vercel.
  const sig = createHash('sha1')
    .update(pathToSign + secret)
    .digest('hex')
    .substring(0, 8);

  const signedUrl =
    `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/s--${sig}--/${pathToSign}`;

  res.redirect(302, signedUrl);
}
