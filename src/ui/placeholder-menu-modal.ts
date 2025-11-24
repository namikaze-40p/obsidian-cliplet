import { App, FuzzyMatch, FuzzySuggestModal, setIcon } from 'obsidian';

import { PlaceholderMenuItem } from 'src/core/types';

export class PlaceholderMenuModal extends FuzzySuggestModal<PlaceholderMenuItem> {
  private _resolveClose: (() => void) | null = null;

  constructor(
    app: App,
    private _onSelectMenuItem: (menuItem: PlaceholderMenuItem) => void,
    private _menuItems: PlaceholderMenuItem[],
  ) {
    super(app);

    this.setPlaceholder('Search placeholder...');
    this.modalEl.addClasses(['cliplet-placeholder-menu-modal', 'cp-modal']);
  }

  onClose(): void {
    if (this._resolveClose) {
      this._resolveClose();
    }
  }

  whenClosed(): Promise<void> {
    return new Promise((resolve) => (this._resolveClose = resolve));
  }

  getItems(): PlaceholderMenuItem[] {
    return this._menuItems;
  }

  getItemText(menuItem: PlaceholderMenuItem): string {
    return menuItem.text;
  }

  onChooseItem(menuItem: PlaceholderMenuItem): void {
    this._onSelectMenuItem(menuItem);
  }

  renderSuggestion(
    item: FuzzyMatch<PlaceholderMenuItem>,
    suggestionItemEl: HTMLElement,
  ): HTMLElement {
    const menu = item.item;
    setIcon(suggestionItemEl, this.getIcon(menu));
    suggestionItemEl.addClass('placeholder-menu-suggestion');
    suggestionItemEl.createSpan('').setText(menu.text);
    return suggestionItemEl;
  }

  private getIcon(menu: PlaceholderMenuItem): string {
    switch (menu.id) {
      case 'cursor':
        return 'text-cursor';
      case 'clipboard':
        return 'clipboard';
      default:
        return 'ban';
    }
  }
}
