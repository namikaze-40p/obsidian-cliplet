import { deleteDB, IDBPDatabase } from 'idb';

import Cliplet from 'src/main';
import crypto from './crypto';
import { ClipletStoreJson } from './cliplet-store-json';
import { ClipletDBSchema, getDbPromise } from './database';
import { ClipletItem, IClipletServiceBackend } from './types';

export class ClipletServiceJson implements IClipletServiceBackend {
  private constructor(
    private _db: IDBPDatabase<ClipletDBSchema> | null,
    private _store: ClipletStoreJson,
    private _aesKey: CryptoKey,
  ) {}

  static async create(vaultId: string, plugin: Cliplet): Promise<ClipletServiceJson> {
    const db = await getDbPromise(vaultId);
    const key = await crypto.deriveKey(vaultId);
    const store = new ClipletStoreJson(plugin);
    return new ClipletServiceJson(db, store, key);
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
}
