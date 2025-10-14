import { openDB, DBSchema, IDBPDatabase } from 'idb';

import { ClipletItem } from './types';

const DB_VERSION = 1;
const STORE_NAME = {
  cliplet: 'cliplet' as const,
};

export interface ClipletDBSchema extends DBSchema {
  [STORE_NAME.cliplet]: {
    key: string;
    value: ClipletItem;
    indexes: { pinned: IDBValidKey; keyword: IDBValidKey; lastUsed: IDBValidKey };
  };
}

export const getDbPromise = (vaultId: string): Promise<IDBPDatabase<ClipletDBSchema>> => {
  return openDB(`${vaultId}-Cliplet`, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME.cliplet)) {
        const store = db.createObjectStore(STORE_NAME.cliplet, { keyPath: 'id' });
        store.createIndex('keyword', 'keyword');
      }
    },
    blocking(_, __, event) {
      (event.target as IDBDatabase).close();
    },
  });
};
