import { MAXIMUM_CONTENT_SIZE } from './consts';
import { ClipletItem } from './types';

const encoder = new TextEncoder();
const toKB = (bytes: number): number => Math.ceil(bytes / 1024);

// Returns the message to show when the content exceeds MAXIMUM_CONTENT_SIZE, or null.
export const getContentSizeError = (content: string): string | null => {
  const size = encoder.encode(content).length;
  return size > MAXIMUM_CONTENT_SIZE
    ? `The content is too large (${toKB(size)} KB).\nThe maximum size is ${toKB(MAXIMUM_CONTENT_SIZE)} KB.`
    : null;
};

// Keeps only the persisted fields, so extra fields such as `decryptedContent`
// (plaintext) are never written to storage.
export const normalizeCliplet = (value: ClipletItem): ClipletItem => ({
  id: value.id,
  name: value.name,
  content: value.content,
  type: value.type,
  keyword: value.keyword,
  pinned: value.pinned,
  count: value.count,
  created: value.created,
  lastUsed: value.lastUsed,
  lastModified: value.lastModified,
});
