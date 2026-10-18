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

  async add(value: ClipletItem): Promise<void> {
    await this.save([...this._cliplets, value]);
  }

  async put(value: ClipletItem): Promise<void> {
    if (!this._cliplets.some((cliplet) => cliplet.id === value.id)) {
      return;
    }
    await this.save(this._cliplets.map((cliplet) => (cliplet.id === value.id ? value : cliplet)));
  }

  async deleteMany(ids: string[]): Promise<void> {
    const cliplets = this._cliplets.filter((cliplet) => !ids.includes(cliplet.id));
    if (cliplets.length === this._cliplets.length) {
      return;
    }
    await this.save(cliplets);
  }

  async replaceAll(values: ClipletItem[]): Promise<void> {
    await this.save(structuredClone(values));
  }

  close(): void {}

  // Writes data.json once; on failure the in-memory list is restored.
  private async save(cliplets: ClipletItem[]): Promise<void> {
    const prevCliplets = this._plugin.settings.cliplets;
    this._plugin.settings.cliplets = cliplets;
    try {
      await this._plugin.saveSettings();
    } catch (error) {
      this._plugin.settings.cliplets = prevCliplets;
      throw error;
    }
  }
}
