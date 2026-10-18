import { Editor, Notice, Plugin } from 'obsidian';
import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';

import { MAXIMUM_RECORDS, RETENTION_PERIOD } from './core/consts';
import { ClipletService } from './core/cliplet-service';
import { ClipletSearchModal } from './ui/cliplet-search-modal';
import { DEFAULT_SETTINGS, SettingTab, Settings } from './settings';
import { pasteCliplet } from './utils';

const MESSAGE = {
  notFound: 'No latest cliplet found.\nPlease add a cliplet first.',
  reload: 'Please reload Obsidian to use the “Cliplet” plugin.',
  loading: '“Cliplet” is still loading.\nPlease try again in a moment.',
};

export default class Cliplet extends Plugin {
  // Set only after the service has finished initializing (on layout ready).
  private _service: ClipletService | null = null;
  private _initFailed = false;
  private _settingTab!: SettingTab;

  declare settings: Settings;

  get service(): ClipletService {
    if (!this._service) {
      throw new Error('Cliplet service is not initialized yet.');
    }
    return this._service;
  }

  async onload(): Promise<void> {
    await this.loadSettings();

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
      const storageType = this.settings.storageType;
      const service = new ClipletService(this.settings.vaultId, this, storageType);
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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  // Returns the service if it is usable; otherwise shows a notice and returns null.
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

    const now = dayjs().unix();
    const duplicate = await service.findClipletByContent(content);
    if (duplicate) {
      await service.putCliplet({ ...duplicate, lastUsed: now });
      this.settings.latestClipletId = duplicate.id;
      await this.saveSettings();
      return;
    }

    const id = uuid();
    const cliplet = {
      id,
      name: '',
      content: await service.encrypt(content),
      type: 'text',
      keyword: '',
      pinned: 0,
      count: 0,
      created: now,
      lastUsed: 0,
      lastModified: 0,
    };
    const clipletId = await service.addCliplet(cliplet);
    await this.deleteExceededRecords();
    this.settings.latestClipletId = clipletId;
    await this.saveSettings();
  }

  private async pasteLatestCliplet(editor: Editor): Promise<void> {
    const service = this.getAvailableService();
    if (!service) {
      return;
    }

    const cliplet = await service.getCliplet(this.settings.latestClipletId);
    if (!cliplet) {
      new Notice(MESSAGE.notFound);
      return;
    }
    const decryptedContent = await service.decrypt(cliplet.content);
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
    await this.service.deleteExceededRecords(MAXIMUM_RECORDS);
  }

  private async deleteOverdueRecords(): Promise<void> {
    await this.service.deleteOverdueRecords(RETENTION_PERIOD);
  }
}
