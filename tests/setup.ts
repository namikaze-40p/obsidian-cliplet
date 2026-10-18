import 'fake-indexeddb/auto';

// src/core/crypto.ts reads `window.crypto`.
Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
