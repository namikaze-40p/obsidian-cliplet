import { IDBPDatabase } from 'idb';
import { v4 as uuid } from 'uuid';

import crypto from './crypto';
import { ClipletDBSchema } from './database';

const STORE_NAME = 'meta';

export class MetaStore {
	constructor(private _db: IDBPDatabase<ClipletDBSchema>) { }
	
	async getOrCreateSeed(basePassword: string): Promise<string> {
		const encryptionKey = await crypto.deriveKey(basePassword, crypto.salt1);
		const existing = await this._db.get(STORE_NAME, 'seed');

		if (existing?.value) {
			return await crypto.decryptData(existing.value, encryptionKey);
		} else {
			const newSeed = uuid();
			const encrypted = await crypto.encryptData(newSeed, encryptionKey);
			await this._db.put(STORE_NAME, { key: 'seed', value: encrypted });
			return newSeed;
		}
	}

}
