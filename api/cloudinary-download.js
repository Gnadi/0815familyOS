import { createHash } from 'crypto';
import { Readable } from 'stream';

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

  const upstream = await fetch(signedUrl);
  if (!upstream.ok) {
    return res.status(upstream.status).json({ error: 'File unavailable' });
  }

  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const filename = pathToSign.split('/').pop();

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  Readable.fromWeb(upstream.body).pipe(res);
}
