import { Editor } from 'obsidian';
import dayjs from 'dayjs';

import { DecryptedClipletItem } from '../core/types';
import { TOKEN } from '../core/consts';
import { getClipboard } from './text-utils';

const replaceWithClipboardText = async (
  content: string,
  clipboardText: string | null,
): Promise<string> => {
  const replaceText = clipboardText ?? (await getClipboard());
  return content.replace(new RegExp(TOKEN.clipboard, 'g'), replaceText);
};

export const pasteCliplet = async (
  editor: Editor,
  cliplet: DecryptedClipletItem,
  clipboardText: string | null = null,
): Promise<DecryptedClipletItem> => {
  const from = editor.getCursor('from');
  const to = editor.getCursor('to');
  const content = cliplet.decryptedContent;

  const tokenIndex = content.indexOf(TOKEN.cursor);

  if (tokenIndex === -1) {
    const replacedContent = await replaceWithClipboardText(content, clipboardText);
    editor.replaceRange(replacedContent, from, to);
    editor.setCursor(from.line, from.ch + replacedContent.length);
  } else {
    const before = content.slice(0, tokenIndex);
    const after = content.slice(tokenIndex + TOKEN.cursor.length);
    const replacedBefore = await replaceWithClipboardText(before, clipboardText);
    const replacedAfter = await replaceWithClipboardText(after, clipboardText);
    const pasteText = replacedBefore + replacedAfter;
    editor.replaceRange(pasteText, from, to);

    const beforeLines = replacedBefore.split('\n');
    const cursorLineOffset = beforeLines.length - 1;
    const cursorLine = from.line + cursorLineOffset;
    const cursorCh =
      beforeLines.length === 1
        ? from.ch + beforeLines[0].length
        : beforeLines[beforeLines.length - 1].length;
    editor.setCursor(cursorLine, cursorCh);
  }

  return {
    ...cliplet,
    lastUsed: dayjs().unix(),
    count: cliplet.count + 1,
  };
};
