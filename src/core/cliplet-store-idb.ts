import { IDBPDatabase } from 'idb';

import { ClipletDBSchema, getDbPromise } from './database';
import { ClipletItem, IClipletStore } from './types';

const STORE_NAME = 'cliplet';

export class ClipletStoreIdb implements IClipletStore {
  private constructor(private _db: IDBPDatabase<ClipletDBSchema>) {}

  static async open(vaultId: string): Promise<ClipletStoreIdb> {
    return new ClipletStoreIdb(await getDbPromise(vaultId));
  }

  async get(id: string): Promise<ClipletItem | undefined> {
    return await this._db.get(STORE_NAME, id);
  }

  async list(): Promise<ClipletItem[]> {
    return await this._db.getAll(STORE_NAME);
  }

  async add(value: ClipletItem): Promise<void> {
    await this._db.add(STORE_NAME, value);
  }

  async put(value: ClipletItem): Promise<void> {
    const tx = this._db.transaction(STORE_NAME, 'readwrite');
    if ((await tx.store.getKey(value.id)) !== undefined) {
      await tx.store.put(value);
    }
    await tx.done;
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (!ids.length) {
      return;
    }
    const tx = this._db.transaction(STORE_NAME, 'readwrite');
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  }

  async replaceAll(values: ClipletItem[]): Promise<void> {
    const tx = this._db.transaction(STORE_NAME, 'readwrite');
    await Promise.all([tx.store.clear(), ...values.map((value) => tx.store.add(value)), tx.done]);
  }

  close(): void {
    this._db.close();
  }
}
