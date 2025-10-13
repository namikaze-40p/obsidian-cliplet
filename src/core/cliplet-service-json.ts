import { deleteDB, IDBPDatabase } from 'idb';

import crypto from './crypto';
import { ClipletDBSchema, getDbPromise } from './database';
import { ClipletStoreJson } from './cliplet-store-json';
import { MetaStore } from './meta-store';
import { ClipletItem, IClipletServiceBackend } from './types';
import Cliplet from 'src/main';

export class ClipletServiceJson implements IClipletServiceBackend {
  private constructor(
    private _db: IDBPDatabase<ClipletDBSchema> | null,
    private _store: ClipletStoreJson,
    private _aesKey: CryptoKey,
    private _legacyAesKey: CryptoKey,
  ) {}

  static async create(appId: string, plugin: Cliplet): Promise<ClipletServiceJson> {
    const db = await getDbPromise(appId);
    const meta = new MetaStore(db);
    const seed = await meta.getOrCreateSeed(appId);
    const key = await crypto.deriveKey(appId + seed, crypto.salt2);
    const legacySeed = meta.getOrCreateSeed(appId);
    const legacyKey = await crypto.deriveKey(appId + legacySeed, crypto.salt2);
    const store = new ClipletStoreJson(plugin);
    return new ClipletServiceJson(db, store, key, legacyKey);
  }

  destroy(): void {
    this.closeDB();
  }

  hasDB(): boolean {
    return !!this._db;
  }

  closeDB(): void {
    this._db?.close();
    this._db = null;
  }

  async deleteDB(): Promise<void> {
    if (!this._db) {
      return;
    }
    const name = this._db.name;
    this._db.close();
    this._db = null;
    await this.deleteAllCliplets();
    await deleteDB(name);
  }

  async decrypt(value: string): Promise<string> {
    try {
      return await crypto.decryptData(value, this._aesKey);
    } catch {
      return await crypto.decryptData(value, this._legacyAesKey);
    }
  }

  async encrypt(value: string): Promise<string> {
    return await crypto.encryptData(value, this._aesKey);
  }

  async getCliplet(id: string): Promise<ClipletItem | undefined> {
    return this._store.get(id);
  }

  async getAllCliplets(): Promise<ClipletItem[]> {
    return await this._store.list();
  }

  async addCliplet(value: ClipletItem): Promise<string> {
    return this._store.add(value);
  }

  async putCliplet(value: ClipletItem): Promise<void> {
    return this._store.put(value);
  }

  async deleteCliplet(id: string): Promise<void> {
    return this._store.delete(id);
  }

  async deleteAllCliplets(): Promise<void> {
    return this._store.deleteAll();
  }

  async deleteExceededRecords(maxCount: number): Promise<void> {
    return this._store.deleteExceededRecords(maxCount);
  }

  async deleteOverdueRecords(days: number): Promise<void> {
    return this._store.deleteOverdueRecords(days);
  }

  async migrateAllToNewKey(): Promise<void> {
    const cliplets = await this._store.list();
    for (const cliplet of cliplets) {
      const plain = await this.decrypt(cliplet.content);
      const reEncryptedContent = await crypto.encryptData(plain, this._aesKey);
      await this._store.put({ ...cliplet, content: reEncryptedContent });
    }
  }
}
