import { describe, expect, it } from 'vitest';

import { replaceWithClipboardText } from 'src/utils/text-utils';

describe('replaceWithClipboardText', () => {
  it('replaces every {clipboard} token', async () => {
    expect(await replaceWithClipboardText('{clipboard}-{clipboard}', 'x')).toBe('x-x');
  });

  it('returns the content as is when there is no token', async () => {
    expect(await replaceWithClipboardText('no token', 'x')).toBe('no token');
  });

  it.each(['$&', '$$5', "$` $' $1"])('inserts %s literally', async (text) => {
    expect(await replaceWithClipboardText('A{clipboard}B', text)).toBe(`A${text}B`);
  });

  it('does not replace tokens inside the inserted text again', async () => {
    expect(await replaceWithClipboardText('A{clipboard}B', '{clipboard}')).toBe('A{clipboard}B');
  });
});
