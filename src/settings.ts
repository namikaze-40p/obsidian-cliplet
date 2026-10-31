import { App, ButtonComponent, Notice, PluginSettingTab, Setting, TextComponent } from 'obsidian';

import Cliplet from './main';
import { ClipletItem, StorageType } from './core/types';
import { ClipletService } from './core/cliplet-service';
import { isStorageType } from './core/storage-type';

export const DEFAULT_STORAGE_OPTIONS = { idb: 'IndexedDB', json: 'data.json' } as const;
const DELETION_CONFIRMATION_TEXT = 'Delete';
const DELETE_SUCCESS_MESSAGE = 'All Cliplet data has been deleted.\nPlease reload Obsidian.';
const SWITCH_FAILED_MESSAGE =
  'Failed to switch the storage type.\nYour data remains in the current storage.';

export interface Settings {
  // Only read to take over the storage type synced before 0.4.0; see Cliplet.storageType.
  storageType?: StorageType;
  latestClipletId: string;
  cliplets: ClipletItem[];
  vaultId: string;
  pluginVersion: string;
  schemaVersion: number;
}

export const DEFAULT_SETTINGS: Settings = {
  latestClipletId: '',
  cliplets: [] as ClipletItem[],
  vaultId: '',
  pluginVersion: '',
  schemaVersion: 1,
} as const;

export class SettingTab extends PluginSettingTab {
  private _service: ClipletService;
  private _deleteText!: TextComponent;
  private _deleteBtn!: ButtonComponent;

  constructor(
    private _app: App,
    private _plugin: Cliplet,
  ) {
    super(_app, _plugin);
    this._service = _plugin.service;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Storage type')
      .setDesc(
        'Select the storage location for this device: IndexedDB (per device/vault, no auto-sync) or data.json (in your vault, syncs with backups). Switching merges your cliplets into the selected storage.',
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(DEFAULT_STORAGE_OPTIONS)
          .setValue(this._plugin.storageType)
          .onChange(async (value) => {
            if (!isStorageType(value)) {
              return;
            }
            dropdown.setDisabled(true);
            try {
              await this._service.switchStorage(value);
            } catch (error) {
              console.error(error);
              new Notice(SWITCH_FAILED_MESSAGE);
              dropdown.setValue(this._plugin.storageType);
            } finally {
              dropdown.setDisabled(false);
            }
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
        'Delete all data of "Cliplet" on this device. When the storage type is data.json, this also deletes the cliplets of other devices that use data.json. If you want to delete, type "Delete" in the text box and click the "Delete" button.',
      )
      .addText((text) => {
        this._deleteText = text;
        text.setPlaceholder('Delete').onChange((value) => {
          if (value === DELETION_CONFIRMATION_TEXT) {
            this._deleteBtn.setDisabled(false);
          } else {
            this._deleteBtn.setDisabled(true);
          }
        });
        text.inputEl.addClass('ct-delete-input');
        return text;
      })
      .addButton((button) => {
        this._deleteBtn = button;
        return button
          .setButtonText('Delete')
          .setDisabled(true)
          .onClick(async () => {
            await this._service.deleteDB();
            new Notice(DELETE_SUCCESS_MESSAGE);
            this._plugin.settings.latestClipletId = '';
            await this._plugin.saveSettings();
            this._deleteText.setValue('');
            this._deleteBtn.setDisabled(true);
          });
      });
  }
}
