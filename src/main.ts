import { Editor, Notice, Plugin } from 'obsidian';
import { v4 as uuid } from 'uuid';

import { getContentSizeError } from './core/cliplet-item';
import { MAXIMUM_RECORDS, MINIMUM_UNPROTECTED_RECORDS, RETENTION_PERIOD } from './core/consts';
import { ClipletService } from './core/cliplet-service';
import { resolveStorageType } from './core/storage-type';
import { StorageType } from './core/types';
import { ClipletSearchModal } from './ui/cliplet-search-modal';
import { DEFAULT_SETTINGS, SettingTab, Settings } from './settings';
import { pasteCliplet } from './utils';

const MESSAGE = {
  notFound: 'No latest cliplet found.\nPlease add a cliplet first.',
  reload: 'Please reload Obsidian to use the “Cliplet” plugin.',
  loading: '“Cliplet” is still loading.\nPlease try again in a moment.',
  decryptFailed: 'The latest cliplet could not be decrypted.',
};
const STORAGE_TYPE_KEY = 'cliplet-storage-type';

export default class Cliplet extends Plugin {
  // Set only after the service has finished initializing (on layout ready).
  private _service: ClipletService | null = null;
  private _initFailed = false;
  private _settingTab!: SettingTab;
  private _storageType!: StorageType;

  declare settings: Settings;

  get service(): ClipletService {
    if (!this._service) {
      throw new Error('Cliplet service is not initialized yet.');
    }
    return this._service;
  }

  get storageType(): StorageType {
    return this._storageType;
  }

  async onload(): Promise<void> {
    await this.loadSettings();
    this.loadStorageType();

    this.addCommand({
      id: 'add-cliplet',
      name: 'Add',
      editorCheckCallback: (checking: boolean, editor: Editor): boolean => {
        const content = editor.getSelection();
        if (checking) {
          return !!content.length;
        }
        if (content.length) {
          void this.addCliplet(content);
        }
        return true;
      },
    });

    this.addCommand({
      id: 'paste-latest-cliplet',
      name: 'Paste latest',
      editorCallback: (editor) => this.pasteLatestCliplet(editor),
    });

    this.addCommand({
      id: 'search-cliplet',
      name: 'Search',
      editorCallback: (editor) => this.searchCliplet(editor),
    });

    if (!this.settings.vaultId) {
      this.settings.vaultId = uuid();
      await this.saveSettings();
    }

    if (this.settings.pluginVersion !== this.manifest.version) {
      this.settings.pluginVersion = this.manifest.version;
      await this.saveSettings();
    }

    this.app.workspace.onLayoutReady(async () => {
      const service = new ClipletService(this.settings.vaultId, this, this._storageType);
      try {
        await service.init();
      } catch (error) {
        console.error(error);
        this._initFailed = true;
        return;
      }
      this._service = service;

      this._settingTab = new SettingTab(this.app, this);
      this.addSettingTab(this._settingTab);

      void this.deleteExceededRecords();
      void this.deleteOverdueRecords();
    });
  }

  onunload(): void {
    this._service?.closeDB();
  }

  async loadSettings(): Promise<void> {
    // Clone the defaults so that the settings never share arrays with DEFAULT_SETTINGS.
    this.settings = Object.assign(structuredClone(DEFAULT_SETTINGS), await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  // Saved per device, since IndexedDB is per device while data.json is shared with other devices.
  saveStorageType(type: StorageType): void {
    this.app.saveLocalStorage(STORAGE_TYPE_KEY, type);
    this._storageType = type;
  }

  private loadStorageType(): void {
    // Saved again so that a storage type taken over from data.json stays on this device.
    const saved: unknown = this.app.loadLocalStorage(STORAGE_TYPE_KEY);
    this.saveStorageType(resolveStorageType(saved, this.settings.storageType));
  }

  private getAvailableService(): ClipletService | null {
    if (!this._service) {
      new Notice(this._initFailed ? MESSAGE.reload : MESSAGE.loading);
      return null;
    }
    if (!this._service.hasDB()) {
      new Notice(MESSAGE.reload);
      return null;
    }
    return this._service;
  }

  private async addCliplet(content: string): Promise<void> {
    const service = this.getAvailableService();
    if (!service) {
      return;
    }

    // Checked before the duplicate check, which decrypts every cliplet.
    const sizeError = getContentSizeError(content);
    if (sizeError) {
      new Notice(sizeError);
      return;
    }

    const { id, isNew } = await service.addContent(content);
    if (isNew) {
      await this.deleteExceededRecords();
    }
    this.settings.latestClipletId = id;
    await this.saveSettings();
  }

  private async pasteLatestCliplet(editor: Editor): Promise<void> {
    const service = this.getAvailableService();
    if (!service) {
      return;
    }

    const cliplet = await service.getLatestCliplet(this.settings.latestClipletId);
    if (!cliplet) {
      new Notice(MESSAGE.notFound);
      return;
    }
    let decryptedContent: string;
    try {
      decryptedContent = await service.decrypt(cliplet.content);
    } catch (error) {
      console.error(error);
      new Notice(MESSAGE.decryptFailed);
      return;
    }
    const pastedCliplet = await pasteCliplet(editor, { ...cliplet, decryptedContent });
    await service.putCliplet(pastedCliplet);
  }

  private async searchCliplet(editor: Editor): Promise<void> {
    if (!this.getAvailableService()) {
      return;
    }

    await this.deleteOverdueRecords();
    new ClipletSearchModal(this.app, this, editor).open();
  }

  private async deleteExceededRecords(): Promise<void> {
    await this.service.deleteExceededRecords(MAXIMUM_RECORDS, MINIMUM_UNPROTECTED_RECORDS);
  }

  private async deleteOverdueRecords(): Promise<void> {
    await this.service.deleteOverdueRecords(RETENTION_PERIOD);
  }
}
