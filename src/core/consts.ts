import { Modifier, Platform } from 'obsidian';

export const RETENTION_PERIOD = 60;
export const MAXIMUM_RECORDS = 200;

export const IS_APPLE = Platform.isMacOS || Platform.isIosApp;

export const KEYS = {
  enter: '↩︎',
  mod: IS_APPLE ? '⌘' : 'Ctrl',
  ctrl: IS_APPLE ? '^' : 'Alt',
  shift: IS_APPLE ? '⇧' : 'Shift',
};

export const ACTION_MENU_ITEMS = [
  {
    id: 'paste',
    text: 'Paste cliplet',
    labels: [KEYS.enter],
    command: {
      key: 'Enter',
      modifiers: [] as Modifier[],
    },
    isDanger: false,
  },
  {
    id: 'edit',
    text: 'Edit cliplet',
    labels: [KEYS.mod, 'E'],
    command: {
      key: 'e',
      modifiers: [IS_APPLE ? 'Meta' : 'Ctrl'] as Modifier[],
    },
    isDanger: false,
  },
  {
    id: 'pin',
    text: 'Pin cliplet',
    labels: [KEYS.mod, 'P'],
    command: {
      key: 'p',
      modifiers: [IS_APPLE ? 'Meta' : 'Ctrl'] as Modifier[],
    },
    isDanger: false,
  },
  {
    id: 'unpin',
    text: 'Unpin cliplet',
    labels: [KEYS.mod, 'P'],
    command: {
      key: 'p',
      modifiers: [IS_APPLE ? 'Meta' : 'Ctrl'] as Modifier[],
    },
    isDanger: false,
  },
  {
    id: 'create',
    text: 'Create cliplet',
    labels: [KEYS.mod, 'N'],
    command: {
      key: 'n',
      modifiers: [IS_APPLE ? 'Meta' : 'Ctrl'] as Modifier[],
    },
    isDanger: false,
  },
  {
    id: 'delete',
    text: 'Delete cliplet',
    labels: [KEYS.ctrl, 'X'],
    command: {
      key: 'x',
      modifiers: [IS_APPLE ? 'Ctrl' : 'Alt'] as Modifier[],
    },
    isDanger: true,
  },
  {
    id: 'deleteResults',
    text: 'Delete results',
    labels: [KEYS.ctrl, KEYS.shift, 'X'],
    command: {
      key: 'X',
      modifiers: [IS_APPLE ? 'Ctrl' : 'Alt', 'Shift'] as Modifier[],
    },
    isDanger: true,
  },
];

export const TOKEN = {
  cursor: '{cursor}',
  clipboard: '{clipboard}',
};

export const PLACEHOLDER_MENU_ITEMS = [
  {
    id: 'cursor',
    text: 'Cursor position',
    token: TOKEN.cursor,
  },
  {
    id: 'clipboard',
    text: 'Clipboard',
    token: TOKEN.clipboard,
  },
];
