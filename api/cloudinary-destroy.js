import { createHash } from 'crypto';

/**
 * Delete a vault file from Cloudinary.
 *
 * Deleting the Firestore document left the encrypted file live at its URL
 * forever — `services/documents.js` said so in a comment. For a vault, "deleted"
 * meaning "still fetchable by anyone with the link" is the wrong semantics, so
 * this closes it.
 *
 * Unlike the sibling signing endpoint, this one authorises. An unauthenticated
 * upload endpoint is untidy; an unauthenticated *delete* endpoint would let
 * anyone on the internet destroy any family's documents, and verifying only that
 * the caller is signed in would still let one family delete another's.
 *
 * Two checks, neither needing firebase-admin:
 *
 *  1. The Firebase ID token is verified against the Identity Toolkit REST API.
 *  2. The document is looked up through the Firestore REST API **as the caller**,
 *     so the security rules decide whether they may see it. A file whose document
 *     the caller cannot read is a file they may not delete.
 *
 * The order matters to the client: destroy first, then delete the Firestore
 * document. The reverse would remove the only proof of ownership.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const secret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
  const webApiKey = process.env.FIREBASE_WEB_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

  if (!secret || !apiKey || !cloudName) {
    res.status(500).json({ error: 'Cloudinary credentials not configured.' });
    return;
  }
  if (!webApiKey || !projectId) {
    res.status(500).json({ error: 'Firebase credentials not configured.' });
    return;
  }

  const idToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { publicId, documentId, resourceType } = req.body || {};

  if (!idToken) {
    res.status(401).json({ error: 'Sign-in required.' });
    return;
  }
  if (!publicId || !documentId) {
    res.status(400).json({ error: 'publicId and documentId are required.' });
    return;
  }
  // Uploads all land in this folder. Refusing anything else keeps a caller from
  // aiming the endpoint at unrelated assets in the same Cloudinary account.
  if (!String(publicId).startsWith('familyos/documents/')) {
    res.status(400).json({ error: 'That asset is not a vault document.' });
    return;
  }

  try {
    // 1. Is this a real, current session?
    const lookup = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${webApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!lookup.ok) {
      res.status(401).json({ error: 'Sign-in required.' });
      return;
    }

    // 2. May this caller see the document that owns the file? Read as them, so
    //    firestore.rules answers rather than this endpoint guessing.
    const docRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/documents/${encodeURIComponent(documentId)}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    if (!docRes.ok) {
      res.status(403).json({ error: 'Not allowed to delete that file.' });
      return;
    }
    const stored = await docRes.json();
    // The document must actually carry the publicId being destroyed, or a member
    // could pass their own document id alongside someone else's file.
    if (stored?.fields?.filePublicId?.stringValue !== publicId) {
      res.status(403).json({ error: 'Not allowed to delete that file.' });
      return;
    }

    // 3. Destroy it.
    const timestamp = Math.round(Date.now() / 1000);
    const signature = createHash('sha1')
      .update(`public_id=${publicId}&timestamp=${timestamp}${secret}`)
      .digest('hex');

    const form = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      signature,
      api_key: apiKey,
    });
    const type = resourceType === 'image' ? 'image' : 'raw';
    const destroy = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${type}/destroy`,
      { method: 'POST', body: form },
    );
    const result = await destroy.json().catch(() => ({}));

    // Cloudinary answers 200 with result:'not found' for an asset already gone.
    // That is success from the caller's point of view — the file is not there.
    if (!destroy.ok || (result.result !== 'ok' && result.result !== 'not found')) {
      res.status(502).json({ error: result?.error?.message || 'Could not delete the file.' });
      return;
    }

    res.json({ result: result.result });
  } catch {
    res.status(500).json({ error: 'Could not delete the file.' });
  }
}
