import type { Editor, EditorPosition } from 'obsidian';
import { describe, expect, it } from 'vitest';

import { DecryptedClipletItem } from 'src/core/types';
import { pasteCliplet } from 'src/utils/editor-utils';

// A minimal editor that keeps the document as a string and normalizes line breaks like CodeMirror.
const createEditor = (doc: string, from: EditorPosition, to: EditorPosition = from) => {
  let text = doc;
  let cursor: EditorPosition = from;
  // Like CodeMirror, a ch beyond the end of the line is clamped to the line end.
  const toOffset = (pos: EditorPosition) => {
    const lines = text.split('\n');
    const lineStart = lines
      .slice(0, pos.line)
      .reduce((offset, line) => offset + line.length + 1, 0);
    return lineStart + Math.min(pos.ch, lines[pos.line]?.length ?? 0);
  };
  const editor = {
    getCursor: (which: 'from' | 'to') => (which === 'from' ? from : to),
    replaceRange: (insert: string, start: EditorPosition, end: EditorPosition) => {
      const normalized = insert.replace(/\r\n?/g, '\n');
      text = text.slice(0, toOffset(start)) + normalized + text.slice(toOffset(end));
    },
    // Supports both setCursor(pos) and setCursor(line, ch), like Obsidian's Editor.
    setCursor: (pos: EditorPosition | number, ch?: number) => {
      cursor = typeof pos === 'number' ? { line: pos, ch: ch ?? 0 } : pos;
    },
  };
  // Returns the document with "|" at the cursor position.
  const result = () => text.slice(0, toOffset(cursor)) + '|' + text.slice(toOffset(cursor));
  return { editor: editor as unknown as Editor, result };
};

const cliplet = (decryptedContent: string): DecryptedClipletItem => ({
  id: 'id',
  name: '',
  content: '',
  type: 'text',
  keyword: '',
  pinned: 0,
  count: 3,
  created: 0,
  lastUsed: 0,
  lastModified: 0,
  decryptedContent,
});

describe('pasteCliplet', () => {
  it.each([
    ['single line', 'abc', 'xxabc|yy'],
    ['multiple lines', 'ab\ncde', 'xxab\ncde|yy'],
    ['trailing newline', 'ab\n', 'xxab\n|yy'],
    ['CRLF line breaks', 'ab\r\ncd', 'xxab\ncd|yy'],
    ['{cursor} on the first line', 'a{cursor}b', 'xxa|byy'],
    ['{cursor} after line breaks', 'a\nbc{cursor}d', 'xxa\nbc|dyy'],
    ['{cursor} at the start', '{cursor}a\nb', 'xx|a\nbyy'],
    ['{clipboard} token', '<{clipboard}>', 'xx<CLIP>|yy'],
  ])('places the cursor correctly: %s', async (_, content, expected) => {
    const { editor, result } = createEditor('xxyy', { line: 0, ch: 2 });
    await pasteCliplet(editor, cliplet(content), 'CLIP');
    expect(result()).toBe(expected);
  });

  it('pastes on a later line', async () => {
    const { editor, result } = createEditor('L0\nxxyy', { line: 1, ch: 2 });
    await pasteCliplet(editor, cliplet('a\nb\nc'), 'CLIP');
    expect(result()).toBe('L0\nxxa\nb\nc|yy');
  });

  it('replaces the selection', async () => {
    const { editor, result } = createEditor('xxSELyy', { line: 0, ch: 2 }, { line: 0, ch: 5 });
    await pasteCliplet(editor, cliplet('a\nb'), 'CLIP');
    expect(result()).toBe('xxa\nb|yy');
  });

  it('increments the usage count and updates lastUsed', async () => {
    const { editor } = createEditor('', { line: 0, ch: 0 });
    const pasted = await pasteCliplet(editor, cliplet('a'), 'CLIP');
    expect(pasted.count).toBe(4);
    expect(pasted.lastUsed).toBeGreaterThan(0);
  });
});
