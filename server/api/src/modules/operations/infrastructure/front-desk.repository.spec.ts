import { isOpenStayCollision } from './front-desk.repository';

describe('isOpenStayCollision', () => {
  const collision = { code: '23505', constraint: 'guest_stays_one_open_per_room_uk' };

  it('recognises the one-open-stay-per-room index, raw or wrapped by drizzle', () => {
    expect(isOpenStayCollision(collision)).toBe(true);
    expect(isOpenStayCollision(Object.assign(new Error('Failed query'), { cause: collision }))).toBe(true);
  });

  it('does not swallow any other unique violation or error', () => {
    expect(isOpenStayCollision({ code: '23505', constraint: 'guest_stays_claim_code_uk' })).toBe(false);
    expect(isOpenStayCollision({ code: '23503', constraint: 'guest_stays_one_open_per_room_uk' })).toBe(false);
    expect(isOpenStayCollision(new Error('boom'))).toBe(false);
    expect(isOpenStayCollision(undefined)).toBe(false);
  });
});
