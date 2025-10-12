import { App, Editor, FuzzyMatch, FuzzySuggestModal, Notice, setIcon } from 'obsidian';
import dayjs from 'dayjs';

import Cliplet from '../main';
import { ActionMenuItem, DecryptedClipletItem } from '../core/types';
import { createStyles, deleteStyles, pasteCliplet } from '../utils';
import { ActionMenuModal } from './action-menu-modal';
import { ACTION_MENU_ITEMS, IS_APPLE, KEYS } from '../core/consts';
import { ClipletConfirmModal } from './cliplet-confirm-modal';
import { ClipletEditorModal } from './cliplet-editor-modal';
import { ClipletService } from 'src/core/cliplet-service';

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
  private _actionMenuItemMap = new Map(ACTION_MENU_ITEMS.map((item) => [item.id, item]));
  private _eventListenerFn: (ev: KeyboardEvent) => void;
  private _actionMenuModal: ActionMenuModal | null = null;
  private _editorModal: ClipletEditorModal | null = null;
  private _confirmModal: ClipletConfirmModal | null = null;
  private _lastTappedClipletId: string = '';
  private readonly _close: () => void = this.close.bind(this);

  constructor(
    app: App,
    private _plugin: Cliplet,
    private _editor: Editor,
  ) {
    super(app);
    this._service = ClipletService.instance;

    this._eventListenerFn = this.handlingKeydownEvent.bind(this);
    window.addEventListener('keydown', this._eventListenerFn);

    this.modalEl.addClasses(['cliplet-search-modal', 'cs-modal']);
    this.setPlaceholder('Search cliplet...');

    const detailEl = this.modalEl.createDiv('cliplet-detail');
    this.generateDetails(detailEl);
    this.generateFooter(this.modalEl);
  }

  async onOpen(): Promise<void> {
    super.onOpen();

    await this.getCliplets();
    if (this._cliplets.length) {
      this._lastTappedClipletId = this._cliplets[0].id;
      this.updateDetailView(this._cliplets[0]);
    }
    const suggestionContainer = this.containerEl.querySelector('.prompt-results');
    if (suggestionContainer) {
      this.detectChangeSuggestionItems(suggestionContainer);
    }
  }

  onClose(): void {
    window.removeEventListener('keydown', this._eventListenerFn);
  }

  getItems(): DecryptedClipletItem[] {
    return this._cliplets;
  }

  getItemText(cliplet: DecryptedClipletItem): string {
    return [cliplet.name, cliplet.decryptedContent].join(' ');
  }

  async onChooseItem(cliplet: DecryptedClipletItem): Promise<void> {
    const pastedCliplet = pasteCliplet(this._editor, cliplet);
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
      this.close = this._close;
    }
  }

  renderSuggestion(
    item: FuzzyMatch<DecryptedClipletItem>,
    suggestionItemEl: HTMLElement,
  ): HTMLElement {
    const cliplet = item.item;
    const texts = cliplet.decryptedContent.split(/\r?\n/);
    const viewText = texts.length === 1 ? cliplet.decryptedContent : `${texts[0]}...`;
    const icon = cliplet.pinned ? 'pin' : cliplet.name ? 'tag' : 'clipboard';

    const doc = suggestionItemEl.ownerDocument;
    const frag = doc.createDocumentFragment();

    const iconWrap = doc.createElement('div');
    iconWrap.className = 'suggestion-item-icon';
    setIcon(iconWrap, icon);

    const textSpan = doc.createElement('span');
    textSpan.textContent = cliplet.name || viewText;
    textSpan.dataset.clipletId = cliplet.id;

    frag.append(iconWrap, textSpan);
    suggestionItemEl.replaceChildren(frag);
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

  private detectChangeSuggestionItems(suggestionContainer: Element): void {
    const observer = this.generateObserver();
    const observeItems = () => {
      const items = suggestionContainer.querySelectorAll('.suggestion-item');
      items.forEach((item) => {
        this.attachPointerHandler(item);
        return observer.observe(item, { attributes: true, attributeFilter: ['class'] });
      });
    };

    observeItems();

    this.inputEl.addEventListener('input', async () => {
      const cliplet = this.findClipletItem(suggestionContainer.firstChild?.lastChild);
      this._lastTappedClipletId = cliplet?.id || '';
      this.updateDetailView(cliplet || null);
      setTimeout(observeItems, 0);
    });
  }

  private generateObserver(): MutationObserver {
    return new MutationObserver(async (mutations: MutationRecord[]) => {
      for (const { type, attributeName, target } of mutations) {
        if (type === 'attributes' && attributeName === 'class') {
          const cliplet = this.findClipletItem(target.lastChild);
          if (cliplet) {
            this.updateDetailView(cliplet);
          }
        }
      }
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
        this.close = () => {};
      }
    });
  }

  private updateDetailView(cliplet: DecryptedClipletItem | null): void {
    this._currentCliplet = cliplet;
    const { content, count, lastUsed, lastModified, created } = this._detailEls;
    if (!content || !count || !lastUsed || !lastModified || !created) {
      return;
    }
    if (cliplet) {
      const lastUsedText = cliplet.lastUsed
        ? dayjs.unix(cliplet.lastUsed).format('MMM D, YYYY [at] HH:mm:ss')
        : '';
      const lastModifiedText = cliplet.lastModified
        ? dayjs.unix(cliplet.lastModified).format('MMM D, YYYY [at] HH:mm:ss')
        : '';

      content.textContent = cliplet.decryptedContent;
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
    } else {
      this._lastTappedClipletId = '';
      content.empty();
      count.empty();
      lastUsed.empty();
      lastModified.empty();
      created.empty();
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

  private handlingKeydownEvent(ev: KeyboardEvent): void {
    switch (ev.key) {
      case 'k':
        if (IS_APPLE ? ev.metaKey : ev.ctrlKey) {
          if (this._actionMenuModal) {
            this._actionMenuModal.close();
          } else {
            this.openActionMenuModal();
          }
          ev.preventDefault();
        }
        return;
      case 'e':
        this.handlingActionMenu(ev, 'edit');
        return;
      case 'p':
        this.handlingActionMenu(ev, 'pin');
        return;
      case 'n':
        this.handlingActionMenu(ev, 'create');
        return;
      case 'x':
        this.handlingActionMenu(ev, 'delete');
        return;
      case 'X':
        this.handlingActionMenu(ev, 'deleteResults');
        return;
      default:
        // nop
        return;
    }
  }

  private handlingActionMenu(ev: KeyboardEvent, actionId: string): void {
    if (this._actionMenuModal || this._editorModal || this._confirmModal) {
      return;
    }
    const menuItem = this._actionMenuItemMap.get(actionId);
    if (
      menuItem &&
      menuItem.command.modifiers?.every((modifier) => ev[modifier as keyof KeyboardEvent])
    ) {
      this.onSelectMenuItem(menuItem);
      ev.preventDefault();
    }
  }

  private async onSelectMenuItem(item: ActionMenuItem): Promise<void> {
    switch (item.id) {
      case 'paste':
        if (this._currentCliplet) {
          await this.onChooseItem(this._currentCliplet);
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
    const ref = document.querySelector<HTMLElement>('.cliplet-search-modal');
    const selector = '.cliplet-editor-modal.ce-modal';
    const styles = [
      { selector, property: 'top', value: `${ref?.offsetTop || 0}px` },
      { selector, property: 'height', value: `${ref?.offsetHeight || 0}px` },
      { selector, property: 'width', value: `${ref?.offsetWidth || 0}px` },
    ];
    const stylesId = 'cliplet-editor-modal-styles';
    createStyles(styles, stylesId);

    this._editorModal = new ClipletEditorModal(
      this.app,
      this._plugin,
      isEdit ? this._currentCliplet : null,
    );
    this._editorModal.open();
    this._editorModal.whenClosed().then(async () => {
      await this.getCliplets();
      this._editorModal = null;
      deleteStyles(stylesId);
    });
  }

  private openConfirmModal(callback: () => Promise<void>, message: string): void {
    this._confirmModal = new ClipletConfirmModal(this.app, callback, message);
    this._confirmModal.open();
    this._confirmModal.whenClosed().then(async () => {
      await this.getCliplets();
      this._confirmModal = null;
    });
  }

  private openActionMenuModal(): void {
    const ref = document.querySelector<HTMLElement>('.cliplet-search-modal');
    const selector =
      '.modal-container.mod-dim:has(.cliplet-action-menu-modal) .cliplet-action-menu-modal';
    const styles = [
      { selector, property: 'right', value: `calc((100% - ${ref?.offsetWidth || 0}px) / 2 + 8px)` },
      { selector, property: 'bottom', value: `calc(100% - (442px + ${ref?.offsetTop || 0}px))` },
    ];
    const stylesId = 'cliplet-action-menu-modal-styles';
    createStyles(styles, stylesId);

    const actionMenuItems = this.generateActionMenuItems();
    this._actionMenuModal = new ActionMenuModal(
      this.app,
      this.onSelectMenuItem.bind(this),
      actionMenuItems,
    );
    this._actionMenuModal.open();
    this._actionMenuModal.whenClosed().then(() => {
      this._actionMenuModal = null;
      deleteStyles(stylesId);
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
