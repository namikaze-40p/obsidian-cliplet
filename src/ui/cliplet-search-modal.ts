import { App, Editor, FuzzyMatch, FuzzySuggestModal, Notice, setIcon } from 'obsidian';
import dayjs from 'dayjs';

import Cliplet from '../main';
import { ActionMenuItem, ClipletItem } from '../core/types';
import { createStyles, deleteStyles, pasteCliplet } from '../utils';
import { ActionMenuModal } from './action-menu-modal';
import { ACTION_MENU_ITEMS, IS_APPLE, KEYS } from '../core/consts';
import { ClipletConfirmModal } from './cliplet-confirm-modal';
import { ClipletEditorModal } from './cliplet-editor-modal';
import { ClipletService } from 'src/core/cliplet-service';

export class ClipletSearchModal extends FuzzySuggestModal<ClipletItem> {
	private _service: ClipletService;
	private _cliplets: ClipletItem[] = [];
	private _currentCliplet: ClipletItem | null = null;
	private _detailEls: { [key: string]: HTMLSpanElement | null } = {
		content: null,
		count: null,
		lastUsed: null,
		lastModified: null,
		created: null,
	};
	private _actionMenuItemMap = new Map(ACTION_MENU_ITEMS.map(item => [item.id, item]));
	private _eventListenerFn: (ev: KeyboardEvent) => void;
	private _actionMenuModal: ActionMenuModal | null = null;
	private _editorModal: ClipletEditorModal | null = null;
	private _confirmModal: ClipletConfirmModal | null = null;

	constructor(app: App, private _plugin: Cliplet, private _editor: Editor) {
		super(app);
		this._service = ClipletService.instance;
		this.getCliplets();

		this._eventListenerFn = this.handlingKeydownEvent.bind(this);
		window.addEventListener('keydown', this._eventListenerFn);

		this.modalEl.addClasses(['cliplet-search-modal', 'cs-modal']);
		this.setPlaceholder('Search cliplet...');

		const detailEl = this.modalEl.createDiv('cliplet-detail');
		this.generateDetails(detailEl);
		this.generateFooter(this.modalEl);
	}

	onOpen(): void {
		super.onOpen();

		const suggestionContainer = this.containerEl.querySelector('.prompt-results');
		if (suggestionContainer) {
			this.detectChangeSuggestionItems(suggestionContainer);
			setTimeout(() => suggestionContainer.addClass('shown'), 0);			
		}
	}

	onClose() {
		window.removeEventListener('keydown', this._eventListenerFn);
	}

	getItems(): ClipletItem[] {
		return this._cliplets;
	}
  
	getItemText(cliplet: ClipletItem): string {
		return [cliplet.name, cliplet.content].join(' ');
	}

	async onChooseItem(cliplet: ClipletItem): Promise<void> {
		const pastedCliplet = await pasteCliplet(this._editor, cliplet);
		await this._service.putCliplet(pastedCliplet);
		this._plugin.settings.latestClipletId = pastedCliplet.id;
		await this._plugin.saveSettings();
	}

	renderSuggestion(item: FuzzyMatch<ClipletItem>, suggestionItemEl: HTMLElement): HTMLElement {
		const cliplet = item.item;
		const texts = cliplet.content.split(/\r?\n/);
		const viewText = texts.length === 1 ? cliplet.content : `${texts[0]}...`;
		const icon = cliplet.pinned ? 'pin' : (cliplet.name ? 'tag' : 'clipboard');

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
		this._cliplets = await this._service.getAllCliplets();
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
			wrapEl.createSpan('', spanEl => spanEl.setText(itemName));
		}
		this._detailEls[propName] = wrapEl.createSpan('');
	}

	private detectChangeSuggestionItems(suggestionContainer: Element): void {
		const observer = this.generateObserver();
		const observeItems = () => {
			const items = suggestionContainer.querySelectorAll('.suggestion-item');
			items.forEach(item => observer.observe(item, { attributes: true, attributeFilter: ['class'] }));
		};

		observeItems();

		this.inputEl.addEventListener('input', () => {
			const cliplet = this.findClipletItem(suggestionContainer.firstChild?.lastChild);
			if (cliplet) {
				this.updateDetailView(cliplet);
			} else {
				this._currentCliplet = null;
				this._detailEls.content?.empty();
				this._detailEls.count?.empty();
				this._detailEls.lastUsed?.empty();
				this._detailEls.lastModified?.empty();
				this._detailEls.created?.empty();
			}
			setTimeout(observeItems, 0);
		});
	}

	private generateObserver(): MutationObserver {
		return new MutationObserver((mutations: MutationRecord[]) => {
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

	private findClipletItem(el: ChildNode | null | undefined): ClipletItem | undefined {
		if (el?.nodeName !== 'SPAN') {
			return;
		}
		return this._cliplets.find(item => item.id === (el as HTMLSpanElement).dataset.clipletId);
	}

	private updateDetailView(cliplet: ClipletItem): void {
		if (this._detailEls.content && this._detailEls.count && this._detailEls.lastUsed && this._detailEls.lastModified && this._detailEls.created) {	
			this._currentCliplet = cliplet;
			this._detailEls.content.textContent = cliplet.content;
			this._detailEls.count.textContent = `${cliplet.count}`;
			this._detailEls.lastUsed.textContent = cliplet.lastUsed ? dayjs.unix(cliplet.lastUsed).format('MMM D, YYYY [at] HH:mm:ss') : '';
			this._detailEls.lastModified.textContent = cliplet.lastModified ? dayjs.unix(cliplet.lastModified).format('MMM D, YYYY [at] HH:mm:ss') : '';
			this._detailEls.created.textContent = dayjs.unix(cliplet.created).format('MMM D, YYYY [at] HH:mm:ss');
		}
	}

	private generateFooter(contentEl: HTMLElement): void {
		contentEl.createDiv('cs-modal-footer', footerEl => {
			footerEl.createSpan('', el => {
				el.createSpan().setText('Search cliplet');
			});
			footerEl.createDiv('', wrapperEl => {
				wrapperEl.createDiv('cs-modal-legend', el => {
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
				wrapperEl.createDiv('cs-modal-legend', el => {
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
				this.handlingActionMenu(ev, 'deleteAll');
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
		if (menuItem && menuItem.command.modifiers?.every(modifier => ev[modifier as keyof KeyboardEvent])) {
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
			case 'edit':
			case 'create': {
				this.openEditorModal(item.id === 'edit');
				return;
			}
			case 'pin': {
				if (this._currentCliplet) {
					const now = dayjs().unix();
					const pinned = this._currentCliplet.pinned ? 0 : now;
					await this._service.putCliplet({ ...this._currentCliplet, pinned, lastModified: now });
					await this.getCliplets();
				}
				return;
			}
			case 'delete': {
				const callback = async () => {
					await this._service.deleteCliplet(this._currentCliplet?.id || '');
					new Notice('Deleted cliplet.');
				}
				this.openConfirmModal(callback, false);
				return;
			}
			case 'deleteAll':{
				const callback = async () => {
					await this._service.deleteAllCliplets();
					new Notice('Deleted all cliplets.');
				}
				this.openConfirmModal(callback, true);
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

		this._editorModal = new ClipletEditorModal(this.app, this._plugin, isEdit ? this._currentCliplet : null);
		this._editorModal.open();
		this._editorModal.whenClosed().then(async () => {
			await this.getCliplets();
			this._editorModal = null;
			deleteStyles(stylesId);
		});
	}

	private openConfirmModal(callback: () => Promise<void>, isDeleteAll: boolean): void {
		this._confirmModal = new ClipletConfirmModal(this.app, callback, isDeleteAll);
		this._confirmModal.open();
		this._confirmModal.whenClosed().then(async () => {
			await this.getCliplets();
			this._confirmModal = null;
		});
	}

	private openActionMenuModal(): void {
		const ref = document.querySelector<HTMLElement>('.cliplet-search-modal');
		const selector = '.modal-container.mod-dim:has(.cliplet-action-menu-modal) .cliplet-action-menu-modal'; 
		const styles = [
			{ selector, property: 'right', value: `calc((100% - ${ref?.offsetWidth || 0}px) / 2 + 8px)` },
			{ selector, property: 'bottom', value: `calc(100% - (442px + ${ref?.offsetTop || 0}px))` },
		];
		const stylesId = 'cliplet-action-menu-modal-styles';
		createStyles(styles, stylesId);

		const actionMenuItems = this.generateActionMenuItems();
		this._actionMenuModal = new ActionMenuModal(this.app, this.onSelectMenuItem.bind(this), actionMenuItems);
		this._actionMenuModal.open();
		this._actionMenuModal.whenClosed().then(() => {
			this._actionMenuModal = null;
			deleteStyles(stylesId);
		});
	}

	private generateActionMenuItems(): ActionMenuItem[] {
		if (this._currentCliplet) {
			return ACTION_MENU_ITEMS;
		} else {
			const hideItemIds = ['paste', 'edit', 'pin', 'delete'];
			if (!this._cliplets.length) {
				hideItemIds.push('deleteAll');
			}
			return ACTION_MENU_ITEMS.filter(item => !hideItemIds.includes(item.id));
		}
	}
}
