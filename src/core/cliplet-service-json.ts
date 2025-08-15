import { deleteDB, IDBPDatabase } from 'idb';

import crypto from './crypto';
import { ClipletDBSchema, getDbPromise } from './database';
import { ClipletStoreJson } from './cliplet-store-json';
import { MetaStore } from './meta-store';
import { ClipletItem } from './types';
import Cliplet from 'src/main';

export class ClipletServiceJson {
	private static _instance: ClipletServiceJson | null = null;
	private _db: IDBPDatabase<ClipletDBSchema> | null = null;
	private _store: ClipletStoreJson;

	private constructor(private _appId: string) {}

	static async init(appId: string, plugin: Cliplet): Promise<ClipletServiceJson> {
		if (!this._instance) {			
			this._instance = new ClipletServiceJson(appId);
			this._instance._db = await getDbPromise(appId);
			const basePassword = appId;
			const metaStore = new MetaStore(this._instance._db);
			const seed = metaStore.getOrCreateSeed(basePassword);
			const aesKey = await crypto.deriveKey(basePassword + seed, crypto.salt2);
			this._instance._store = new ClipletStoreJson(plugin, aesKey);
		}
		return this._instance;
	}

	static get instance(): ClipletServiceJson {
		if (this._instance) { 
			return this._instance;
		} else {
			throw new Error('ClipletServiceJson has not been initialized. Call init() first.');
		}
	}

	destroy(): void {
		this.closeDB();
		ClipletServiceJson._instance = null;
	}

	hasDB(): boolean { 
		return !!this._db;
	}

	closeDB(): void {
		this._db?.close();
	}

	async deleteDB(): Promise<void> {
		await deleteDB(this._db?.name || '');
		this._db = null;
	}

	async getCliplet(id: string): Promise<ClipletItem | undefined> {
		return this._store.get(id);
	}

	async getAllCliplets(): Promise<ClipletItem[]> {
		return await this._store.list();
	}

	async addCliplet(value: ClipletItem): Promise<string> {
		return this._store.add(value);
	}

	async putCliplet(value: ClipletItem): Promise<void> {
		return this._store.put(value);
	}

	async deleteCliplet(id: string): Promise<void> {
		return this._store.delete(id);
	}

	async deleteAllCliplets(): Promise<void> {
		return this._store.deleteAll();
	}

	async deleteExceededRecords(maxCount: number): Promise<void> {
		return this._store.deleteExceededRecords(maxCount);
	}

	async deleteOverdueRecords(days: number): Promise<void> {
		return this._store.deleteOverdueRecords(days);
	}
}
