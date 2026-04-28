import { createHash } from 'crypto';

export default function handler(req, res) {
  const secret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;

  if (!secret || !apiKey) {
    res.status(500).json({ error: 'Cloudinary credentials not configured.' });
    return;
  }

  const folder = 'familyos/documents';
  const resourceType = 'auto'; // Cloudinary detects type: PDFs → image (Content-Type: application/pdf), office files → raw
  const timestamp = Math.round(Date.now() / 1000);

  const signature = createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${secret}`)
    .digest('hex');

  res.json({ timestamp, signature, folder, apiKey, resourceType });
}
