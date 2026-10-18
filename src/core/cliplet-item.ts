import { ClipletItem } from './types';

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
