import { App, FuzzyMatch, FuzzySuggestModal, setIcon } from 'obsidian';

import { ActionMenuItem } from '../core/types';

export class ActionMenuModal extends FuzzySuggestModal<ActionMenuItem> {
  private _eventListenerFn: (ev: KeyboardEvent) => void;
  private _resolveClose: (() => void) | null = null;

  constructor(
    app: App,
    private _onSelectMenuItem: (menuItem: ActionMenuItem) => void,
    private _menuItems: ActionMenuItem[],
  ) {
    super(app);

    this.setPlaceholder('Search action...');
    this.modalEl.addClasses(['cliplet-action-menu-modal', 'ca-modal']);

    this._eventListenerFn = this.handlingKeydownEvent.bind(this);
    window.addEventListener('keydown', this._eventListenerFn);
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

  getItems(): ActionMenuItem[] {
    return this._menuItems;
  }

  getItemText(menuItem: ActionMenuItem): string {
    return menuItem.text;
  }

  onChooseItem(menuItem: ActionMenuItem): void {
    this._onSelectMenuItem(menuItem);
  }

  renderSuggestion(item: FuzzyMatch<ActionMenuItem>, suggestionItemEl: HTMLElement): HTMLElement {
    const menu = item.item;
    setIcon(suggestionItemEl, this.getIcon(menu));
    const classes = ['action-menu-suggestion', 'danger-action'];
    suggestionItemEl.addClass(...(menu.isDanger ? classes : [classes[0]]));
    suggestionItemEl.createSpan('').setText(menu.text);
    const labelsEl = suggestionItemEl.createDiv('');
    for (const label of menu.labels) {
      labelsEl.createDiv('cliplet-legend-label').setText(label);
    }
    return suggestionItemEl;
  }

  private handlingKeydownEvent(ev: KeyboardEvent): void {
    for (const menu of this._menuItems) {
      const { key, modifiers } = menu.command;
      if (ev.key === key && modifiers.every((modifier) => ev[modifier as keyof KeyboardEvent])) {
        this._onSelectMenuItem(menu);
        ev.preventDefault();
        this.close();
        return;
      }
    }
  }

  private getIcon(menu: ActionMenuItem): string {
    switch (menu.id) {
      case 'paste':
        return 'clipboard-paste';
      case 'edit':
        return 'square-pen';
      case 'pin':
        return 'pin';
      case 'unpin':
        return 'pin-off';
      case 'create':
        return 'clipboard';
      case 'delete':
      case 'deleteResults':
        return 'trash-2';
      default:
        return 'ban';
    }
  }
}
