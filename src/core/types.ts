import { App } from 'obsidian';

export type CustomApp = App & {
	appId: string,
};

export interface ClipletItem {
	id: string,
	name: string,
	content: string,
	type: string,
	keyword: string,
	pinned: number,
	count: number
	created: number,
	lastUsed: number,
	lastModified: number,
}

export interface MetaItem {
	key: string;
	value: string;
}

export interface ActionMenuItem {
	id: string,
	text: string,
	labels: string[],
	command: {
		key: string,
		modifiers: string[],
	},
	isDanger?: boolean,
}
