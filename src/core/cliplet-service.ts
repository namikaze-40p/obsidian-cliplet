import Cliplet from 'src/main';
import { ClipletItem, IClipletServiceBackend, StorageType } from './types';
import { ClipletServiceIdb } from './cliplet-service-idb';
import { ClipletServiceJson } from './cliplet-service-json';

const compare = (a: ClipletItem, b: ClipletItem): number => {
  if (b.pinned > a.pinned) {
    return 1;
  } else if (b.pinned < a.pinned) {
    return -1;
  }
  return (
    Math.max(b.lastUsed, b.lastModified, b.created) -
    Math.max(a.lastUsed, a.lastModified, a.created)
  );
};

export class ClipletService {
  private _backend!: IClipletServiceBackend;

  constructor(
    private readonly appId: string,
    private readonly plugin: Cliplet,
    private storageType: StorageType,
  ) {}

  async init(): Promise<void> {
    this._backend = await this.createBackend(this.storageType);
  }

  private async createBackend(kind: StorageType): Promise<IClipletServiceBackend> {
    return kind === 'idb'
      ? await ClipletServiceIdb.create(this.appId)
      : await ClipletServiceJson.create(this.appId, this.plugin);
  }

  async switchStorage(newType: StorageType): Promise<void> {
    if (newType === this.storageType) {
      return;
    }

    const next = await this.createBackend(newType);

    const cliplets = await this._backend.getAllCliplets();
    await next.deleteAllCliplets();
    for (const cliplet of cliplets) {
      await next.addCliplet(cliplet);
    }

    await this._backend.deleteAllCliplets();
    this._backend.destroy();

    this._backend = next;
    this.storageType = newType;
  }

  hasDB(): boolean {
    return !!this._backend.hasDB();
  }

  closeDB(): void {
    this._backend.closeDB();
  }

  async deleteDB(): Promise<void> {
    await this._backend.deleteDB();
  }

  async decrypt(value: string): Promise<string> {
    return this._backend.decrypt(value);
  }

  async encrypt(value: string): Promise<string> {
    return this._backend.encrypt(value);
  }

  async getCliplet(id: string): Promise<ClipletItem | undefined> {
    return this._backend.getCliplet(id);
  }

  async getAllCliplets(): Promise<ClipletItem[]> {
    return (await this._backend.getAllCliplets()).sort(compare);
  }

  async addCliplet(value: ClipletItem): Promise<string> {
    return this._backend.addCliplet(value);
  }

  async putCliplet(value: ClipletItem): Promise<void> {
    return this._backend.putCliplet(value);
  }

  async deleteCliplet(id: string): Promise<void> {
    return this._backend.deleteCliplet(id);
  }

  async deleteAllCliplets(): Promise<void> {
    return this._backend.deleteAllCliplets();
  }

  async deleteExceededRecords(maxCount: number): Promise<void> {
    return this._backend.deleteExceededRecords(maxCount);
  }

  async deleteOverdueRecords(days: number): Promise<void> {
    return this._backend.deleteOverdueRecords(days);
  }

  async migrateAllToNewKey(): Promise<void> {
    return this._backend.migrateAllToNewKey();
  }
}
