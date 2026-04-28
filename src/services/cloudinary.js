const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'xls', 'xlsx'];

export function validateFile(file) {
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('File exceeds the 2 GB size limit.');
  }
  const ext = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error('Only PDF, DOCX, XLS, and XLSX files are allowed.');
  }
}

export async function uploadFile(file) {
  if (!CLOUD_NAME) {
    throw new Error('Cloudinary is not configured.');
  }
  validateFile(file);

  // Fetch a short-lived signed token from the server — the API secret never
  // leaves the server, so the upload is signed without exposing credentials.
  const signRes = await fetch('/api/cloudinary-sign');
  if (!signRes.ok) throw new Error('Could not get upload credentials.');
  const { timestamp, signature, folder, apiKey, resourceType } = await signRes.json();

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', apiKey);
  form.append('timestamp', timestamp);
  form.append('signature', signature);
  form.append('folder', folder);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: 'POST', body: form }
  );
  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Upload failed.');
  }
  const data = await uploadRes.json();
  return { url: data.secure_url, publicId: data.public_id };
}
