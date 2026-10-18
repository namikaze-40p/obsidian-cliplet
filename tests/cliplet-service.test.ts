import dayjs from 'dayjs';
import { afterEach, describe, expect, it } from 'vitest';

import { ClipletService } from 'src/core/cliplet-service';
import { ClipletItem, StorageType } from 'src/core/types';
import Cliplet from 'src/main';
import { Settings } from 'src/settings';

type FakePlugin = {
  settings: Pick<Settings, 'storageType' | 'cliplets'>;
  persisted: Pick<Settings, 'storageType' | 'cliplets'> | null;
  saveCount: number;
  failOnSave: number | null;
  saveSettings: () => Promise<void>;
};

// Stands in for the plugin: `persisted` is what would be written to data.json.
const createPlugin = (storageType: StorageType, cliplets: ClipletItem[] = []): FakePlugin => ({
  settings: { storageType, cliplets: structuredClone(cliplets) },
  persisted: null,
  saveCount: 0,
  failOnSave: null,
  async saveSettings() {
    this.saveCount++;
    if (this.failOnSave === this.saveCount) {
      throw new Error('Failed to write data.json');
    }
    this.persisted = structuredClone(this.settings);
  },
});

const services: ClipletService[] = [];
let vaultCount = 0;

const createService = async (plugin: FakePlugin, vaultId = `vault-${vaultCount++}`) => {
  const service = new ClipletService(
    vaultId,
    plugin as unknown as Cliplet,
    plugin.settings.storageType,
  );
  await service.init();
  services.push(service);
  return service;
};

const now = () => dayjs().unix();
const daysAgo = (days: number) => dayjs().subtract(days, 'day').unix();

const item = (id: string, props: Partial<ClipletItem> = {}): ClipletItem => ({
  id,
  name: '',
  content: `encrypted-${id}`,
  type: 'text',
  keyword: '',
  pinned: 0,
  count: 0,
  created: now(),
  lastUsed: 0,
  lastModified: 0,
  ...props,
});

const ids = async (service: ClipletService) => (await service.getAllCliplets()).map(({ id }) => id);

afterEach(() => {
  services.splice(0).forEach((service) => service.closeDB());
});

describe.each<StorageType>(['idb', 'json'])('ClipletService (%s)', (storageType) => {
  it('adds, gets, updates and deletes cliplets', async () => {
    const service = await createService(createPlugin(storageType));
    await service.addCliplet(item('a'));
    expect((await service.getCliplet('a'))?.id).toBe('a');

    await service.putCliplet({ ...item('a'), count: 5 });
    expect((await service.getCliplet('a'))?.count).toBe(5);

    await service.deleteCliplet('a');
    expect(await service.getCliplet('a')).toBeUndefined();
  });

  it('does not create a cliplet when updating one that does not exist', async () => {
    const service = await createService(createPlugin(storageType));
    await service.putCliplet(item('missing'));
    expect(await ids(service)).toEqual([]);
  });

  it('deletes the data in both storages and requires a reload', async () => {
    const vaultId = `vault-${vaultCount++}`;
    const idbService = await createService(createPlugin('idb'), vaultId);
    await idbService.addCliplet(item('in-idb'));
    idbService.closeDB();
    // data.json also holds a stale copy, e.g. left by a failed storage switch.
    const plugin = createPlugin(storageType, [item('in-json')]);
    const service = await createService(plugin, vaultId);

    await service.deleteDB();

    expect(service.hasDB()).toBe(false);
    expect(plugin.persisted?.cliplets).toEqual([]);
    const reopened = await createService(createPlugin('idb'), vaultId);
    expect(await ids(reopened)).toEqual([]);
  });

  it('lists pinned cliplets first, then the most recently used', async () => {
    const service = await createService(createPlugin(storageType));
    await service.addCliplet(item('old', { created: daysAgo(3) }));
    await service.addCliplet(item('new', { created: daysAgo(1) }));
    await service.addCliplet(item('used', { created: daysAgo(5), lastUsed: now() }));
    await service.addCliplet(item('pinned', { created: daysAgo(9), pinned: daysAgo(9) }));
    expect(await ids(service)).toEqual(['pinned', 'used', 'new', 'old']);
  });

  it('finds a cliplet by its decrypted content and skips broken records', async () => {
    const service = await createService(createPlugin(storageType));
    await service.addCliplet(item('broken', { content: 'not-a-ciphertext' }));
    await service.addCliplet(item('a', { content: await service.encrypt('hello') }));
    await service.addCliplet(item('b', { content: await service.encrypt('world') }));

    expect((await service.findClipletByContent('world'))?.id).toBe('b');
    expect(await service.findClipletByContent('missing')).toBeUndefined();
  });

  it('never persists plaintext fields', async () => {
    const plugin = createPlugin(storageType);
    const service = await createService(plugin);
    const withPlaintext = { ...item('a'), decryptedContent: 'SECRET' };
    await service.addCliplet(withPlaintext);
    await service.putCliplet(withPlaintext);

    const stored = storageType === 'json' ? plugin.persisted : await service.getAllCliplets();
    expect(JSON.stringify(stored)).not.toContain('SECRET');
  });

  it('deletes overdue cliplets except protected ones', async () => {
    const service = await createService(createPlugin(storageType));
    await service.addCliplet(item('recent', { created: daysAgo(10) }));
    await service.addCliplet(item('overdue', { created: daysAgo(90) }));
    await service.addCliplet(item('used-recently', { created: daysAgo(90), lastUsed: daysAgo(1) }));
    await service.addCliplet(item('named', { created: daysAgo(90), name: 'n' }));
    await service.addCliplet(item('keyword', { created: daysAgo(90), keyword: 'k' }));
    await service.addCliplet(item('pinned', { created: daysAgo(90), pinned: daysAgo(90) }));

    await service.deleteOverdueRecords(60);
    expect((await ids(service)).sort()).toEqual(
      ['keyword', 'named', 'pinned', 'recent', 'used-recently'].sort(),
    );
  });

  it('keeps only the newest cliplets up to the limit, counting protected ones', async () => {
    const service = await createService(createPlugin(storageType));
    for (let i = 1; i <= 4; i++) {
      await service.addCliplet(item(`c${i}`, { created: daysAgo(10 - i) }));
    }
    await service.addCliplet(item('named', { created: daysAgo(30), name: 'n' }));

    await service.deleteExceededRecords(3);
    expect((await ids(service)).sort()).toEqual(['c3', 'c4', 'named']);
  });
});

describe('ClipletService.switchStorage', () => {
  it('moves cliplets from IndexedDB to data.json', async () => {
    const vaultId = `vault-${vaultCount++}`;
    const plugin = createPlugin('idb');
    const service = await createService(plugin, vaultId);
    await service.addCliplet(item('a'));
    await service.addCliplet(item('b'));

    await service.switchStorage('json');

    expect(plugin.persisted?.storageType).toBe('json');
    expect(plugin.persisted?.cliplets.map(({ id }) => id).sort()).toEqual(['a', 'b']);
    const idbOnly = await createService(createPlugin('idb'), vaultId);
    expect(await ids(idbOnly)).toEqual([]);
  });

  it('moves cliplets from data.json to IndexedDB', async () => {
    const plugin = createPlugin('json', [item('a'), item('b')]);
    const service = await createService(plugin);

    await service.switchStorage('idb');

    expect((await ids(service)).sort()).toEqual(['a', 'b']);
    expect(plugin.persisted).toMatchObject({ storageType: 'idb', cliplets: [] });
  });

  it('keeps the current storage when saving the new type fails', async () => {
    const plugin = createPlugin('idb');
    const service = await createService(plugin);
    await service.addCliplet(item('a'));
    // 1st save: copy to data.json, 2nd save: storage type
    plugin.failOnSave = 2;

    await expect(service.switchStorage('json')).rejects.toThrow();
    expect(plugin.settings.storageType).toBe('idb');
    expect(await ids(service)).toEqual(['a']);
  });

  it('rolls back IndexedDB when copying fails midway', async () => {
    const vaultId = `vault-${vaultCount++}`;
    const existing = await createService(createPlugin('idb'), vaultId);
    await existing.addCliplet(item('stale'));
    // Duplicate ids make the second insert fail inside the transaction.
    const plugin = createPlugin('json', [item('x'), item('x')]);
    const service = await createService(plugin, vaultId);

    await expect(service.switchStorage('idb')).rejects.toThrow();
    expect(await ids(existing)).toEqual(['stale']);
    expect(plugin.settings).toMatchObject({ storageType: 'json' });
    expect(plugin.settings.cliplets).toHaveLength(2);
  });
});
