import { Notice } from 'obsidian';

import { TOKEN } from 'src/core/consts';

export const replaceWithClipboardText = async (
  content: string,
  clipboardText: string | null = null,
): Promise<string> => {
  const replaceText = clipboardText ?? (await getClipboard());
  return content.replace(new RegExp(TOKEN.clipboard, 'g'), replaceText);
};

export const getClipboard = async (): Promise<string> => {
  try {
    if (!('clipboard' in navigator) || !navigator.clipboard?.readText) {
      return '';
    }
    const text = await navigator.clipboard.readText();
    return typeof text === 'string' ? text : '';
  } catch {
    return '';
  }
};

export const copyToClipboard = async (text: string): Promise<void> => {
  try {
    const replacedText = (await replaceWithClipboardText(text)).replace(TOKEN.cursor, '');
    await navigator.clipboard.writeText(replacedText);
    new Notice('Copied to clipboard');
  } catch {
    new Notice('Failed to copy to clipboard');
  }
};

export const escapeHtml = (text: string): string => {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

export const replaceWithHighlight = (
  text: string,
  pattern: string,
  global: boolean,
  replacer: (full: string, inner: string) => string,
): string => {
  const regex = new RegExp(pattern, global ? 'g' : '');
  return text.replace(regex, (full, inner) => replacer(full, inner));
};
