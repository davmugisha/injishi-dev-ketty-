import type { ApiCallOptions, ApiResult } from '../lib/api';
import type { ApiPath } from '../lib/endpoints';
import { EMPTY_CHECK_IN_DRAFT, type CheckInDraft } from './check-in';
import { checkInAddressText, isRealBooking, submitSelfCheckIn } from './self-check-in';

/**
 * What the check-in screen sends for a real booking (ADR-060): the ID photo as
 * an `id_photo` upload, then the check-in naming its key. Proved against a fake
 * `api` so the test reads exactly what would go over the wire.
 */

const BOOKING = '3f2b8c1a-9d4e-4b7a-8c2d-1e5f6a7b8c9d';

const draft: CheckInDraft = {
  ...EMPTY_CHECK_IN_DRAFT,
  documentType: 'national_id',
  documentNumber: '1 1990 8 0012345 12 3',
  photos: [{ uri: 'file:///cache/id-front.jpg', width: 1200, height: 800 }],
  address: { country: 'RW', street: 'KG 11 Ave', district: 'Gasabo', addressText: '' },
};

function fakeApi(uploadAnswer: ApiResult<{ objectKey: string }>) {
  const calls: { path: string; options?: ApiCallOptions }[] = [];
  const call = async <T,>(path: ApiPath, options?: ApiCallOptions): Promise<ApiResult<T>> => {
    calls.push({ path, options });
    if (path.endsWith('/uploads')) return uploadAnswer as unknown as ApiResult<T>;
    return { status: 'ok', data: { bookingId: BOOKING, submittedAt: 'now', idPhotoStored: true } as unknown as T };
  };
  return { calls, call };
}

describe('isRealBooking', () => {
  it('knows a server booking from a fixture trip', () => {
    expect(isRealBooking(BOOKING)).toBe(true);
    expect(isRealBooking('BK-4821')).toBe(false);
  });
});

describe('checkInAddressText', () => {
  it('writes a Rwandan address as one line, and passes a foreign one through', () => {
    expect(checkInAddressText(draft.address)).toBe('KG 11 Ave, Gasabo, Rwanda');
    expect(checkInAddressText({ country: 'KE', street: '', district: '', addressText: '12 Moi Ave, Nairobi' })).toBe(
      '12 Moi Ave, Nairobi',
    );
  });
});

describe('submitSelfCheckIn', () => {
  it('uploads the photo as an id_photo first, then sends the check-in naming its key', async () => {
    const { calls, call } = fakeApi({ status: 'ok', data: { objectKey: 'id_photo/abc.jpg' } });
    const result = await submitSelfCheckIn(BOOKING, draft, { call, mintToken: () => 'token-1' });

    expect(result.status).toBe('ok');
    expect(calls).toHaveLength(2);
    expect(calls[0]!.path).toMatch(/\/uploads$/);
    expect(calls[1]!.path).toMatch(new RegExp(`/me/bookings/${BOOKING}/check-in$`));

    const form = calls[0]!.options!.formData as unknown as { _parts?: [string, unknown][]; get?: (k: string) => unknown };
    const field = (k: string) => (form.get ? form.get(k) : form._parts?.find(([name]) => name === k)?.[1]);
    expect(field('kind')).toBe('id_photo');
    expect(field('attemptToken')).toBe('token-1');

    expect(calls[1]!.options).toMatchObject({
      method: 'POST',
      body: {
        document: { documentType: 'national_id', documentNumber: '1199080012345123', issuingCountry: 'RW' },
        idPhotoObjectKey: 'id_photo/abc.jpg',
        addressText: 'KG 11 Ave, Gasabo, Rwanda',
      },
    });
  });

  it('never sends the check-in when the photo did not upload', async () => {
    const { calls, call } = fakeApi({ status: 'failed' });
    const result = await submitSelfCheckIn(BOOKING, draft, { call, mintToken: () => 'token-2' });
    expect(result.status).toBe('failed');
    expect(calls).toHaveLength(1);
  });

  it('refuses to send without a photo', async () => {
    const { calls, call } = fakeApi({ status: 'ok', data: { objectKey: 'x' } });
    const result = await submitSelfCheckIn(BOOKING, { ...draft, photos: [] }, { call });
    expect(result.status).toBe('failed');
    expect(calls).toHaveLength(0);
  });
});
