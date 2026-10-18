import dayjs from 'dayjs';

import Cliplet from 'src/main';

import { normalizeCliplet } from './cliplet-item';
import { ClipletStoreIdb } from './cliplet-store-idb';
import { ClipletStoreJson } from './cliplet-store-json';
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

    const prev = this._store;
    const next = await this.openStore(newType);
    try {
      // Copy first and persist the new type; the current storage is untouched until then.
      await next.replaceAll((await prev.list()).map(normalizeCliplet));
      this.plugin.settings.storageType = newType;
      await this.plugin.saveSettings();
    } catch (error) {
      this.plugin.settings.storageType = this.storageType;
      next.close();
      throw error;
    }

    this._store = next;
    this.storageType = newType;

    // A failure here only leaves stale copies behind, so it does not fail the switch.
    try {
      await prev.replaceAll([]);
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

  // Deletes the data in both storages, including stale copies left by a storage switch.
  async deleteDB(): Promise<void> {
    if (this._isClosed) {
      return;
    }
    this.closeDB();
    await new ClipletStoreJson(this.plugin).replaceAll([]);
    await deleteDatabase(this.vaultId);
  }

  async decrypt(value: string): Promise<string> {
    return crypto.decryptData(value, this._aesKey);
  }

  async encrypt(value: string): Promise<string> {
    return crypto.encryptData(value, this._aesKey);
  }

  async getCliplet(id: string): Promise<ClipletItem | undefined> {
    return this._store.get(id);
  }

  async getAllCliplets(): Promise<ClipletItem[]> {
    return (await this._store.list()).sort(compare);
  }

  // Ciphertexts differ on every encryption (random IV), so compare decrypted contents.
  async findClipletByContent(content: string): Promise<ClipletItem | undefined> {
    for (const cliplet of await this.getAllCliplets()) {
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

  // Keeps the newest unprotected cliplets so that the total stays within maxCount.
  async deleteExceededRecords(maxCount: number): Promise<void> {
    const cliplets = await this._store.list();
    const candidates = cliplets.filter((cliplet) => !isProtected(cliplet));
    const limit = maxCount - (cliplets.length - candidates.length);
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
