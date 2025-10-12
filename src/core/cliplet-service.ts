import Cliplet from 'src/main';
import { ClipletItem } from './types';
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
  private static _instance: ClipletService | null = null;
  private _service: ClipletServiceIdb | ClipletServiceJson;

  private get storageType(): string {
    return this._plugin.settings.storageType;
  }

  private constructor(
    private _appId: string,
    private _plugin: Cliplet,
  ) {}

  static async init(appId: string, plugin: Cliplet): Promise<ClipletService> {
    if (!this._instance) {
      this._instance = new ClipletService(appId, plugin);
      if (this._instance.storageType === 'idb') {
        await ClipletServiceIdb.init(appId);
        this._instance._service = ClipletServiceIdb.instance;
      } else {
        await ClipletServiceJson.init(appId, plugin);
        this._instance._service = ClipletServiceJson.instance;
      }
    }
    return this._instance;
  }

  static get instance(): ClipletService {
    if (this._instance) {
      return this._instance;
    } else {
      throw new Error('ClipletService has not been initialized. Call init() first.');
    }
  }

  async migrationStorageData(): Promise<void> {
    await ClipletServiceIdb.init(this._appId);
    await ClipletServiceJson.init(this._appId, this._plugin);
    const fromService =
      this.storageType === 'idb' ? ClipletServiceJson.instance : ClipletServiceIdb.instance;
    const toService =
      this.storageType === 'idb' ? ClipletServiceIdb.instance : ClipletServiceJson.instance;
    const cliplets = await fromService.getAllCliplets();
    await toService.deleteAllCliplets();
    cliplets.forEach(async (cliplet) => {
      await toService.addCliplet(cliplet);
    });
    await fromService.deleteAllCliplets();
    fromService.destroy();
    this._service = toService;
  }

  hasDB(): boolean {
    return !!this._service.hasDB();
  }

  closeDB(): void {
    this._service.closeDB();
  }

  async deleteDB(): Promise<void> {
    await this._service.deleteDB();
  }

  async decrypt(value: string): Promise<string> {
    return this._service.decrypt(value);
  }

  async encrypt(value: string): Promise<string> {
    return this._service.encrypt(value);
  }

  async getCliplet(id: string): Promise<ClipletItem | undefined> {
    return this._service.getCliplet(id);
  }

  async getAllCliplets(): Promise<ClipletItem[]> {
    return (await this._service.getAllCliplets()).sort(compare);
  }

  async addCliplet(value: ClipletItem): Promise<string> {
    return this._service.addCliplet(value);
  }

  async putCliplet(value: ClipletItem): Promise<void> {
    return this._service.putCliplet(value);
  }

  async deleteCliplet(id: string): Promise<void> {
    return this._service.deleteCliplet(id);
  }

  async deleteAllCliplets(): Promise<void> {
    return this._service.deleteAllCliplets();
  }

  async deleteExceededRecords(maxCount: number): Promise<void> {
    return this._service.deleteExceededRecords(maxCount);
  }

  async deleteOverdueRecords(days: number): Promise<void> {
    return this._service.deleteOverdueRecords(days);
  }
}
