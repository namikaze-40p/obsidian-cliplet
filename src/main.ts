import { Editor, Notice, Plugin } from 'obsidian';
import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';

import { DEFAULT_SETTINGS, SettingTab, Settings } from './settings';
import { pasteCliplet } from './utils';
import { ClipletSearchModal } from './ui/cliplet-search-modal';
import { MAXIMUM_RECORDS, RETENTION_PERIOD } from './core/consts';
import { ClipletService } from './core/cliplet-service';
import { CustomApp } from './core/types';

const RELOAD_MESSAGE = 'Please reload Obsidian to use the “Cliplet” plugin.';

export default class Cliplet extends Plugin {
  private _service: ClipletService;
  private _settings: Settings;
  private _settingTab: SettingTab;

  get settings(): Settings {
    return this._settings;
  }

  get service(): ClipletService {
    return this._service;
  }

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: 'add-cliplet',
      name: 'Add cliplet',
      editorCallback: (editor) => this.addCliplet(editor),
    });

    this.addCommand({
      id: 'paste-latest-cliplet',
      name: 'Paste latest cliplet',
      editorCallback: (editor) => this.pasteLatestCliplet(editor),
    });

    this.addCommand({
      id: 'search-cliplet',
      name: 'Search cliplet',
      editorCallback: (editor) => this.searchCliplet(editor),
    });

    this.app.workspace.onLayoutReady(async () => {
      const storageType = this.settings.storageType;
      this._service = new ClipletService((this.app as CustomApp).appId, this, storageType);
      await this._service.init();

      this._settingTab = new SettingTab(this.app, this);
      this.addSettingTab(this._settingTab);
      this._settingTab.updateStyleSheet();

      this.deleteExceededRecords();
      this.deleteOverdueRecords();
    });
  }

  onunload(): void {
    this._settingTab.updateStyleSheet(true);
    this._service.closeDB();
  }

  async loadSettings(): Promise<void> {
    this._settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async addCliplet(editor: Editor): Promise<void> {
    if (!this._service.hasDB()) {
      new Notice(RELOAD_MESSAGE);
      return;
    }

    const content = editor.getSelection();
    if (!content) {
      return;
    }

    const id = uuid();
    const now = dayjs().unix();
    const cliplet = {
      id,
      name: '',
      content: await this._service.encrypt(content),
      type: 'text',
      keyword: '',
      pinned: 0,
      count: 0,
      created: now,
      lastUsed: 0,
      lastModified: 0,
    };
    const clipletId = await this._service.addCliplet(cliplet);
    await this.deleteExceededRecords();
    this.settings.latestClipletId = clipletId;
    await this.saveSettings();
  }

  private async pasteLatestCliplet(editor: Editor): Promise<void> {
    const latestClipletId = this.settings.latestClipletId;
    if (!latestClipletId) {
      new Notice('No latest cliplet found. Please add a cliplet first.');
      return;
    }
    const cliplet = await this._service.getCliplet(latestClipletId);
    if (!cliplet) {
      return;
    }
    const decryptedContent = await this._service.decrypt(cliplet.content);
    const pastedCliplet = pasteCliplet(editor, { ...cliplet, decryptedContent });
    await this._service.putCliplet(pastedCliplet);
  }

  private async searchCliplet(editor: Editor): Promise<void> {
    if (!this._service.hasDB()) {
      new Notice(RELOAD_MESSAGE);
      return;
    }

    await this.deleteOverdueRecords();
    new ClipletSearchModal(this.app, this, editor).open();
  }

  private async deleteExceededRecords(): Promise<void> {
    await this._service.deleteExceededRecords(MAXIMUM_RECORDS);
  }

  private async deleteOverdueRecords(): Promise<void> {
    await this._service.deleteOverdueRecords(RETENTION_PERIOD);
  }
}
