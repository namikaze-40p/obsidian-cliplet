import dayjs from 'dayjs';
import { IDBPDatabase } from 'idb';

import { ClipletDBSchema } from './database';
import { ClipletItem } from './types';

const STORE_NAME = 'cliplet';

export class ClipletStoreIdb {
  private readonly _version = 1;

  constructor(private _db: IDBPDatabase<ClipletDBSchema>) {}

  async get(id: string): Promise<ClipletItem | undefined> {
    return await this._db.get(STORE_NAME, id);
  }

  async list(): Promise<ClipletItem[]> {
    return await this._db.getAll(STORE_NAME);
  }

  async add(value: ClipletItem): Promise<string> {
    const existClipletId = await this.contentDuplicateId(value.content);
    if (existClipletId) {
      return existClipletId;
    } else {
      await this._db.add(STORE_NAME, value);
      return value.id;
    }
  }

  async put(value: ClipletItem): Promise<void> {
    await this._db.put(STORE_NAME, value);
  }

  async delete(id: string): Promise<void> {
    await this._db.delete(STORE_NAME, id);
  }

  async deleteAll(): Promise<void> {
    await this._db.clear(STORE_NAME);
  }

  async deleteExceededRecords(maxCount: number): Promise<void> {
    const tx = this._db.transaction(STORE_NAME, 'readwrite');
    const candidates: { key: IDBValidKey; latest: number }[] = [];

    for await (const cursor of tx.store.iterate()) {
      const record = cursor.value;
      if (this.isProtectedRecord(record)) {
        --maxCount;
        continue;
      }

      const latest = Math.max(record.created, record.lastUsed, record.lastModified);
      candidates.push({ key: cursor.primaryKey, latest });
    }

    if (candidates.length <= maxCount) {
      return;
    }

    const toDelete = candidates.sort((a, b) => b.latest - a.latest).slice(maxCount);
    for (const record of toDelete) {
      await tx.store.delete(record.key as string);
    }

    await tx.done;
  }

  async deleteOverdueRecords(days: number): Promise<void> {
    const threshold = Math.floor(dayjs().subtract(days, 'day').valueOf() / 1000);
    const tx = this._db.transaction(STORE_NAME, 'readwrite');

    for await (const cursor of tx.store.iterate()) {
      const record = cursor.value;
      if (this.isProtectedRecord(record)) {
        continue;
      }

      const latest = Math.max(record.created, record.lastUsed, record.lastModified);
      if (latest < threshold) {
        cursor.delete();
      }
    }

    await tx.done;
  }

  private async contentDuplicateId(content: string): Promise<string> {
    const cliplet = (await this.list()).find((cliplet) => cliplet.content === content);
    return cliplet ? cliplet.id : '';
  }

  private isProtectedRecord(record: ClipletItem): boolean {
    return (
      (typeof record.name === 'string' && record.name.trim() !== '') ||
      (typeof record.keyword === 'string' && record.keyword.trim() !== '') ||
      !!record.pinned
    );
  }
}
