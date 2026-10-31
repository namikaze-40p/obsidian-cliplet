import dayjs from 'dayjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ClipletService } from 'src/core/cliplet-service';
import { MAXIMUM_RECORDS } from 'src/core/consts';
import { ClipletItem, StorageType } from 'src/core/types';
import Cliplet from 'src/main';
import { Settings } from 'src/settings';

type FakePlugin = {
  storageType: StorageType;
  settings: Pick<Settings, 'cliplets'>;
  persisted: Pick<Settings, 'cliplets'> | null;
  saveCount: number;
  failOnSave: number | null;
  failOnSaveStorageType: boolean;
  saveSettings: () => Promise<void>;
  saveStorageType: (type: StorageType) => void;
};

// Stands in for the plugin: `persisted` is what would be written to data.json,
// and `storageType` is what would be saved on this device.
const createPlugin = (storageType: StorageType, cliplets: ClipletItem[] = []): FakePlugin => ({
  storageType,
  settings: { cliplets: structuredClone(cliplets) },
  persisted: null,
  saveCount: 0,
  failOnSave: null,
  failOnSaveStorageType: false,
  async saveSettings() {
    this.saveCount++;
    if (this.failOnSave === this.saveCount) {
      throw new Error('Failed to write data.json');
    }
    this.persisted = structuredClone(this.settings);
  },
  saveStorageType(type) {
    if (this.failOnSaveStorageType) {
      throw new Error('Failed to save the storage type');
    }
    this.storageType = type;
  },
});

const services: ClipletService[] = [];
let vaultCount = 0;

const createService = async (plugin: FakePlugin, vaultId = `vault-${vaultCount++}`) => {
  const service = new ClipletService(vaultId, plugin as unknown as Cliplet, plugin.storageType);
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
const find = async (service: ClipletService, id: string) =>
  (await service.getAllCliplets()).find((cliplet) => cliplet.id === id);

afterEach(() => {
  services.splice(0).forEach((service) => service.closeDB());
});

describe.each<StorageType>(['idb', 'json'])('ClipletService (%s)', (storageType) => {
  it('adds, gets, updates and deletes cliplets', async () => {
    const service = await createService(createPlugin(storageType));
    await service.addCliplet(item('a'));
    expect((await find(service, 'a'))?.id).toBe('a');

    await service.putCliplet({ ...item('a'), count: 5 });
    expect((await find(service, 'a'))?.count).toBe(5);

    await service.deleteCliplet('a');
    expect(await find(service, 'a')).toBeUndefined();
  });

  it('deletes multiple cliplets at once', async () => {
    const plugin = createPlugin(storageType);
    const service = await createService(plugin);
    for (const id of ['a', 'b', 'c']) {
      await service.addCliplet(item(id));
    }
    const saveCount = plugin.saveCount;

    await service.deleteCliplets(['a', 'c']);

    expect(await ids(service)).toEqual(['b']);
    if (storageType === 'json') {
      expect(plugin.saveCount - saveCount).toBe(1);
    }
  });

  it('gets the latest cliplet by id, or the most recent one when the id is not found', async () => {
    const service = await createService(createPlugin(storageType));
    expect(await service.getLatestCliplet('missing')).toBeUndefined();

    await service.addCliplet(item('old', { created: daysAgo(3) }));
    await service.addCliplet(item('recent', { created: daysAgo(5), lastUsed: daysAgo(1) }));
    await service.addCliplet(item('pinned', { created: daysAgo(9), pinned: daysAgo(9) }));

    expect((await service.getLatestCliplet('old'))?.id).toBe('old');
    // e.g. an id synced from another device whose IndexedDB has different cliplets
    expect((await service.getLatestCliplet('missing'))?.id).toBe('recent');
    expect((await service.getLatestCliplet(''))?.id).toBe('recent');
  });

  it('does not create a cliplet when updating one that does not exist', async () => {
    const service = await createService(createPlugin(storageType));
    await service.putCliplet(item('missing'));
    expect(await ids(service)).toEqual([]);
  });

  it('deletes the data of this device and requires a reload', async () => {
    const vaultId = `vault-${vaultCount++}`;
    const idbService = await createService(createPlugin('idb'), vaultId);
    await idbService.addCliplet(item('in-idb'));
    idbService.closeDB();
    const plugin = createPlugin(storageType, [item('in-json')]);
    const service = await createService(plugin, vaultId);

    await service.deleteDB();

    expect(service.hasDB()).toBe(false);
    // data.json is shared with other devices, so it is cleared only when this device uses it.
    expect(plugin.settings.cliplets.map(({ id }) => id)).toEqual(
      storageType === 'json' ? [] : ['in-json'],
    );
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

  it('decrypts only cliplets whose ciphertext length matches', async () => {
    const service = await createService(createPlugin(storageType));
    await service.addCliplet(item('a', { content: await service.encrypt('hello') }));
    await service.addCliplet(item('b', { content: await service.encrypt('a much longer text') }));
    const decrypt = vi.spyOn(service, 'decrypt');

    // Only "hello" has the same length as "world".
    expect(await service.findClipletByContent('world')).toBeUndefined();
    expect(decrypt).toHaveBeenCalledTimes(1);
  });

  it('adds content as a new cliplet, or marks the duplicate as used', async () => {
    const service = await createService(createPlugin(storageType));

    const added = await service.addContent('hello');
    expect(added.isNew).toBe(true);
    const cliplet = await find(service, added.id);
    expect(cliplet && (await service.decrypt(cliplet.content))).toBe('hello');
    expect(cliplet?.lastUsed).toBe(0);

    const duplicate = await service.addContent('hello');
    expect(duplicate).toEqual({ id: added.id, isNew: false });
    expect(await ids(service)).toEqual([added.id]);
    expect((await find(service, added.id))?.lastUsed).toBeGreaterThan(0);
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

    await service.deleteExceededRecords(3, 1);
    expect((await ids(service)).sort()).toEqual(['c3', 'c4', 'named']);
  });

  describe('when protected cliplets fill the limit', () => {
    const setup = async (protectedCount: number) => {
      const service = await createService(createPlugin(storageType));
      for (let i = 1; i <= protectedCount; i++) {
        await service.addCliplet(item(`named${i}`, { created: daysAgo(30), name: `n${i}` }));
      }
      for (let i = 1; i <= 4; i++) {
        await service.addCliplet(item(`c${i}`, { created: daysAgo(10 - i) }));
      }
      return service;
    };
    const unnamedIds = async (service: ClipletService) =>
      (await ids(service)).filter((id) => id.startsWith('c'));

    it.each([3, 4, 6])(
      'keeps the newest unnamed cliplets up to the minimum (%i protected)',
      async (protectedCount) => {
        const service = await setup(protectedCount);
        await service.deleteExceededRecords(3, 2);
        expect(await unnamedIds(service)).toEqual(['c4', 'c3']);
        expect(await ids(service)).toHaveLength(protectedCount + 2);
      },
    );

    it('keeps a newly added cliplet', async () => {
      const service = await setup(5);
      await service.addCliplet(item('latest'));
      await service.deleteExceededRecords(3, 2);
      expect(await unnamedIds(service)).toEqual(['c4']);
      expect(await find(service, 'latest')).toBeDefined();
    });
  });
});

describe('ClipletService.switchStorage', () => {
  it('merges cliplets from IndexedDB into data.json and clears IndexedDB', async () => {
    const vaultId = `vault-${vaultCount++}`;
    // data.json already holds cliplets of other devices.
    const plugin = createPlugin('idb', [
      item('other'),
      item('newer-in-idb', { created: daysAgo(9), lastUsed: daysAgo(2) }),
      item('newer-in-json', { created: daysAgo(9), lastUsed: daysAgo(1), count: 1 }),
    ]);
    const service = await createService(plugin, vaultId);
    await service.addCliplet(item('a'));
    await service.addCliplet(
      item('newer-in-idb', { created: daysAgo(9), lastUsed: daysAgo(1), count: 2 }),
    );
    await service.addCliplet(
      item('newer-in-json', { created: daysAgo(9), lastUsed: daysAgo(2), count: 3 }),
    );

    await service.switchStorage('json');

    expect(plugin.storageType).toBe('json');
    const persisted = plugin.persisted?.cliplets ?? [];
    expect(persisted.map(({ id }) => id).sort()).toEqual(
      ['a', 'newer-in-idb', 'newer-in-json', 'other'].sort(),
    );
    expect(persisted.find(({ id }) => id === 'newer-in-idb')?.count).toBe(2);
    expect(persisted.find(({ id }) => id === 'newer-in-json')?.count).toBe(1);
    const idbOnly = await createService(createPlugin('idb'), vaultId);
    expect(await ids(idbOnly)).toEqual([]);
  });

  it('copies cliplets from data.json to IndexedDB and keeps them in data.json', async () => {
    const plugin = createPlugin('json', [item('a'), item('b')]);
    const service = await createService(plugin);

    await service.switchStorage('idb');

    expect(plugin.storageType).toBe('idb');
    expect((await ids(service)).sort()).toEqual(['a', 'b']);
    // Other devices may still use data.json.
    expect(plugin.settings.cliplets.map(({ id }) => id)).toEqual(['a', 'b']);
  });

  it('keeps only the newest cliplets up to the limit after merging', async () => {
    const plugin = createPlugin(
      'idb',
      Array.from({ length: MAXIMUM_RECORDS }, (_, i) => item(`json${i}`, { created: daysAgo(2) })),
    );
    const service = await createService(plugin);
    await service.addCliplet(item('idb', { created: daysAgo(1) }));

    await service.switchStorage('json');

    const persisted = plugin.persisted?.cliplets ?? [];
    expect(persisted).toHaveLength(MAXIMUM_RECORDS);
    expect(persisted.some(({ id }) => id === 'idb')).toBe(true);
  });

  it('keeps the current storage when saving the new type fails', async () => {
    const plugin = createPlugin('idb');
    const service = await createService(plugin);
    await service.addCliplet(item('a'));
    plugin.failOnSaveStorageType = true;

    await expect(service.switchStorage('json')).rejects.toThrow();
    expect(plugin.storageType).toBe('idb');
    expect(await ids(service)).toEqual(['a']);
  });

  it('rolls back IndexedDB when copying fails midway', async () => {
    const vaultId = `vault-${vaultCount++}`;
    const existing = await createService(createPlugin('idb'), vaultId);
    await existing.addCliplet(item('stale'));
    // A cliplet without an id makes its insert fail inside the transaction.
    const broken = { ...item('broken'), id: undefined as unknown as string };
    const plugin = createPlugin('json', [item('x'), broken]);
    const service = await createService(plugin, vaultId);

    await expect(service.switchStorage('idb')).rejects.toThrow();
    expect(await ids(existing)).toEqual(['stale']);
    expect(plugin.storageType).toBe('json');
    expect(plugin.settings.cliplets).toHaveLength(2);
  });
});
