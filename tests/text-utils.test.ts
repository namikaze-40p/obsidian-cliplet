import { afterEach, describe, expect, it, vi } from 'vitest';

import { replaceWithClipboardText } from 'src/utils/text-utils';

describe('replaceWithClipboardText', () => {
  it('replaces every {clipboard} token', async () => {
    expect(await replaceWithClipboardText('{clipboard}-{clipboard}', 'x')).toBe('x-x');
  });

  it('returns the content as is when there is no token', async () => {
    expect(await replaceWithClipboardText('no token', 'x')).toBe('no token');
  });

  describe('when the clipboard text is not given', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('reads the clipboard only when there is a token', async () => {
      const readText = vi.fn(async () => 'CLIP');
      vi.stubGlobal('navigator', { clipboard: { readText } });

      expect(await replaceWithClipboardText('no token')).toBe('no token');
      expect(readText).not.toHaveBeenCalled();
      expect(await replaceWithClipboardText('<{clipboard}>')).toBe('<CLIP>');
      expect(readText).toHaveBeenCalledTimes(1);
    });
  });

  it.each(['$&', '$$5', "$` $' $1"])('inserts %s literally', async (text) => {
    expect(await replaceWithClipboardText('A{clipboard}B', text)).toBe(`A${text}B`);
  });

  it('does not replace tokens inside the inserted text again', async () => {
    expect(await replaceWithClipboardText('A{clipboard}B', '{clipboard}')).toBe('A{clipboard}B');
  });
});
