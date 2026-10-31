import { describe, expect, it } from 'vitest';

import { resolveStorageType } from 'src/core/storage-type';

describe('resolveStorageType', () => {
  it('prefers the storage type saved on this device', () => {
    expect(resolveStorageType('json', 'idb')).toBe('json');
  });

  it('takes over the storage type synced in data.json', () => {
    expect(resolveStorageType(null, 'json')).toBe('json');
  });

  it('falls back to IndexedDB', () => {
    expect(resolveStorageType(null, undefined)).toBe('idb');
    expect(resolveStorageType('unknown', 'unknown')).toBe('idb');
  });
});
