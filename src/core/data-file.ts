import { ClipletItem } from './types';

type ChangeCliplets = (cliplets: ClipletItem[]) => ClipletItem[];

const readCliplets = (data: unknown): ClipletItem[] =>
  typeof data === 'object' && data !== null && 'cliplets' in data && Array.isArray(data.cliplets)
    ? data.cliplets
    : [];

// Writes data.json one at a time, each time onto its latest content: another device may have
// saved cliplets after this one read them, so a stale in-memory copy must not overwrite them.
export class DataFile<T extends { cliplets: ClipletItem[] }> {
  private _writing: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly _load: () => Promise<unknown>,
    private readonly _save: (data: T) => Promise<void>,
  ) {}

  // Saves the settings with the cliplets in data.json, changed by `change` if given,
  // and returns those cliplets.
  write(settings: T, change?: ChangeCliplets): Promise<ClipletItem[]> {
    const task = this._writing.then(async () => {
      const cliplets = readCliplets(await this._load());
      const data = { ...settings, cliplets: change ? change(cliplets) : cliplets };
      await this._save(data);
      return data.cliplets;
    });
    this._writing = task.catch(() => undefined);
    return task;
  }
}
