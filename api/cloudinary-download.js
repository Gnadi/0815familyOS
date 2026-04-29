import { createHash } from 'crypto';

export default function handler(req, res) {
  const secret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME;

  if (!secret || !apiKey || !cloudName) {
    return res.status(500).json({ error: 'Not configured' });
  }

  const { pid: publicId, rt: resourceType = 'image', fmt: format = 'pdf' } = req.query;

  if (!publicId || !publicId.startsWith('familyos/documents/')) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const expiresAt = timestamp + 300; // 5-minute window

  // Cloudinary Admin API signature: all params except api_key / resource_type / signature,
  // sorted alphabetically, then append api_secret — same pattern that signs uploads.
  const toSign = `expires_at=${expiresAt}&format=${format}&public_id=${publicId}&timestamp=${timestamp}&type=upload`;
  const signature = createHash('sha1').update(toSign + secret).digest('hex');

  const params = new URLSearchParams({
    public_id: publicId,
    format,
    type: 'upload',
    expires_at: expiresAt,
    timestamp,
    api_key: apiKey,
    signature,
  });

  // Cloudinary's /download endpoint authenticates via Admin API credentials and
  // returns the file with Content-Disposition: attachment — no delivery-URL
  // signing needed, and no file bytes pass through Vercel.
  res.redirect(302, `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/download?${params}`);
}
