import { encryptBlob } from '../utils/encryption';
import { isDemoMode } from '../lib/demoMode';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

// 25 MB, down from 2 GB. The old figure was not a limit, it was a crash: an
// encrypted upload reads the whole file into memory to AES-GCM it (encryptBlob
// below), holding the plaintext, the ciphertext and the Blob at once. 25 MB
// comfortably covers a phone photo or a scanned multi-page PDF, which is what
// actually goes into a family document vault.
export const MAX_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_SIZE_LABEL = '25 MB';

// Photographs belong here. The vault previously took office documents only, so
// you could not put a vaccination card, a receipt or a certificate in it without
// finding a scanner first — which is most of what people actually want to keep.
// The encryption path is format-agnostic; this was only ever a list.
export const ALLOWED_EXTENSIONS = [
  'pdf', 'docx', 'xls', 'xlsx',
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif',
];

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

/** For a file input's `accept`, derived so the two cannot drift apart. */
export const FILE_ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',');

export function extensionOf(name) {
  return String(name || '').split('.').pop().toLowerCase();
}

/** True for the extensions a browser can render inline once decrypted. */
export function isImageFile(name) {
  return IMAGE_EXTENSIONS.includes(extensionOf(name));
}

// Errors carry a `code` so callers can render a localized message; the English
// `message` remains as a fallback for non-UI callers.
export function validateFile(file) {
  if (file.size > MAX_SIZE_BYTES) {
    const err = new Error(`File exceeds the ${MAX_SIZE_LABEL} size limit.`);
    err.code = 'file/too-large';
    throw err;
  }
  if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
    const err = new Error('Only documents (PDF, DOCX, XLS, XLSX) and photos (JPG, PNG, WEBP, HEIC) are allowed.');
    err.code = 'file/bad-type';
    throw err;
  }
}

export async function uploadFile(file, encryptionKey = null) {
  if (isDemoMode()) {
    const err = new Error('File uploads are disabled in the demo.');
    err.code = 'demo/upload-disabled';
    throw err;
  }
  if (!CLOUD_NAME) {
    throw new Error('Cloudinary is not configured.');
  }
  validateFile(file);

  let upload = file;
  const useRaw = Boolean(encryptionKey);

  if (encryptionKey) {
    const buf = await encryptBlob(encryptionKey, file);
    upload = new Blob([buf], { type: 'application/octet-stream' });
  }

  const signRes = await fetch(`/api/cloudinary-sign${useRaw ? '?resource_type=raw' : ''}`);
  if (!signRes.ok) throw new Error('Could not get upload credentials.');
  const { timestamp, signature, folder, apiKey, resourceType } = await signRes.json();

  const form = new FormData();
  form.append('file', upload, useRaw ? 'encrypted.dat' : file.name);
  form.append('api_key', apiKey);
  form.append('timestamp', timestamp);
  form.append('signature', signature);
  form.append('folder', folder);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: 'POST', body: form },
  );
  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Upload failed.');
  }
  const data = await uploadRes.json();
  return { url: data.secure_url, publicId: data.public_id };
}

/**
 * Remove an uploaded file from Cloudinary.
 *
 * The endpoint authorises by reading the owning Firestore document as the caller,
 * so it needs the current ID token and the document's id — see
 * api/cloudinary-destroy.js.
 *
 * `resourceType` follows the upload: encrypted files went up as `raw`, and an
 * unencrypted one as `auto`, which Cloudinary stores as `image` for photos.
 */
export async function destroyUploadedFile({ documentId, publicId, fileName }) {
  if (isDemoMode() || !publicId) return;

  const { getAuth } = await import('firebase/auth');
  const idToken = await getAuth().currentUser?.getIdToken();
  if (!idToken) throw new Error('Sign-in required.');

  const res = await fetch('/api/cloudinary-destroy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      documentId,
      publicId,
      resourceType: publicId.endsWith('.dat') || !isImageFile(fileName) ? 'raw' : 'image',
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const err = new Error(data?.error || 'Could not delete the stored file.');
    err.code = 'file/delete-failed';
    throw err;
  }
}
