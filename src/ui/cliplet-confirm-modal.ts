import { App, Modal, Notice, Setting } from 'obsidian';

import { onClipletModalClose, onClipletModalOpen } from 'src/utils';

export class ClipletConfirmModal extends Modal {
  private _resolveClose: (() => void) | null = null;
  private _isOpen = false;

  constructor(
    app: App,
    private _callback: () => void | Promise<void>,
    private _message: string,
  ) {
    super(app);
  }

  onOpen(): void {
    this._isOpen = true;
    onClipletModalOpen();
    this.modalEl.addClasses(['cliplet-confirm-modal', 'cc-modal']);

    this.contentEl.createDiv('', (el) => {
      el.createSpan('').setText(this._message);
      el.createSpan('').setText('This action cannot be undone.');
    });

    this.contentEl.createDiv('', (el) => {
      new Setting(el).addButton((buttonEl) => {
        buttonEl.setButtonText('Cancel');
        buttonEl.onClick(() => this.close());
      });

      new Setting(el).addButton((buttonEl) => {
        buttonEl.setClass('mod-warning');
        buttonEl.setButtonText('Delete');
        buttonEl.onClick(async () => {
          // Wait for the deletion so that callers reloading on close see the result.
          buttonEl.setDisabled(true);
          try {
            await this._callback();
          } catch (error) {
            console.error(error);
            new Notice('Failed to delete.');
          } finally {
            // The modal may already have been closed (e.g. with Esc) while waiting.
            if (this._isOpen) {
              this.close();
            }
          }
        });
      });
    });
  }

  onClose(): void {
    this._isOpen = false;
    onClipletModalClose();
    if (this._resolveClose) {
      this._resolveClose();
    }
  }

  whenClosed(): Promise<void> {
    return new Promise((resolve) => (this._resolveClose = resolve));
  }
}
