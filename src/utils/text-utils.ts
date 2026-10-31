import { Notice } from 'obsidian';

import { TOKEN } from 'src/core/consts';

export const replaceWithClipboardText = async (
  content: string,
  clipboardText: string | null = null,
): Promise<string> => {
  // Reading the clipboard can show a paste prompt or notification on mobile, so avoid it when unused.
  if (!content.includes(TOKEN.clipboard)) {
    return content;
  }
  const replaceText = clipboardText ?? (await getClipboard());
  // split/join inserts the text literally ("$&" etc. are not treated as replacement patterns).
  return content.split(TOKEN.clipboard).join(replaceText);
};

// Only the first {cursor} moves the cursor; the others are removed.
export const removeCursorTokens = (content: string): string =>
  content.split(TOKEN.cursor).join('');

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
    // Tokens are removed first, so that a {cursor} in the clipboard text is kept.
    const replacedText = await replaceWithClipboardText(removeCursorTokens(text));
    await navigator.clipboard.writeText(replacedText);
    new Notice('Copied to clipboard');
  } catch {
    new Notice('Failed to copy to clipboard');
  }
};
