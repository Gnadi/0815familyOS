const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

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
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Cloudinary is not configured.');
  }
  validateFile(file);
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    { method: 'POST', body: form }
  );
  if (!res.ok) throw new Error('Upload failed.');
  const data = await res.json();
  return { url: data.secure_url, publicId: data.public_id };
}
