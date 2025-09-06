import { App, Modal, Setting } from 'obsidian';

export class ClipletConfirmModal extends Modal {
  private _resolveClose: (() => void) | null = null;

  constructor(
    app: App,
    private _callback: () => void,
    private _message: string,
  ) {
    super(app);
  }

  onOpen() {
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
        buttonEl.onClick(() => {
          this._callback();
          this.close();
        });
      });
    });
  }

  onClose() {
    if (this._resolveClose) {
      this._resolveClose();
    }
  }

  whenClosed(): Promise<void> {
    return new Promise((resolve) => (this._resolveClose = resolve));
  }
}
