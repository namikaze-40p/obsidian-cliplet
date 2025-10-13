import { deleteDB, IDBPDatabase } from 'idb';

import crypto from './crypto';
import { ClipletDBSchema, getDbPromise } from './database';
import { ClipletStoreJson } from './cliplet-store-json';
import { MetaStore } from './meta-store';
import { ClipletItem, IClipletServiceBackend } from './types';
import Cliplet from 'src/main';

export class ClipletServiceJson implements IClipletServiceBackend {
  private static _instance: ClipletServiceJson | null = null;
  private static _ready: Promise<ClipletServiceJson> | null = null;

  private _db: IDBPDatabase<ClipletDBSchema> | null = null;
  private _store!: ClipletStoreJson;
  private _aesKey!: CryptoKey;

  // Singleton: prevent direct instantiation. Use init() + instance.
  private constructor() {}

  static async init(appId: string, plugin: Cliplet): Promise<ClipletServiceJson> {
    if (this._instance) {
      return this._instance;
    }
    if (this._ready) {
      return this._ready;
    }

    this._ready = (async () => {
      const service = new ClipletServiceJson();
      service._db = await getDbPromise(appId);

      const basePassword = appId;
      const metaStore = new MetaStore(service._db);
      const seed = metaStore.getOrCreateSeed(basePassword);

      service._aesKey = await crypto.deriveKey(basePassword + seed, crypto.salt2);
      service._store = new ClipletStoreJson(plugin);

      this._instance = service;
      this._ready = null;
      return service;
    })();

    return this._ready;
  }

  static get instance(): ClipletServiceJson {
    if (!this._instance) {
      throw new Error('ClipletServiceJson has not been initialized. Call init() first.');
    }
    return this._instance;
  }

  destroy(): void {
    this.closeDB();
    ClipletServiceJson._instance = null;
    ClipletServiceJson._ready = null;
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
