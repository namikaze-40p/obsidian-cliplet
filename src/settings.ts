import { App, ButtonComponent, PluginSettingTab, Setting } from 'obsidian';

import Cliplet from './main';
import { createStyles, deleteStyles } from './utils';
import { ClipletItem, StorageType } from './core/types';
import { ClipletService } from './core/cliplet-service';

export const DEFAULT_STORAGE_OPTIONS = { idb: 'IndexedDB', json: 'data.json' } as const;
const DELETION_CONFIRMATION_TEXT = 'Delete';

export interface Settings {
  storageType: StorageType;
  latestClipletId: string;
  cliplets: ClipletItem[];
}

export const DEFAULT_SETTINGS: Settings = {
  storageType: 'idb',
  latestClipletId: '',
  cliplets: [] as ClipletItem[],
} as const;

export class SettingTab extends PluginSettingTab {
  private _service: ClipletService;
  private _deleteBtn: ButtonComponent;

  constructor(
    private _app: App,
    private _plugin: Cliplet,
  ) {
    super(_app, _plugin);
    this._service = ClipletService.instance;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Storage type')
      .setDesc(
        'Select the storage location: IndexedDB (per device/vault, no auto-sync) or data.json (in your vault, syncs with backups).',
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(DEFAULT_STORAGE_OPTIONS)
          .setValue(this._plugin.settings.storageType || 'idb')
          .onChange(async (value: StorageType) => {
            this._plugin.settings.storageType = value;
            await this._plugin.saveSettings();
            await this._service.migrationStorageData();
          }),
      );

    containerEl.createDiv('cliplet-link-for-storage-options', (divEl) => {
      divEl.createEl('a', {
        text: 'See "Storage Options" for details.',
        href: 'https://github.com/namikaze-40p/obsidian-cliplet?tab=readme-ov-file#storage-options',
        title: 'Go to GitHub',
      });
    });

    new Setting(containerEl)
      .setName('Delete all data')
      .setDesc(
        'Delete all data of "Cliplet". If you want to delete, type "Delete" in the text box and click the "Delete" button.',
      )
      .addText((text) =>
        text
          .setPlaceholder('Delete')
          .onChange((value) => {
            if (value === DELETION_CONFIRMATION_TEXT) {
              this._deleteBtn.setDisabled(false);
            } else {
              this._deleteBtn.setDisabled(true);
            }
          })
          .inputEl.addClass('ct-delete-input'),
      )
      .addButton((button) => {
        this._deleteBtn = button;
        return button
          .setButtonText('Delete')
          .setDisabled(true)
          .onClick(async () => {
            await this._service.deleteDB();
            this._plugin.settings.latestClipletId = '';
            await this._plugin.saveData(this._plugin.settings);
            this.display();
          });
      });
  }

  updateStyleSheet(isTeardown = false): void {
    deleteStyles();
    if (isTeardown) {
      return;
    }

    createStyles([]);
  }
}
