import { describe, expect, it } from 'vitest';

import crypto from 'src/core/crypto';

describe('crypto', () => {
  it.each([
    ['empty', ''],
    ['multibyte and newlines', 'あa😀\n2行目'],
    ['chunk boundary', 'x'.repeat(0x8000)],
    ['large content (5MB)', 'x'.repeat(5_000_000)],
  ])('round-trips %s text', async (_, text) => {
    const key = await crypto.deriveKey('vault');
    expect(await crypto.decryptData(await crypto.encryptData(text, key), key)).toBe(text);
  });

  it('produces a different ciphertext for the same text each time', async () => {
    const key = await crypto.deriveKey('vault');
    expect(await crypto.encryptData('same', key)).not.toBe(await crypto.encryptData('same', key));
  });

  it('decrypts data encrypted by the previous base64 implementation', async () => {
    const key = await crypto.deriveKey('vault');
    const iv = new Uint8Array(12);
    const cipherText = new Uint8Array(
      await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode('legacy'),
      ),
    );
    const legacy = btoa(String.fromCharCode(...iv, ...cipherText));
    expect(await crypto.decryptData(legacy, key)).toBe('legacy');
  });

  it('fails to decrypt with a key from another vault', async () => {
    const encrypted = await crypto.encryptData('secret', await crypto.deriveKey('vault-a'));
    await expect(
      crypto.decryptData(encrypted, await crypto.deriveKey('vault-b')),
    ).rejects.toThrow();
  });
});
