import { deleteDB, openDB, DBSchema, IDBPDatabase } from 'idb';

import { ClipletItem } from './types';

const DB_VERSION = 1;
const STORE_NAME = {
  cliplet: 'cliplet' as const,
};

export interface ClipletDBSchema extends DBSchema {
  [STORE_NAME.cliplet]: {
    key: string;
    value: ClipletItem;
    indexes: { keyword: IDBValidKey };
  };
}

const getDbName = (vaultId: string): string => `${vaultId}-Cliplet`;

export const getDbPromise = (vaultId: string): Promise<IDBPDatabase<ClipletDBSchema>> => {
  return openDB(getDbName(vaultId), DB_VERSION, {
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

export const deleteDatabase = (vaultId: string): Promise<void> => deleteDB(getDbName(vaultId));
