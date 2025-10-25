import { Modifier } from 'obsidian';

export interface IClipletServiceBackend {
  destroy(): void;
  hasDB(): boolean;
  closeDB(): void;
  deleteDB(): Promise<void>;

  decrypt(value: string): Promise<string>;
  encrypt(value: string): Promise<string>;

  getCliplet(id: string): Promise<ClipletItem | undefined>;
  getAllCliplets(): Promise<ClipletItem[]>;
  addCliplet(value: ClipletItem): Promise<string>;
  putCliplet(value: ClipletItem): Promise<void>;
  deleteCliplet(id: string): Promise<void>;
  deleteAllCliplets(): Promise<void>;
  deleteExceededRecords(maxCount: number): Promise<void>;
  deleteOverdueRecords(days: number): Promise<void>;
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
