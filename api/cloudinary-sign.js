import { createHash } from 'crypto';
import { verifyFamilyMember } from './_lib/familyMember.js';

// A signature is permission to upload to the Cloudinary account, so it is only
// handed to members of a family -- the people the document vault is for. It
// used to be signed for any caller, which made the account a free file host
// for anyone who found this URL in the app's JavaScript.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const secret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;

  if (!secret || !apiKey) {
    res.status(500).json({ error: 'Cloudinary credentials not configured.' });
    return;
  }

  const member = await verifyFamilyMember(req);
  if (!member.ok) {
    res.status(member.status).json({ error: member.error });
    return;
  }

  const isRaw = req.query?.resource_type === 'raw';
  const folder = 'familyos/documents';
  const resourceType = isRaw ? 'raw' : 'auto';
  const timestamp = Math.round(Date.now() / 1000);

  const signature = createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}${secret}`)
    .digest('hex');

  res.json({ timestamp, signature, folder, apiKey, resourceType });
}
