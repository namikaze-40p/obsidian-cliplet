import { deleteDB, IDBPDatabase } from 'idb';

import { ClipletStoreIdb } from './cliplet-store-idb';
import crypto from './crypto';
import { ClipletDBSchema, getDbPromise } from './database';
import { ClipletItem, IClipletServiceBackend } from './types';

export class ClipletServiceIdb implements IClipletServiceBackend {
  private constructor(
    private _db: IDBPDatabase<ClipletDBSchema> | null,
    private _store: ClipletStoreIdb,
    private _aesKey: CryptoKey,
  ) {}

  static async create(vaultId: string): Promise<ClipletServiceIdb> {
    const db = await getDbPromise(vaultId);
    const key = await crypto.deriveKey(vaultId);
    const store = new ClipletStoreIdb(db);
    return new ClipletServiceIdb(db, store, key);
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
    await deleteDB(name);
  }

  async decrypt(value: string): Promise<string> {
    return await crypto.decryptData(value, this._aesKey);
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
    return this._store.add(this.normalizeObject(value));
  }

  async putCliplet(value: ClipletItem): Promise<void> {
    return this._store.put(this.normalizeObject(value));
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

  private normalizeObject(value: ClipletItem): ClipletItem {
    return {
      id: value.id,
      name: value.name,
      content: value.content,
      type: value.type,
      keyword: value.keyword,
      pinned: value.pinned,
      count: value.count,
      created: value.created,
      lastUsed: value.lastUsed,
      lastModified: value.lastModified,
    };
  }
}
