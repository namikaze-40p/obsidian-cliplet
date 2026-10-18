import { Modifier } from 'obsidian';

// Reads and writes cliplets in one storage. Policies (encryption, retention, ...) live in ClipletService.
export interface IClipletStore {
  get(id: string): Promise<ClipletItem | undefined>;
  list(): Promise<ClipletItem[]>;
  add(value: ClipletItem): Promise<void>;
  // Does nothing when the cliplet does not exist.
  put(value: ClipletItem): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
  // Replaces all cliplets atomically: on failure the store is left unchanged.
  replaceAll(values: ClipletItem[]): Promise<void>;
  close(): void;
}

export type StorageType = 'idb' | 'json';

export interface ClipletItem {
  id: string;
  name: string;
  content: string;
  type: string;
  keyword: string;
  pinned: number;
  count: number;
  created: number;
  lastUsed: number;
  lastModified: number;
}

// Represents a ClipletItem that has been decrypted.
// Both encrypted and decrypted contents are available.
export type DecryptedClipletItem = ClipletItem & { decryptedContent: string };

export interface ActionMenuItem {
  id: string;
  text: string;
  labels: string[];
  command: {
    key: string;
    modifiers: Modifier[];
  };
  isDanger: boolean;
}

export interface PlaceholderMenuItem {
  id: string;
  text: string;
  token: string;
}
