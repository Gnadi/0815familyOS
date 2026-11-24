import { encryptBlob } from '../utils/encryption';
import { isDemoMode } from '../lib/demoMode';
import { authorizationHeader } from '../lib/firebase';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

// 50 MB. The vault encrypts in the browser: encryptBlob() reads the whole file
// into memory, and AES-GCM via WebCrypto cannot stream, so plaintext,
// ciphertext and the upload Blob coexist -- roughly 3-4x the file size in RAM.
// On phones a few hundred MB already risks the tab being killed. The upload is
// also a single multipart request, which Cloudinary only accepts up to 100 MB
// (and many plans cap raw files far lower). Raising this needs a chunked,
// resumable upload with chunked encryption first.
export const MAX_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'xls', 'xlsx'];

// Errors carry a `code` so callers can render a localized message; the English
// `message` remains as a fallback for non-UI callers.
export function validateFile(file) {
  if (file.size > MAX_SIZE_BYTES) {
    const err = new Error('File exceeds the 50 MB size limit.');
    err.code = 'file/too-large';
    throw err;
  }
  const ext = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    const err = new Error('Only PDF, DOCX, XLS, and XLSX files are allowed.');
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

  const signRes = await fetch(`/api/cloudinary-sign${useRaw ? '?resource_type=raw' : ''}`, {
    headers: await authorizationHeader(),
  });
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
