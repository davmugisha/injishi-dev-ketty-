import { describe, expect, it } from 'vitest';

import { ExploreCursorError, decodeCursor, encodeCursor } from './explore-cursor';

const ID = '7f2c1a90-3b4d-4e5f-8a6b-1c2d3e4f5a6b';
const stays = { mode: 'stays', area: { kind: 'all' as const } };

describe('explore cursor (mobile spec 0005, D-as)', () => {
  it('round trips a top rated key and the frozen mean exactly', () => {
    const cursor = encodeCursor({
      mean: '4.312500',
      key: { sort: 'top_rated', score: '4.312500000', name: 'isangano lakeside', id: ID },
      filters: stays,
    });
    expect(decodeCursor(cursor, { sort: 'top_rated', filters: stays })).toEqual({
      mean: '4.312500',
      key: { sort: 'top_rated', score: '4.312500000', name: 'isangano lakeside', id: ID },
    });
  });

  it('round trips a price key, an unpriced one included', () => {
    for (const price of [140000, null]) {
      const cursor = encodeCursor({ mean: '0', key: { sort: 'price_desc', price, name: 'a', id: ID }, filters: stays });
      expect(decodeCursor(cursor, { sort: 'price_desc', filters: stays }).key).toEqual({
        sort: 'price_desc',
        price,
        name: 'a',
        id: ID,
      });
    }
  });

  it('refuses a cursor made for another search or another sort', () => {
    const cursor = encodeCursor({ mean: '0', key: { sort: 'price_asc', price: 1, name: 'a', id: ID }, filters: stays });
    expect(() => decodeCursor(cursor, { sort: 'price_desc', filters: stays })).toThrow(ExploreCursorError);
    expect(() =>
      decodeCursor(cursor, { sort: 'price_asc', filters: { mode: 'stays', area: { kind: 'text', text: 'kivu' } } }),
    ).toThrow(ExploreCursorError);
    expect(() => decodeCursor(cursor, { sort: 'price_asc', filters: { mode: 'homes', area: { kind: 'all' } } })).toThrow(
      ExploreCursorError,
    );
  });

  it('refuses anything that is not one of its own', () => {
    for (const bad of ['', 'not-base64!', Buffer.from('{"v":2}').toString('base64url'), Buffer.from('[]').toString('base64url')]) {
      expect(() => decodeCursor(bad, { sort: 'top_rated', filters: stays })).toThrow(ExploreCursorError);
    }
  });

  it('refuses a top rated key whose score is not a number, or a price that is not whole', () => {
    const forge = (k: unknown[], s = 'top_rated'): string => {
      const good = encodeCursor({ mean: '0', key: { sort: 'top_rated', score: '1', name: 'a', id: ID }, filters: stays });
      const payload = JSON.parse(Buffer.from(good, 'base64url').toString('utf8'));
      return Buffer.from(JSON.stringify({ ...payload, s, k }), 'utf8').toString('base64url');
    };
    expect(() => decodeCursor(forge(["1; drop table", 'a', ID]), { sort: 'top_rated', filters: stays })).toThrow(
      ExploreCursorError,
    );
    expect(() => decodeCursor(forge([1.5, 'a', ID], 'price_asc'), { sort: 'price_asc', filters: stays })).toThrow(
      ExploreCursorError,
    );
  });
});
