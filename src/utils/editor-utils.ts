import { Editor, EditorPosition } from 'obsidian';
import dayjs from 'dayjs';

import { TOKEN } from 'src/core/consts';
import { DecryptedClipletItem } from 'src/core/types';

import { replaceWithClipboardText } from './text-utils';

// Line breaks are split the same way as CodeMirror (\r\n, \r, \n).
const getEndPosition = (from: EditorPosition, text: string): EditorPosition => {
  const lines = text.split(/\r\n?|\n/);
  const lastLine = lines[lines.length - 1];
  return lines.length === 1
    ? { line: from.line, ch: from.ch + lastLine.length }
    : { line: from.line + lines.length - 1, ch: lastLine.length };
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
    editor.setCursor(getEndPosition(from, replacedContent));
  } else {
    const before = content.slice(0, tokenIndex);
    const after = content.slice(tokenIndex + TOKEN.cursor.length);
    const replacedBefore = await replaceWithClipboardText(before, clipboardText);
    const replacedAfter = await replaceWithClipboardText(after, clipboardText);
    const pasteText = replacedBefore + replacedAfter;
    editor.replaceRange(pasteText, from, to);
    editor.setCursor(getEndPosition(from, replacedBefore));
  }

  return {
    ...cliplet,
    lastUsed: dayjs().unix(),
    count: cliplet.count + 1,
  };
};
