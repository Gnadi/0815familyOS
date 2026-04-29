const ALGO = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

export async function generateEncryptionKey() {
  const key = await crypto.subtle.generateKey(
    { name: ALGO, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt'],
  );
  const jwk = await crypto.subtle.exportKey('jwk', key);
  return { key, jwk };
}

export async function importEncryptionKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: ALGO, length: KEY_LENGTH }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptBlob(key, blob) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const data = blob instanceof Blob ? await blob.arrayBuffer() : blob;
  const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, key, data);
  const result = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  result.set(iv);
  result.set(new Uint8Array(ciphertext), IV_LENGTH);
  return result.buffer;
}

export async function decryptBlob(key, encryptedBuffer, mimeType = 'application/octet-stream') {
  const bytes = new Uint8Array(encryptedBuffer);
  const iv = bytes.slice(0, IV_LENGTH);
  const ciphertext = bytes.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext);
  return new Blob([decrypted], { type: mimeType });
}
