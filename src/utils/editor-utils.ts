import { Editor } from 'obsidian';
import dayjs from 'dayjs';

import { DecryptedClipletItem } from '../core/types';

export const pasteCliplet = (
  editor: Editor,
  cliplet: DecryptedClipletItem,
): DecryptedClipletItem => {
  const from = editor.getCursor('from');
  const to = editor.getCursor('to');
  editor.replaceRange(cliplet.decryptedContent, from, to);
  editor.setCursor(from.line, from.ch + cliplet.decryptedContent.length);
  return { ...cliplet, lastUsed: dayjs().unix(), count: cliplet.count + 1 };
};
