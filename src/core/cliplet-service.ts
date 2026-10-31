import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';

import Cliplet from 'src/main';

import { normalizeCliplet } from './cliplet-item';
import { ClipletStoreIdb } from './cliplet-store-idb';
import { ClipletStoreJson } from './cliplet-store-json';
import { MAXIMUM_RECORDS, MINIMUM_UNPROTECTED_RECORDS } from './consts';
import crypto from './crypto';
import { deleteDatabase } from './database';
import { ClipletItem, IClipletStore, StorageType } from './types';

const latestTime = (cliplet: ClipletItem): number =>
  Math.max(cliplet.created, cliplet.lastUsed, cliplet.lastModified);

// Protected cliplets are never deleted automatically.
const isProtected = (cliplet: ClipletItem): boolean =>
  (typeof cliplet.name === 'string' && cliplet.name.trim() !== '') ||
  (typeof cliplet.keyword === 'string' && cliplet.keyword.trim() !== '') ||
  !!cliplet.pinned;

// Merges by id; when both lists have the same cliplet, the more recently updated one wins.
const mergeCliplets = (a: ClipletItem[], b: ClipletItem[]): ClipletItem[] => {
  const merged = new Map(a.map((cliplet) => [cliplet.id, cliplet]));
  for (const cliplet of b) {
    const other = merged.get(cliplet.id);
    if (!other || latestTime(cliplet) > latestTime(other)) {
      merged.set(cliplet.id, cliplet);
    }
  }
  return [...merged.values()].map(normalizeCliplet);
};

const compare = (a: ClipletItem, b: ClipletItem): number => {
  if (b.pinned > a.pinned) {
    return 1;
  } else if (b.pinned < a.pinned) {
    return -1;
  }
  return latestTime(b) - latestTime(a);
};

export class ClipletService {
  private _store!: IClipletStore;
  private _aesKey!: CryptoKey;
  private _isClosed = false;

  constructor(
    private readonly vaultId: string,
    private readonly plugin: Cliplet,
    private storageType: StorageType,
  ) {}

  async init(): Promise<void> {
    this._aesKey = await crypto.deriveKey(this.vaultId);
    this._store = await this.openStore(this.storageType);
  }

  private async openStore(type: StorageType): Promise<IClipletStore> {
    return type === 'idb'
      ? await ClipletStoreIdb.open(this.vaultId)
      : new ClipletStoreJson(this.plugin);
  }

  async switchStorage(newType: StorageType): Promise<void> {
    if (newType === this.storageType) {
      return;
    }

    const prevType = this.storageType;
    const prev = this._store;
    const next = await this.openStore(newType);
    try {
      // Merge instead of overwriting: data.json may hold cliplets of other devices.
      // The current storage is untouched until the new type is saved.
      await next.replaceAll(mergeCliplets(await next.list(), await prev.list()));
      this.plugin.saveStorageType(newType);
    } catch (error) {
      next.close();
      throw error;
    }

    this._store = next;
    this.storageType = newType;

    // Failures below only leave extra or stale cliplets behind, so they do not fail the switch.
    try {
      await this.deleteExceededRecords(MAXIMUM_RECORDS, MINIMUM_UNPROTECTED_RECORDS);
    } catch (error) {
      console.error(error);
    }
    try {
      // data.json is kept, since other devices may still use it.
      if (prevType === 'idb') {
        await prev.replaceAll([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      prev.close();
    }
  }

  // False after the service is closed or all data is deleted; the plugin must be reloaded then.
  hasDB(): boolean {
    return !this._isClosed;
  }

  closeDB(): void {
    this._isClosed = true;
    this._store.close();
  }

  // Deletes the data of this device, including stale copies left by a storage switch.
  // data.json is shared with other devices, so it is cleared only when this device uses it.
  async deleteDB(): Promise<void> {
    if (this._isClosed) {
      return;
    }
    this.closeDB();
    if (this.storageType === 'json') {
      await new ClipletStoreJson(this.plugin).replaceAll([]);
    }
    await deleteDatabase(this.vaultId);
  }

  async decrypt(value: string): Promise<string> {
    return crypto.decryptData(value, this._aesKey);
  }

  async encrypt(value: string): Promise<string> {
    return crypto.encryptData(value, this._aesKey);
  }

  // Falls back to the most recently used cliplet when the id is not found, e.g. when
  // latestClipletId was synced from another device whose IndexedDB has different cliplets.
  async getLatestCliplet(id: string): Promise<ClipletItem | undefined> {
    const cliplet = id ? await this._store.get(id) : undefined;
    if (cliplet) {
      return cliplet;
    }
    const cliplets = await this._store.list();
    return cliplets.sort((a, b) => latestTime(b) - latestTime(a))[0];
  }

  async getAllCliplets(): Promise<ClipletItem[]> {
    return (await this._store.list()).sort(compare);
  }

  // Ciphertexts differ on every encryption (random IV), so compare decrypted contents.
  // Only cliplets whose ciphertext has the matching length can have the same content.
  async findClipletByContent(content: string): Promise<ClipletItem | undefined> {
    const length = crypto.getEncryptedLength(content);
    const candidates = (await this.getAllCliplets()).filter(
      (cliplet) => cliplet.content.length === length,
    );
    for (const cliplet of candidates) {
      try {
        if ((await this.decrypt(cliplet.content)) === content) {
          return cliplet;
        }
      } catch {
        // Skip records that cannot be decrypted.
      }
    }
    return undefined;
  }

  // Adds the content as a new cliplet, or marks the cliplet with the same content as used.
  async addContent(content: string): Promise<{ id: string; isNew: boolean }> {
    const now = dayjs().unix();
    const duplicate = await this.findClipletByContent(content);
    if (duplicate) {
      await this.putCliplet({ ...duplicate, lastUsed: now });
      return { id: duplicate.id, isNew: false };
    }

    const id = await this.addCliplet({
      id: uuid(),
      name: '',
      content: await this.encrypt(content),
      type: 'text',
      keyword: '',
      pinned: 0,
      count: 0,
      created: now,
      lastUsed: 0,
      lastModified: 0,
    });
    return { id, isNew: true };
  }

  async addCliplet(value: ClipletItem): Promise<string> {
    await this._store.add(normalizeCliplet(value));
    return value.id;
  }

  async putCliplet(value: ClipletItem): Promise<void> {
    await this._store.put(normalizeCliplet(value));
  }

  async deleteCliplet(id: string): Promise<void> {
    await this._store.deleteMany([id]);
  }

  async deleteCliplets(ids: string[]): Promise<void> {
    await this._store.deleteMany(ids);
  }

  // Keeps the newest unprotected cliplets so that the total stays within maxCount,
  // but always keeps at least minUnprotected of them.
  async deleteExceededRecords(maxCount: number, minUnprotected: number): Promise<void> {
    const cliplets = await this._store.list();
    const candidates = cliplets.filter((cliplet) => !isProtected(cliplet));
    const limit = Math.max(maxCount - (cliplets.length - candidates.length), minUnprotected);
    if (candidates.length <= limit) {
      return;
    }
    const ids = candidates
      .sort((a, b) => latestTime(b) - latestTime(a))
      .slice(limit)
      .map(({ id }) => id);
    await this._store.deleteMany(ids);
  }

  async deleteOverdueRecords(days: number): Promise<void> {
    const threshold = Math.floor(dayjs().subtract(days, 'day').valueOf() / 1000);
    const ids = (await this._store.list())
      .filter((cliplet) => !isProtected(cliplet) && latestTime(cliplet) < threshold)
      .map(({ id }) => id);
    await this._store.deleteMany(ids);
  }
}
