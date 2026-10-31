import { describe, expect, it } from 'vitest';

import { DataFile } from 'src/core/data-file';
import { ClipletItem } from 'src/core/types';

type Data = { cliplets: ClipletItem[]; latestClipletId: string };

const cliplet = (id: string) => ({ id }) as ClipletItem;

// `disk` stands in for data.json; loading and saving it take a moment, like real file I/O.
const createDataFile = (disk: { data: unknown; failOnSave?: boolean }) =>
  new DataFile<Data>(
    async () => {
      await Promise.resolve();
      return structuredClone(disk.data);
    },
    async (data) => {
      await Promise.resolve();
      if (disk.failOnSave) {
        throw new Error('Failed to write data.json');
      }
      disk.data = structuredClone(data);
    },
  );

describe('DataFile', () => {
  it('saves the settings with the cliplets in data.json', async () => {
    const disk = { data: { cliplets: [cliplet('remote')], latestClipletId: '' } };
    const settings: Data = { cliplets: [cliplet('stale')], latestClipletId: 'a' };

    const cliplets = await createDataFile(disk).write(settings);

    expect(disk.data).toEqual({ cliplets: [cliplet('remote')], latestClipletId: 'a' });
    expect(cliplets).toEqual([cliplet('remote')]);
  });

  it('applies the change to the cliplets in data.json', async () => {
    const disk = { data: { cliplets: [cliplet('remote')], latestClipletId: '' } };
    const settings: Data = { cliplets: [], latestClipletId: '' };

    await createDataFile(disk).write(settings, (cliplets) => [...cliplets, cliplet('a')]);

    expect(disk.data).toMatchObject({ cliplets: [cliplet('remote'), cliplet('a')] });
  });

  it.each([null, {}, { cliplets: 'broken' }])('treats %j as no cliplets', async (data) => {
    const disk = { data };
    const settings: Data = { cliplets: [cliplet('stale')], latestClipletId: '' };

    expect(await createDataFile(disk).write(settings)).toEqual([]);
  });

  it('writes one at a time, so that concurrent changes are all kept', async () => {
    const disk = { data: { cliplets: [cliplet('a'), cliplet('b')], latestClipletId: '' } };
    const dataFile = createDataFile(disk);
    const settings: Data = { cliplets: [], latestClipletId: '' };

    await Promise.all([
      dataFile.write(settings, (cliplets) => cliplets.filter(({ id }) => id !== 'a')),
      dataFile.write(settings, (cliplets) => cliplets.filter(({ id }) => id !== 'b')),
    ]);

    expect(disk.data).toMatchObject({ cliplets: [] });
  });

  it('keeps writing after a failed write', async () => {
    const disk = { data: { cliplets: [], latestClipletId: '' }, failOnSave: true };
    const dataFile = createDataFile(disk);
    const settings: Data = { cliplets: [], latestClipletId: 'a' };

    await expect(dataFile.write(settings)).rejects.toThrow();
    disk.failOnSave = false;
    await dataFile.write(settings);

    expect(disk.data).toMatchObject({ latestClipletId: 'a' });
  });
});
