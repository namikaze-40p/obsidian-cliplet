import { App, Modal, Notice, Setting } from 'obsidian';
import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';

import { ClipletItem } from '../core/types';
import { IS_APPLE, KEYS } from '../core/consts';
import Cliplet from '../main';
import { ClipletService } from 'src/core/cliplet-service';

export class ClipletEditorModal extends Modal {
  private _service: ClipletService;
  private _form = {
    name: '' as string,
    content: '' as string,
  };
  private _eventListenerFn: (ev: KeyboardEvent) => void;
  private _resolveClose: (() => void) | null = null;

  constructor(
    app: App,
    private _plugin: Cliplet,
    private _cliplet?: ClipletItem | null,
  ) {
    super(app);
    this._service = ClipletService.instance;
    this._cliplet = _cliplet ? structuredClone(_cliplet) : null;

    if (this._cliplet) {
      this._form.name = this._cliplet.name || '';
      this._form.content = this._cliplet.content || '';
    }

    this._eventListenerFn = this.handlingKeydownEvent.bind(this);
    window.addEventListener('keydown', this._eventListenerFn);
  }

  onOpen(): void {
    this.modalEl.addClasses(['cliplet-editor-modal', 'ce-modal']);

    new Setting(this.contentEl)
      .setName('Name (optional)')
      .setDesc('Cliplets with names won’t be deleted automatically.')
      .addText((name) =>
        name
          .setPlaceholder('Enter name')
          .setValue(this._cliplet?.name || '')
          .onChange((value) => {
            this._form.name = value;
          }),
      );

    new Setting(this.contentEl)
      .setName('Content')
      .setDesc('This content will be inserted when the cliplet is used.')
      .addTextArea((content) =>
        content
          .setPlaceholder('Enter content')
          .setValue(this._cliplet?.content || '')
          .onChange((value) => {
            this._form.content = value;
          }),
      );

    this.modalEl.createDiv('ce-modal-footer', (footerEl) => {
      footerEl.createSpan('').setText(this._cliplet ? 'Edit cliplet' : 'Create cliplet');
      footerEl.createDiv('', (wrapperEl) => {
        wrapperEl.createDiv('ce-modal-legend', (el) => {
          el.createSpan().setText('Save cliplet');
          el.createDiv('cliplet-legend-label').setText(KEYS.mod);
          el.createDiv('cliplet-legend-label').setText(KEYS.enter);
          el.addEventListener('click', async () => await this.saveCliplet());
        });
      });
    });
  }

  onClose(): void {
    window.removeEventListener('keydown', this._eventListenerFn);
    if (this._resolveClose) {
      this._resolveClose();
    }
  }

  whenClosed(): Promise<void> {
    return new Promise((resolve) => (this._resolveClose = resolve));
  }

  private handlingKeydownEvent(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && (IS_APPLE ? ev.metaKey : ev.ctrlKey)) {
      this.saveCliplet();
      ev.preventDefault();
      return;
    }
  }

  private async saveCliplet(): Promise<void> {
    const { name, content } = this._form;
    const now = dayjs().unix();
    const cliplet: ClipletItem = {
      id: this._cliplet ? this._cliplet.id : uuid(),
      name,
      content,
      keyword: this._cliplet ? this._cliplet.keyword : '',
      type: this._cliplet ? this._cliplet.type : 'text',
      pinned: this._cliplet ? this._cliplet.pinned : 0,
      count: this._cliplet ? this._cliplet.count : 0,
      created: this._cliplet ? this._cliplet.created : now,
      lastUsed: this._cliplet ? this._cliplet.lastUsed : 0,
      lastModified: this._cliplet ? now : 0,
    };
    if (this._cliplet) {
      await this._service.putCliplet(cliplet);
    } else {
      await this._service.addCliplet(cliplet);
    }
    this._plugin.settings.latestClipletId = cliplet.id;
    await this._plugin.saveSettings();
    new Notice('Saved cliplet.');
    this.close();
  }
}
