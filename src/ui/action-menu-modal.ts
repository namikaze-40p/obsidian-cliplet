import { App, FuzzyMatch, FuzzySuggestModal, Modifier, setIcon } from 'obsidian';

import { IS_APPLE } from 'src/core/consts';
import { ActionMenuItem } from 'src/core/types';

export class ActionMenuModal extends FuzzySuggestModal<ActionMenuItem> {
  private _resolveClose: (() => void) | null = null;

  constructor(
    app: App,
    private _onSelectMenuItem: (menuItem: ActionMenuItem) => void,
    private _menuItems: ActionMenuItem[],
  ) {
    super(app);

    this.setPlaceholder('Search action...');
    this.modalEl.addClasses(['cliplet-action-menu-modal', 'ca-modal']);

    this.registerShortcutKeys();
  }

  onClose(): void {
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

  private registerShortcutKeys(): void {
    const bindings: [Modifier[], string, (ev: KeyboardEvent) => void][] = [
      [
        [IS_APPLE ? 'Meta' : 'Ctrl'],
        'k',
        (ev) => {
          this.close();
          ev.stopPropagation();
          ev.preventDefault();
        },
      ],
      ...(this._menuItems.map((item) => {
        return [
          item.command.modifiers,
          item.command.key,
          (ev) => {
            this._onSelectMenuItem(item);
            ev.stopPropagation();
            ev.preventDefault();
            this.close();
          },
        ];
      }) as [Modifier[], string, (ev: KeyboardEvent) => void][]),
    ];
    bindings.forEach(([mods, key, handler]) => this.scope.register(mods, key, handler));
  }

  private getIcon(menu: ActionMenuItem): string {
    switch (menu.id) {
      case 'paste':
        return 'clipboard-paste';
      case 'toClipboard':
        return 'clipboard-copy';
      case 'edit':
        return 'pencil';
      case 'pin':
        return 'pin';
      case 'unpin':
        return 'pin-off';
      case 'create':
        return 'circle-plus';
      case 'delete':
      case 'deleteResults':
        return 'trash-2';
      default:
        return 'ban';
    }
  }
}
