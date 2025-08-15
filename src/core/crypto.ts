const orgCrypto = globalThis.crypto;
const { subtle } = orgCrypto;
const getRandomValues = orgCrypto.getRandomValues.bind(orgCrypto);
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const salt1 = encoder.encode('cliplet-salt1');
const salt2 = encoder.encode('cliplet-salt2');

const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
	const baseKey = await subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
	return await subtle.deriveKey(
		{ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
		baseKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
};

const encryptData = async (plaintext: string, key: CryptoKey): Promise<string> => {
	const iv = getRandomValues(new Uint8Array(12));
	const cipherText = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
	const combined = new Uint8Array(iv.length + cipherText.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(cipherText), iv.length);
	return btoa(String.fromCharCode(...combined));
};

const decryptData = async (encoded: string, key: CryptoKey): Promise<string> => {
	const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
	const iv = bytes.slice(0, 12);
	const cipherText = bytes.slice(12);
	const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherText);
	return decoder.decode(decrypted);
};

const crypto = {
	salt1,
	salt2,
	deriveKey,
	encryptData,
	decryptData,
};

export default crypto;
