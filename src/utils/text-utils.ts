export const getClipboard = async (): Promise<string> => {
  try {
    if (!('clipboard' in navigator) || !navigator.clipboard?.readText) {
      return '';
    }
    const text = await navigator.clipboard.readText();
    return typeof text === 'string' ? text : '';
  } catch {
    return '';
  }
};

export const escapeHtml = (text: string): string => {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

export const replaceWithHighlight = (
  text: string,
  pattern: string,
  global: boolean,
  replacer: (full: string, inner: string) => string,
): string => {
  const regex = new RegExp(pattern, global ? 'g' : '');
  return text.replace(regex, (full, inner) => replacer(full, inner));
};
