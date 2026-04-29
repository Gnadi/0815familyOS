import { createHash } from 'crypto';

export default async function handler(req, res) {
  const secret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME;

  if (!secret || !cloudName) {
    return res.status(500).json({ error: 'Not configured' });
  }

  const { path: pathToSign, rt: resourceType = 'image' } = req.query;

  if (!pathToSign || !pathToSign.match(/familyos\/documents\//)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const sig = createHash('sha1')
    .update(pathToSign + secret)
    .digest('hex')
    .substring(0, 8);

  const signedUrl =
    `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/s--${sig}--/${pathToSign}`;

  let upstream;
  try {
    upstream = await fetch(signedUrl);
  } catch (err) {
    return res.status(502).json({ error: 'Could not reach storage' });
  }

  if (!upstream.ok) {
    return res.status(upstream.status).json({ error: 'File unavailable' });
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const filename = decodeURIComponent(pathToSign.split('/').pop());

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}
