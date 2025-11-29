import dayjs from 'dayjs';

import Cliplet from 'src/main';

import { ClipletItem } from './types';

const setProp = <T, K extends keyof T>(obj: T, key: K, value: T[K]) => {
  obj[key] = value;
};

const setProps = <T>(target: T, props: Partial<T>) => {
  for (const key of Object.keys(props) as Array<keyof T>) {
    const value = props[key];
    if (value !== undefined) {
      setProp(target, key, value);
    }
  }
};

export class ClipletStoreJson {
  private _clipletMap = new Map<string, ClipletItem>();

  private get _cliplets(): ClipletItem[] {
    return this._plugin.settings.cliplets;
  }

  constructor(private _plugin: Cliplet) {
    this._clipletMap = new Map(this._cliplets.map((cliplet) => [cliplet.id, cliplet]));
  }

  async get(id: string): Promise<ClipletItem | undefined> {
    return this._clipletMap.get(id);
  }

  async list(): Promise<ClipletItem[]> {
    return structuredClone(this._cliplets) as ClipletItem[];
  }

  async add(value: ClipletItem): Promise<string> {
    const existClipletId = await this.contentDuplicateId(value.content);
    if (existClipletId) {
      return existClipletId;
    } else {
      this._plugin.settings.cliplets.push(value);
      await this._plugin.saveSettings();
      this._clipletMap.set(value.id, value);
      return value.id;
    }
  }

  async put(value: ClipletItem): Promise<void> {
    const cliplet = this._clipletMap.get(value.id);
    if (cliplet) {
      const { content, name, count, pinned, lastUsed, lastModified } = value;
      const updateProps = { content, name, count, pinned, lastUsed, lastModified };
      setProps(cliplet, updateProps);
      await this._plugin.saveSettings();
      this._clipletMap.set(cliplet.id, cliplet);
    }
  }

  async delete(id: string): Promise<void> {
    this._plugin.settings.cliplets = this._cliplets.filter((cliplet) => cliplet.id !== id);
    await this._plugin.saveSettings();
    this._clipletMap.delete(id);
  }

  async deleteAll(): Promise<void> {
    this._plugin.settings.cliplets = [];
    await this._plugin.saveSettings();
    this._clipletMap = new Map();
  }

  async deleteExceededRecords(maxCount: number): Promise<void> {
    const candidates: { id: string; latest: number }[] = [];
    this._cliplets.forEach((cliplet) => {
      if (this.isProtectedCliplet(cliplet)) {
        --maxCount;
        return;
      }
      const latest = Math.max(cliplet.created, cliplet.lastUsed, cliplet.lastModified);
      candidates.push({ id: cliplet.id, latest });
    });

    if (candidates.length <= maxCount) {
      return;
    }

    const toDeleteItems = candidates
      .sort((a, b) => b.latest - a.latest)
      .slice(maxCount)
      .map(({ id }) => id);
    this._plugin.settings.cliplets = this._cliplets.filter(
      (cliplet) => !toDeleteItems.includes(cliplet.id),
    );
    await this._plugin.saveSettings();
    this._clipletMap = new Map(this._cliplets.map((cliplet) => [cliplet.id, cliplet]));
  }

  async deleteOverdueRecords(days: number): Promise<void> {
    const threshold = Math.floor(dayjs().subtract(days, 'day').valueOf() / 1000);
    this._plugin.settings.cliplets = this._cliplets.filter((cliplet) => {
      if (this.isProtectedCliplet(cliplet)) {
        return true;
      }
      const latest = Math.max(cliplet.created, cliplet.lastUsed, cliplet.lastModified);
      if (latest < threshold) {
        this._clipletMap.delete(cliplet.id);
      } else {
        return true;
      }
    });
    await this._plugin.saveSettings();
  }

  private async contentDuplicateId(content: string): Promise<string> {
    const cliplet = (await this.list()).find((cliplet) => cliplet.content === content);
    return cliplet ? cliplet.id : '';
  }

  private isProtectedCliplet(cliplet: ClipletItem): boolean {
    return (
      (typeof cliplet.name === 'string' && cliplet.name.trim() !== '') ||
      (typeof cliplet.keyword === 'string' && cliplet.keyword.trim() !== '') ||
      !!cliplet.pinned
    );
  }
}
