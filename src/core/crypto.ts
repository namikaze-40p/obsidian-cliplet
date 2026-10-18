const orgCrypto = window.crypto;
const { subtle } = orgCrypto;
const getRandomValues = orgCrypto.getRandomValues.bind(orgCrypto);
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const HKDF_SALT_V1 = 'cliplet:salt:v1';
const HKDF_INFO_CEK_V1 = 'cliplet:cek:v1';
// Spreading a large array into String.fromCharCode exceeds the call stack limit.
const BASE64_CHUNK_SIZE = 0x8000;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE));
  }
  return btoa(binary);
};

const deriveKey = async (vaultId: string): Promise<CryptoKey> => {
  const ikm = encoder.encode(vaultId);
  const baseKey = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode(HKDF_SALT_V1),
      info: encoder.encode(HKDF_INFO_CEK_V1),
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

const encryptData = async (plaintext: string, key: CryptoKey): Promise<string> => {
  const iv = getRandomValues(new Uint8Array(12));
  const cipherText = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  const combined = new Uint8Array(iv.length + cipherText.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(cipherText), iv.length);
  return bytesToBase64(combined);
};

const decryptData = async (encoded: string, key: CryptoKey): Promise<string> => {
  const bytes = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const cipherText = bytes.slice(12);
  const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherText);
  return decoder.decode(decrypted);
};

const crypto = {
  deriveKey,
  encryptData,
  decryptData,
};

export default crypto;
