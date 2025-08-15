import { openDB, DBSchema, IDBPDatabase } from 'idb';

import { ClipletItem, MetaItem } from './types';

const DB_VERSION = 1;
const STORE_NAME = {
	cliplet: 'cliplet' as const,
	meta: 'meta' as const,
};

export interface ClipletDBSchema extends DBSchema {
	[STORE_NAME.cliplet]: {
		key: string;
		value: ClipletItem;
		indexes: { pinned: IDBValidKey; keyword: IDBValidKey; lastUsed: IDBValidKey };
	};
	[STORE_NAME.meta]: {
		key: string;
		value: MetaItem;
	};
}

export const getDbPromise = (appId: string): Promise<IDBPDatabase<ClipletDBSchema>> => {
	return openDB(`${appId}-Cliplet`, DB_VERSION, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(STORE_NAME.cliplet)) {
				const store = db.createObjectStore(STORE_NAME.cliplet, { keyPath: 'id' });
				store.createIndex('keyword', 'keyword');
			}
			if (!db.objectStoreNames.contains(STORE_NAME.meta)) {
				db.createObjectStore(STORE_NAME.meta, { keyPath: 'key' });
			}
		},
		blocking(_, __, event) {
			(event.target as IDBDatabase).close();
		},
	});
}
