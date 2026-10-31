import { describe, expect, it } from 'vitest';

import { getContentSizeError } from 'src/core/cliplet-item';
import { MAXIMUM_CONTENT_SIZE } from 'src/core/consts';

describe('getContentSizeError', () => {
  it('accepts content up to the maximum size', () => {
    expect(getContentSizeError('a'.repeat(MAXIMUM_CONTENT_SIZE))).toBeNull();
  });

  it('rejects content over the maximum size', () => {
    expect(getContentSizeError('a'.repeat(MAXIMUM_CONTENT_SIZE + 1))).toBe(
      'The content is too large (101 KB).\nThe maximum size is 100 KB.',
    );
  });

  it('measures the size in UTF-8 bytes', () => {
    // "あ" is 3 bytes in UTF-8.
    const length = Math.floor(MAXIMUM_CONTENT_SIZE / 3);
    expect(getContentSizeError('あ'.repeat(length))).toBeNull();
    expect(getContentSizeError('あ'.repeat(length + 1))).not.toBeNull();
  });
});
