import Cliplet from 'src/main';

import { ClipletItem, IClipletStore } from './types';

// Stores cliplets in the plugin settings, which are saved to data.json.
export class ClipletStoreJson implements IClipletStore {
  constructor(private _plugin: Cliplet) {}

  private get _cliplets(): ClipletItem[] {
    return this._plugin.settings.cliplets;
  }

  async get(id: string): Promise<ClipletItem | undefined> {
    const cliplet = this._cliplets.find((cliplet) => cliplet.id === id);
    return cliplet && structuredClone(cliplet);
  }

  async list(): Promise<ClipletItem[]> {
    return structuredClone(this._cliplets);
  }

  // Changes are applied to the latest data.json, which another device may have changed.
  async add(value: ClipletItem): Promise<void> {
    await this._plugin.saveSettings((cliplets) => [...cliplets, value]);
  }

  async put(value: ClipletItem): Promise<void> {
    await this._plugin.saveSettings((cliplets) =>
      cliplets.map((cliplet) => (cliplet.id === value.id ? value : cliplet)),
    );
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (!ids.length) {
      return;
    }
    await this._plugin.saveSettings((cliplets) =>
      cliplets.filter((cliplet) => !ids.includes(cliplet.id)),
    );
  }

  async replaceAll(values: ClipletItem[]): Promise<void> {
    await this._plugin.saveSettings(() => structuredClone(values));
  }

  close(): void {}
}
