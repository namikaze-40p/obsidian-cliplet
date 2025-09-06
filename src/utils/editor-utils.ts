import { Editor } from 'obsidian';
import dayjs from 'dayjs';

import { ClipletItem } from '../core/types';

export const pasteCliplet = (editor: Editor, cliplet: ClipletItem): ClipletItem => {
  const from = editor.getCursor('from');
  const to = editor.getCursor('to');
  editor.replaceRange(cliplet.content, from, to);
  editor.setCursor(from.line, from.ch + cliplet.content.length);
  return { ...cliplet, lastUsed: dayjs().unix(), count: cliplet.count + 1 };
};
