import { App, Editor, FuzzyMatch, FuzzySuggestModal, Modifier, Notice, setIcon } from 'obsidian';
import dayjs from 'dayjs';

import { ClipletService } from 'src/core/cliplet-service';
import { ACTION_MENU_ITEMS, IS_APPLE, KEYS, TOKEN } from 'src/core/consts';
import { ActionMenuItem, DecryptedClipletItem } from 'src/core/types';
import Cliplet from 'src/main';
import {
  copyToClipboard,
  escapeHtml,
  getClipboard,
  pasteCliplet,
  replaceWithHighlight,
} from 'src/utils';

import { ActionMenuModal } from './action-menu-modal';
import { ClipletConfirmModal } from './cliplet-confirm-modal';
import { ClipletEditorModal } from './cliplet-editor-modal';

export class ClipletSearchModal extends FuzzySuggestModal<DecryptedClipletItem> {
  private _service: ClipletService;
  private _cliplets: DecryptedClipletItem[] = [];
  private _currentCliplet: DecryptedClipletItem | null = null;
  private _detailEls: { [key: string]: HTMLSpanElement | null } = {
    content: null,
    count: null,
    lastUsed: null,
    lastModified: null,
    created: null,
  };
  private _lastTappedClipletId: string = '';
  private _clipboardText: string = '';
  private _preventClose = false;

  constructor(
    app: App,
    private _plugin: Cliplet,
    private _editor: Editor,
  ) {
    super(app);
    this._service = _plugin.service;

    this.registerShortcutKeys();

    this.modalEl.addClasses(['cliplet-search-modal', 'cs-modal']);
    this.setPlaceholder('Search cliplet...');

    const detailEl = this.modalEl.createDiv('cliplet-detail');
    this.generateDetails(detailEl);
    this.generateFooter(this.modalEl);
  }

  close(): void {
    if (this._preventClose) {
      this._preventClose = false;
      return;
    }
    super.close();
  }

  async onOpen(): Promise<void> {
    super.onOpen();

    this._clipboardText = await getClipboard();
    await this.getCliplets();
    const suggestionContainer = this.containerEl.querySelector('.prompt-results');
    if (suggestionContainer) {
      this.detectChangeSelectedItem(suggestionContainer);
    }
  }

  getItems(): DecryptedClipletItem[] {
    return this._cliplets;
  }

  getItemText(cliplet: DecryptedClipletItem): string {
    return [cliplet.name, cliplet.decryptedContent].join(' ');
  }

  async onChooseItem(cliplet: DecryptedClipletItem): Promise<void> {
    const pastedCliplet = await pasteCliplet(this._editor, cliplet, this._clipboardText);
    await this._service.putCliplet(pastedCliplet);
    this._plugin.settings.latestClipletId = pastedCliplet.id;
    await this._plugin.saveSettings();
    this._lastTappedClipletId = '';
  }

  onChooseSuggestion(item: FuzzyMatch<DecryptedClipletItem>, ev: MouseEvent | KeyboardEvent): void {
    const cliplet = item.item;

    // Case: KeyboardEvent(Enter key) or Mouse click
    if ((ev instanceof KeyboardEvent && ev.code === 'Enter') || !this._lastTappedClipletId) {
      this.onChooseItem(cliplet);
      return;
    }

    // Case: Touch or Pen input
    if (this._lastTappedClipletId === cliplet.id) {
      this.onChooseItem(cliplet);
    } else {
      this._lastTappedClipletId = cliplet.id;
    }
  }

  renderSuggestion(
    item: FuzzyMatch<DecryptedClipletItem>,
    suggestionItemEl: HTMLElement,
  ): HTMLElement {
    const doc = suggestionItemEl.ownerDocument;
    const fragment = doc.createDocumentFragment();
    const cliplet = item.item;

    const iconWrap = doc.createElement('div');
    iconWrap.className = 'suggestion-item-icon';
    const icon = cliplet.pinned ? 'pin' : cliplet.name ? 'tag' : 'clipboard';
    setIcon(iconWrap, icon);

    const textSpan = doc.createElement('span');
    if (cliplet.name) {
      textSpan.textContent = cliplet.name;
    } else {
      const texts = cliplet.decryptedContent.split(/\r?\n/);
      const viewText = texts.length === 1 ? cliplet.decryptedContent : `${texts[0]}...`;
      this.setClipletContent(textSpan, viewText);
    }
    textSpan.dataset.clipletId = cliplet.id;

    fragment.append(iconWrap, textSpan);
    suggestionItemEl.replaceChildren(fragment);
    this.attachPointerHandler(suggestionItemEl);
    return suggestionItemEl;
  }

  private async getCliplets(): Promise<void> {
    const cliplets = await this._service.getAllCliplets();
    this._cliplets = await Promise.all(
      cliplets.map(async (cliplet: DecryptedClipletItem) => {
        cliplet.decryptedContent = await this._service.decrypt(cliplet.content);
        return cliplet;
      }),
    );
    this.inputEl.dispatchEvent(new Event('input'));

    if (this._cliplets.length) {
      this._lastTappedClipletId = this._cliplets[0].id;
      this.updateDetailView(this._cliplets[0]);
    }
  }

  private generateDetails(detailEl: HTMLDivElement): void {
    const detailMainEl = detailEl.createDiv('cliplet-detail-main');
    const detailSubEl = detailEl.createDiv('cliplet-detail-sub');

    this.generateDetail(detailMainEl, '', 'content');
    this.generateDetail(detailSubEl, 'Usage count', 'count');
    this.generateDetail(detailSubEl, 'Last used', 'lastUsed');
    this.generateDetail(detailSubEl, 'Last modified', 'lastModified');
    this.generateDetail(detailSubEl, 'Created', 'created');
  }

  private generateDetail(parentEl: HTMLDivElement, itemName: string, propName: string): void {
    const wrapEl = parentEl.createDiv('cliplet-detail-item');
    if (itemName) {
      wrapEl.createSpan('', (spanEl) => spanEl.setText(itemName));
    }
    this._detailEls[propName] = wrapEl.createSpan('');
  }

  private detectChangeSelectedItem(suggestionContainer: Element): void {
    const observer = new MutationObserver(() => {
      const selectedEl = suggestionContainer.querySelector('.suggestion-item.is-selected');
      if (selectedEl) {
        const cliplet = this.findClipletItem(selectedEl.lastChild);
        if (this._currentCliplet?.id !== cliplet?.id) {
          this.updateDetailView(cliplet || null);
        }
      }
    });

    observer.observe(suggestionContainer, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class'],
    });
  }

  private findClipletItem(el: ChildNode | null | undefined): DecryptedClipletItem | undefined {
    if (el?.nodeName !== 'SPAN') {
      return;
    }
    return this._cliplets.find((item) => item.id === (el as HTMLSpanElement).dataset.clipletId);
  }

  private attachPointerHandler(item: Element): void {
    item.addEventListener('pointerup', (ev: PointerEvent) => {
      if (!['touch', 'pen'].includes(ev.pointerType)) {
        this._lastTappedClipletId = '';
        return;
      }

      const cliplet = this.findClipletItem(item.lastChild);
      if (!cliplet) {
        return;
      }

      if (!['BEFORE_SET', cliplet.id].includes(this._lastTappedClipletId)) {
        this._lastTappedClipletId = 'BEFORE_SET';
        this._preventClose = true;
      }
    });
  }

  private updateDetailView(cliplet: DecryptedClipletItem | null): void {
    this._currentCliplet = cliplet;
    const { content, count, lastUsed, lastModified, created } = this._detailEls;
    if (!content || !count || !lastUsed || !lastModified || !created) {
      return;
    }

    content.empty();
    count.empty();
    lastUsed.empty();
    lastModified.empty();
    created.empty();

    if (!cliplet) {
      this._lastTappedClipletId = '';
      return;
    }

    const lastUsedText = cliplet.lastUsed
      ? dayjs.unix(cliplet.lastUsed).format('MMM D, YYYY [at] HH:mm:ss')
      : '';
    const lastModifiedText = cliplet.lastModified
      ? dayjs.unix(cliplet.lastModified).format('MMM D, YYYY [at] HH:mm:ss')
      : '';

    this.setClipletContent(content, cliplet.decryptedContent);
    count.textContent = `${cliplet.count}`;
    lastUsed.textContent = lastUsedText;
    lastModified.textContent = lastModifiedText;
    created.textContent = dayjs.unix(cliplet.created).format('MMM D, YYYY [at] HH:mm:ss');

    if (lastUsedText) {
      lastUsed.parentElement?.removeClass('is-hidden');
    } else {
      lastUsed.parentElement?.addClass('is-hidden');
    }
    if (lastModifiedText) {
      lastModified.parentElement?.removeClass('is-hidden');
    } else {
      lastModified.parentElement?.addClass('is-hidden');
    }
    if (!this._preventClose) {
      this._lastTappedClipletId = cliplet.id;
    }
  }

  private setClipletContent(el: HTMLSpanElement, text: string): void {
    const clipboardText = text.includes(TOKEN.clipboard) ? escapeHtml(this._clipboardText) : '';
    const replacer = () => `<span class="cliplet-token-replaced">${clipboardText}</span>`;
    const commonArgs = [TOKEN.clipboard, true, replacer] as const;

    if (text.includes(TOKEN.cursor)) {
      const tokenIndex = text.indexOf(TOKEN.cursor);
      const before = text.slice(0, tokenIndex);
      const after = text.slice(tokenIndex + TOKEN.cursor.length);
      const replacedBefore = replaceWithHighlight(escapeHtml(before), ...commonArgs);
      const replacedAfter = replaceWithHighlight(escapeHtml(after), ...commonArgs);
      el.createSpan('', (beforeEl) => (beforeEl.innerHTML = replacedBefore));
      el.createSpan('cliplet-token-cursor');
      el.createSpan('', (afterEl) => (afterEl.innerHTML = replacedAfter));
    } else {
      el.innerHTML = replaceWithHighlight(escapeHtml(text), ...commonArgs);
    }
  }

  private generateFooter(contentEl: HTMLElement): void {
    contentEl.createDiv('cs-modal-footer', (footerEl) => {
      footerEl.createSpan('', (el) => {
        el.createSpan().setText('Search cliplet');
      });
      footerEl.createDiv('', (wrapperEl) => {
        wrapperEl.createDiv('cs-modal-legend', (el) => {
          el.createSpan().setText('Paste');
          el.createDiv('cliplet-legend-label').setText(KEYS.enter);
          el.addEventListener('click', () => {
            if (this._currentCliplet) {
              this.onChooseItem(this._currentCliplet);
              this.close();
            }
          });
        });
        wrapperEl.createSpan('cs-modal-legend-separator').setText(' | ');
        wrapperEl.createDiv('cs-modal-legend', (el) => {
          el.createSpan().setText('Actions');
          el.createDiv('cliplet-legend-label').setText(KEYS.mod);
          el.createDiv('cliplet-legend-label').setText('K');
          el.addEventListener('click', () => this.openActionMenuModal());
        });
      });
    });
  }

  private registerShortcutKeys(): void {
    const bindings: [Modifier[], string, (ev: KeyboardEvent) => void][] = [
      [
        [IS_APPLE ? 'Meta' : 'Ctrl'],
        'k',
        (ev) => {
          this.openActionMenuModal();
          ev.stopPropagation();
          ev.preventDefault();
        },
      ],
      ...(ACTION_MENU_ITEMS.map((item) => {
        return [
          item.command.modifiers,
          item.command.key,
          (ev) => {
            this.onSelectMenuItem(item);
            ev.stopPropagation();
            ev.preventDefault();
          },
        ];
      }) as [Modifier[], string, (ev: KeyboardEvent) => void][]),
    ];
    bindings.forEach(([mods, key, handler]) => this.scope.register(mods, key, handler));
  }

  private async onSelectMenuItem(item: ActionMenuItem): Promise<void> {
    switch (item.id) {
      case 'paste':
        if (this._currentCliplet) {
          await this.onChooseItem(this._currentCliplet);
          this.close();
        }
        return;
      case 'toClipboard':
        if (this._currentCliplet) {
          await copyToClipboard(this._currentCliplet.decryptedContent);
          this.close();
        }
        return;
      case 'edit': {
        if (this._currentCliplet) {
          this.openEditorModal(true);
        }
        return;
      }
      case 'pin':
      case 'unpin': {
        if (this._currentCliplet) {
          const now = dayjs().unix();
          const pinned = this._currentCliplet.pinned ? 0 : now;
          await this._service.putCliplet({ ...this._currentCliplet, pinned, lastModified: now });
          await this.getCliplets();
        }
        return;
      }
      case 'create': {
        this.openEditorModal(false);
        return;
      }
      case 'delete': {
        if (this._currentCliplet) {
          const callback = async () => {
            await this._service.deleteCliplet(this._currentCliplet?.id || '');
            new Notice('1 cliplet deleted.');
          };
          const message = 'Are you sure you want to delete this cliplet?';
          this.openConfirmModal(callback, message);
        }
        return;
      }
      case 'deleteResults': {
        if (this._currentCliplet) {
          const cliplets = this.getFilteredCliplets();
          const callback = async () => {
            const promises = cliplets.map(({ id }) => this._service.deleteCliplet(id));
            await Promise.all(promises);
            new Notice(
              cliplets.length === 1 ? '1 cliplet deleted.' : `${cliplets.length} cliplets deleted.`,
            );
          };
          const message =
            cliplets.length === 1
              ? 'Are you sure you want to delete this cliplet from the search results?'
              : `Are you sure you want to delete all ${cliplets.length} cliplets in the search results?`;
          this.openConfirmModal(callback, message);
        }
        return;
      }
      default:
        return;
    }
  }

  private openEditorModal(isEdit: boolean): void {
    const cliplet = isEdit ? this._currentCliplet : null;
    const modal = new ClipletEditorModal(this.app, this._plugin, cliplet);

    const ref = this.modalEl;
    modal.modalEl.style.setProperty('--cliplet-editor-modal-top', `${ref.offsetTop}px`);
    modal.modalEl.style.setProperty('--cliplet-editor-modal-height', `${ref.offsetHeight}px`);
    modal.modalEl.style.setProperty('--cliplet-editor-modal-width', `${ref.offsetWidth}px`);

    modal.open();
    modal.whenClosed().then(async () => {
      await this.getCliplets();
      modal.modalEl.style.removeProperty('--cliplet-editor-modal-top');
      modal.modalEl.style.removeProperty('--cliplet-editor-modal-height');
      modal.modalEl.style.removeProperty('--cliplet-editor-modal-width');
    });
  }

  private openConfirmModal(callback: () => Promise<void>, message: string): void {
    const modal = new ClipletConfirmModal(this.app, callback, message);
    modal.open();
    modal.whenClosed().then(async () => await this.getCliplets());
  }

  private openActionMenuModal(): void {
    const actionMenuItems = this.generateActionMenuItems();
    const modal = new ActionMenuModal(this.app, this.onSelectMenuItem.bind(this), actionMenuItems);

    const ref = this.modalEl;
    const right = `calc((100% - ${ref?.offsetWidth || 0}px) / 2 + 8px)`;
    const bottom = `calc(100% - (442px + ${ref?.offsetTop || 0}px))`;
    modal.modalEl.style.setProperty('--cliplet-menu-modal-right', right);
    modal.modalEl.style.setProperty('--cliplet-menu-modal-bottom', bottom);

    modal.open();
    modal.whenClosed().then(() => {
      modal.modalEl.style.removeProperty('--cliplet-menu-modal-right');
      modal.modalEl.style.removeProperty('--cliplet-menu-modal-bottom');
    });
  }

  private generateActionMenuItems(): ActionMenuItem[] {
    if (this._currentCliplet) {
      const hideItemId = this._currentCliplet.pinned ? 'pin' : 'unpin';
      return ACTION_MENU_ITEMS.filter((item) => item.id !== hideItemId);
    } else {
      const hideItemIds = ['paste', 'edit', 'pin', 'unpin', 'delete'];
      if (!this.getFilteredCliplets().length) {
        hideItemIds.push('deleteResults');
      }
      return ACTION_MENU_ITEMS.filter((item) => !hideItemIds.includes(item.id));
    }
  }

  private getFilteredCliplets(): DecryptedClipletItem[] {
    const query = this.inputEl.value || '';
    return this.getSuggestions(query).map(({ item }) => item);
  }
}
