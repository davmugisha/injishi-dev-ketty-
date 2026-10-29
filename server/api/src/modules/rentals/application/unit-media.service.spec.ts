import { describe, expect, it, vi } from 'vitest';

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { UnitMediaStorage } from '../../storage/application/unit-media-storage';
import type { UnitMediaRepository, UnitPhotoRow, UnitVideoRow } from '../infrastructure/unit-media.repository';
import type { RentalsAuditWriter } from '../infrastructure/rentals-writers';
import type { UnitListRow, UnitsRepository } from '../infrastructure/units.repository';
import { UnitMediaService } from './unit-media.service';

const WS = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const PROPERTY = '33333333-3333-4333-8333-333333333333';
const UNIT = '44444444-4444-4444-8444-444444444444';
const USER = '77777777-7777-4777-8777-777777777777';

const ws = {
  workspaceId: WS,
  kind: 'business',
  orgId: ORG,
  domain: 'residence',
  orgRole: 'owner',
  registrationStatus: 'active',
  permissions: ['unit.manage'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
} as unknown as ScopedWorkspace;

const photo = (i: number): UnitPhotoRow => ({
  id: `p-${i}`,
  storedObjectId: `o-${i}`,
  objectKey: `unit_photo/2026/10/${i}.jpg`,
  position: i,
  caption: null,
});

const db = { transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => cb({}) };

// The doubles' types are what the test reads back; they are inferred.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(opts: { photos?: UnitPhotoRow[]; state?: string; video?: UnitVideoRow | null; workspaceId?: string } = {}) {
  let photos = [...(opts.photos ?? [])];
  let video = opts.video ?? null;
  const unit = {
    id: UNIT,
    workspaceId: opts.workspaceId ?? WS,
    propertyId: PROPERTY,
    label: 'A-01',
    state: opts.state ?? 'active',
  } as UnitListRow;
  const units = { find: vi.fn(async () => unit) };
  const media = {
    photos: vi.fn(async () => [...photos].sort((a, b) => a.position - b.position)),
    video: vi.fn(async () => video),
    lockUnit: vi.fn(async () => undefined),
    insertPhoto: vi.fn(async (_tx: unknown, v: { storedObjectId: string; position: number }) => {
      const id = `p-new-${photos.length}`;
      photos.push({ id, storedObjectId: v.storedObjectId, objectKey: 'unit_photo/new.jpg', position: v.position, caption: null });
      return id;
    }),
    setPosition: vi.fn(async (_tx: unknown, id: string, position: number) => {
      photos = photos.map((p) => (p.id === id ? { ...p, position } : p));
    }),
    deletePhoto: vi.fn(async (_tx: unknown, id: string) => {
      photos = photos.filter((p) => p.id !== id);
    }),
    upsertVideo: vi.fn(async (_tx: unknown, v: { storedObjectId: string; posterObjectId: string | null; durationS: number }) => {
      video = {
        id: 'v-1',
        storedObjectId: v.storedObjectId,
        objectKey: 'unit_video/new.mp4',
        posterObjectId: v.posterObjectId,
        posterObjectKey: v.posterObjectId ? 'unit_photo/poster.jpg' : null,
        durationS: v.durationS,
        width: null,
        height: null,
        updatedAt: new Date('2026-10-24T10:00:00Z'),
      };
    }),
    deleteVideo: vi.fn(async () => {
      video = null;
    }),
  };
  const storage = {
    putPhoto: vi.fn(async () => ({ id: 'o-new', objectKey: 'unit_photo/new.jpg' })),
    putVideo: vi.fn(async () => ({ id: 'o-video', objectKey: 'unit_video/new.mp4' })),
    remove: vi.fn(async () => undefined),
    signedUrl: vi.fn(async (key: string) => `https://files.test/${key}`),
  };
  const audit = { write: vi.fn(async () => undefined) };
  const service = new UnitMediaService(
    db as never,
    units as unknown as UnitsRepository,
    media as unknown as UnitMediaRepository,
    storage as unknown as UnitMediaStorage,
    audit as unknown as RentalsAuditWriter,
  );
  return { service, media, storage, audit, photos: () => photos };
}

const file = { body: Buffer.from([0xff, 0xd8, 0xff]), filename: 'front.jpg' };

describe('UnitMediaService: photos', () => {
  it('a new photo goes last, and comes back with a link to show it', async () => {
    const h = harness({ photos: [photo(0), photo(1)] });
    const saved = await h.service.addPhoto(ws, USER, UNIT, file);
    expect(saved).toEqual({ id: 'p-new-2', url: 'https://files.test/unit_photo/new.jpg', position: 2, caption: null });
    expect(h.storage.putPhoto).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: WS, uploadedByUserId: USER }));
    expect(h.audit.write).toHaveBeenCalledWith({}, expect.objectContaining({ eventType: 'rental_unit.photo_added' }));
  });

  it('a unit with 20 photos takes no more, and nothing is stored', async () => {
    const h = harness({ photos: Array.from({ length: 20 }, (_, i) => photo(i)) });
    await expect(h.service.addPhoto(ws, USER, UNIT, file)).rejects.toThrow('the most it can hold');
    expect(h.storage.putPhoto).not.toHaveBeenCalled();
  });

  it('when saving the row fails the stored photo is removed', async () => {
    const h = harness();
    h.media.insertPhoto.mockRejectedValueOnce(new Error('down'));
    await expect(h.service.addPhoto(ws, USER, UNIT, file)).rejects.toThrow('down');
    expect(h.storage.remove).toHaveBeenCalledWith(['o-new']);
  });

  it('a retired unit or another business’s unit takes no photo', async () => {
    await expect(harness({ state: 'retired' }).service.addPhoto(ws, USER, UNIT, file)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      harness({ workspaceId: '99999999-9999-4999-8999-999999999999' }).service.addPhoto(ws, USER, UNIT, file),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reorders by the full list, the first becoming the cover', async () => {
    const h = harness({ photos: [photo(0), photo(1), photo(2)] });
    const view = await h.service.reorderPhotos(ws, USER, UNIT, ['p-2', 'p-0', 'p-1']);
    expect(view.photos.map((p) => [p.id, p.position])).toEqual([
      ['p-2', 0],
      ['p-0', 1],
      ['p-1', 2],
    ]);
  });

  it('a reorder that misses a photo is refused', async () => {
    const h = harness({ photos: [photo(0), photo(1)] });
    await expect(h.service.reorderPhotos(ws, USER, UNIT, ['p-1'])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removing a photo closes the gap and removes the object after', async () => {
    const h = harness({ photos: [photo(0), photo(1), photo(2)] });
    const view = await h.service.removePhoto(ws, USER, UNIT, 'p-0');
    expect(view.photos.map((p) => [p.id, p.position])).toEqual([
      ['p-1', 0],
      ['p-2', 1],
    ]);
    expect(h.storage.remove).toHaveBeenCalledWith(['o-0']);
  });
});

describe('UnitMediaService: the video tour', () => {
  const staged = { path: '/tmp/x.part', sizeBytes: 2_000_000, mime: 'video/mp4' as const };

  it('replacing the video removes the old one and its poster', async () => {
    const before: UnitVideoRow = {
      id: 'v-0',
      storedObjectId: 'o-old',
      objectKey: 'unit_video/old.mp4',
      posterObjectId: 'o-old-poster',
      posterObjectKey: 'unit_photo/old.jpg',
      durationS: 30,
      width: null,
      height: null,
      updatedAt: new Date(),
    };
    const h = harness({ video: before });
    const saved = await h.service.setVideo(ws, USER, UNIT, {
      staged,
      filename: 'tour.mp4',
      poster: file,
      fields: { durationS: 42 },
    });
    expect(saved).toMatchObject({ url: 'https://files.test/unit_video/new.mp4', durationS: 42 });
    expect(h.storage.remove).toHaveBeenCalledWith(['o-old', 'o-old-poster']);
    expect(h.audit.write).toHaveBeenCalledWith({}, expect.objectContaining({ eventType: 'rental_unit.video_replaced' }));
  });

  it('when saving fails, what was stored for it is removed', async () => {
    const h = harness();
    h.media.upsertVideo.mockRejectedValueOnce(new Error('down'));
    await expect(
      h.service.setVideo(ws, USER, UNIT, { staged, filename: 'tour.mp4', poster: file, fields: { durationS: 42 } }),
    ).rejects.toThrow('down');
    expect(h.storage.remove).toHaveBeenCalledWith(['o-new', 'o-video']);
  });
});
