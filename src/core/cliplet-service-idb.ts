import { deleteDB, IDBPDatabase } from 'idb';

import crypto from './crypto';
import { ClipletDBSchema, getDbPromise } from './database';
import { ClipletStoreIdb } from './cliplet-store-idb';
import { MetaStore } from './meta-store';
import { ClipletItem, IClipletServiceBackend } from './types';

export class ClipletServiceIdb implements IClipletServiceBackend {
  private static _instance: ClipletServiceIdb | null = null;
  private static _ready: Promise<ClipletServiceIdb> | null = null;

  private _db: IDBPDatabase<ClipletDBSchema> | null = null;
  private _store!: ClipletStoreIdb;
  private _aesKey!: CryptoKey;

  // Singleton: prevent direct instantiation. Use init() + instance.
  private constructor() {}

  static async init(appId: string): Promise<ClipletServiceIdb> {
    if (this._instance) {
      return this._instance;
    }
    if (this._ready) {
      return this._ready;
    }

    this._ready = (async () => {
      const service = new ClipletServiceIdb();
      service._db = await getDbPromise(appId);

      const basePassword = appId;
      const metaStore = new MetaStore(service._db);
      const seed = metaStore.getOrCreateSeed(basePassword);

      service._aesKey = await crypto.deriveKey(basePassword + seed, crypto.salt2);
      service._store = new ClipletStoreIdb(service._db);

      this._instance = service;
      this._ready = null;
      return service;
    })();

    return this._ready;
  }

  static get instance(): ClipletServiceIdb {
    if (!this._instance) {
      throw new Error('ClipletServiceIdb has not been initialized. Call init() first.');
    }
    return this._instance;
  }

  destroy(): void {
    this.closeDB();
    ClipletServiceIdb._instance = null;
    ClipletServiceIdb._ready = null;
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
