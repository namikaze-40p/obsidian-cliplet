import { App, Modal, Notice, Setting } from 'obsidian';
import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';

import { ClipletService } from 'src/core/cliplet-service';
import { IS_APPLE, KEYS, PLACEHOLDER_MENU_ITEMS, TOKEN } from 'src/core/consts';
import { ClipletItem, DecryptedClipletItem, PlaceholderMenuItem } from 'src/core/types';
import Cliplet from 'src/main';
import { escapeHtml, replaceWithHighlight } from 'src/utils';

import { PlaceholderMenuModal } from './placeholder-menu-modal';

export class ClipletEditorModal extends Modal {
  private _service: ClipletService;
  private _form = {
    name: '' as string,
    content: '' as string,
  };
  private _resolveClose: (() => void) | null = null;
  private _textarea = null as HTMLTextAreaElement | null;
  private _textareaCursorPos = { start: 0, end: 0 };

  constructor(
    app: App,
    private _plugin: Cliplet,
    private _cliplet?: DecryptedClipletItem | null,
  ) {
    super(app);
    this._service = _plugin.service;
    this._cliplet = _cliplet ? structuredClone(_cliplet) : null;

    this.scope.register([IS_APPLE ? 'Meta' : 'Ctrl'], 'Enter', async (ev) => {
      await this.saveCliplet();
      ev.stopPropagation();
      ev.preventDefault();
    });
  }

  onOpen(): void {
    this.modalEl.addClasses(['cliplet-editor-modal', 'ce-modal']);

    if (this._cliplet) {
      this._form.name = this._cliplet.name || '';
      this._form.content = this._cliplet.decryptedContent;
    }

    new Setting(this.contentEl)
      .setName('Name (optional)')
      .setDesc('Cliplets with names won’t be deleted automatically.')
      .addText((name) =>
        name
          .setPlaceholder('Enter name')
          .setValue(this._form.name)
          .onChange((value) => {
            this._form.name = value;
          }),
      );

    const contentEl = new Setting(this.contentEl)
      .setName('Content')
      .setDesc('This content will be inserted when the cliplet is used.')
      .addTextArea((content) =>
        content
          .setPlaceholder('Enter content')
          .setValue(this._form.content)
          .onChange((value) => {
            this._form.content = value;
          }),
      );

    this._textarea = contentEl.controlEl.querySelector('textarea') as HTMLTextAreaElement;
    this._textareaCursorPos.start = this._textarea.selectionStart;
    this._textareaCursorPos.end = this._textarea.selectionEnd;
    this._textarea.addEventListener('blur', () => {
      const { selectionStart = 0, selectionEnd = 0 } = this._textarea || {};
      this._textareaCursorPos.start = selectionStart;
      this._textareaCursorPos.end = selectionEnd;
    });
    contentEl.controlEl.createDiv('cliplet-overlay-textarea', (overlayDiv) => {
      overlayDiv.createDiv('', (textViewDiv) => {
        const textarea = this._textarea as HTMLTextAreaElement;
        textViewDiv.innerHTML = this.decorateText(textarea.value);

        textarea.addEventListener('input', () => {
          textViewDiv.innerHTML = this.decorateText(textarea.value);
          textViewDiv.style.height = `${textarea.scrollHeight}px`;
          overlayDiv.scrollTop = textarea.scrollTop;
        });
        textarea.addEventListener('scroll', () => (overlayDiv.scrollTop = textarea.scrollTop));
      });
    });

    this.contentEl.createDiv('cliplet-placeholder', (div) => {
      div.createEl('a', '', (aTag) => {
        aTag.setText('About placeholders');
        aTag.href =
          'https://github.com/namikaze-40p/obsidian-cliplet?tab=readme-ov-file#about-placeholders';
      });
      new Setting(div).addButton((btn) => {
        btn
          .setButtonText('Insert placeholder { }')
          .onClick(() => this.openPlaceholderMenuModal(btn.buttonEl));
      });
    });

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
    if (this._resolveClose) {
      this._resolveClose();
    }
  }

  whenClosed(): Promise<void> {
    return new Promise((resolve) => (this._resolveClose = resolve));
  }

  private openPlaceholderMenuModal(buttonEl: HTMLButtonElement): void {
    const modal = new PlaceholderMenuModal(
      this.app,
      this.onSelectMenuItem.bind(this),
      PLACEHOLDER_MENU_ITEMS,
    );

    const ref = buttonEl.getBoundingClientRect();
    const right = `calc(100% - ${ref.left + ref.width}px)`;
    const bottom = `calc(100% - ${ref.bottom - ref.height}px)`;
    modal.modalEl.style.setProperty('--cliplet-menu-modal-right', right);
    modal.modalEl.style.setProperty('--cliplet-menu-modal-bottom', bottom);

    modal.open();
    modal.whenClosed().then(() => {
      modal.modalEl.style.removeProperty('--cliplet-menu-modal-right');
      modal.modalEl.style.removeProperty('--cliplet-menu-modal-bottom');
    });
  }

  private decorateText(text: string): string {
    const items = [
      { token: TOKEN.cursor, global: false },
      { token: TOKEN.clipboard, global: true },
    ];
    const replacer = (_: string, inner: string) =>
      `<span class="highlighted-token">{</span>${inner}<span class="highlighted-token">}</span>`;
    return items.reduce((acc, item) => {
      const tokenId = item.token.replace(/[{}]/g, '');
      return replaceWithHighlight(acc, `{(${tokenId})}`, item.global, replacer);
    }, escapeHtml(text));
  }

  private async onSelectMenuItem(item: PlaceholderMenuItem): Promise<void> {
    this.insertAtCursorPosition(item.token);
  }

  private insertAtCursorPosition(insertText: string): void {
    const textarea = this._textarea as HTMLTextAreaElement;
    const { start, end } = this._textareaCursorPos;

    const value = textarea.value;
    const before = value.slice(0, start);
    const after = value.slice(end);
    textarea.value = before + insertText + after;

    const newPos = before.length + insertText.length;
    textarea.setSelectionRange(newPos, newPos);
    textarea.dispatchEvent(new Event('input'));
    textarea.focus();
  }

  private async saveCliplet(): Promise<void> {
    const { name, content } = this._form;
    const now = dayjs().unix();
    const cliplet: ClipletItem = {
      id: this._cliplet ? this._cliplet.id : uuid(),
      name,
      content: await this._service.encrypt(content),
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
