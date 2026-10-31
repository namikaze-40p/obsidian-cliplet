import { StorageType } from './types';

const STORAGE_TYPES: readonly string[] = ['idb', 'json'] satisfies StorageType[];

export const isStorageType = (value: unknown): value is StorageType =>
  typeof value === 'string' && STORAGE_TYPES.includes(value);

// Prefers the storage type saved on this device. Before 0.4.0 it was synced in data.json,
// so each device takes that one over until it has its own.
export const resolveStorageType = (saved: unknown, synced: unknown): StorageType =>
  isStorageType(saved) ? saved : isStorageType(synced) ? synced : 'idb';
