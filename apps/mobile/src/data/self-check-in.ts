import type { SelfCheckInReceipt } from '@injishi/contracts';

import { api, type ApiCallOptions, type ApiResult } from '../lib/api';
import { ENDPOINTS, type ApiPath } from '../lib/endpoints';
import { uuidV4 } from '../screens/guest/book-format';
import { normaliseDocumentNumber, type CheckInDraft, type DraftAddress } from './check-in';

/**
 * Send a self check-in to the API (F-B09, ADR-038 child 5 AC-G8, ADR-060).
 *
 * TWO CALLS, IN THIS ORDER. The ID photo goes first, as `kind=id_photo`
 * through `POST /api/v1/uploads` (multipart, so `api` sets no content type),
 * and only its key rides in the check-in itself. A poor connection then
 * retries a small JSON body, not the image; the attempt token makes a repeated
 * upload land on the same stored object rather than a second copy.
 *
 * ONLY FOR A REAL BOOKING. The guest's trips on this app are still fixtures
 * (ids like `BK-4821`) until they move onto `GET /me/trips` (ADR-038 child 5);
 * a fixture has no booking on the server to send anything to, so the screen
 * keeps its fixture behaviour for those and calls this for a real one.
 */

/** A booking the server knows is a UUID; a fixture trip's id never is. */
export function isRealBooking(bookingId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);
}

/** The address as one line, the shape `SelfCheckInRequest.addressText` takes. */
export function checkInAddressText(address: DraftAddress): string {
  if (address.country === 'RW') {
    return [address.street.trim(), address.district.trim(), 'Rwanda'].filter(Boolean).join(', ');
  }
  return address.addressText.trim();
}

function mimeFor(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (ext === 'png') return 'image/png';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

type ApiCall = <T>(path: ApiPath, options?: ApiCallOptions) => Promise<ApiResult<T>>;

export async function submitSelfCheckIn(
  bookingId: string,
  draft: CheckInDraft,
  deps: { call?: ApiCall; mintToken?: () => string } = {},
): Promise<ApiResult<SelfCheckInReceipt>> {
  const call = deps.call ?? api;
  const mintToken = deps.mintToken ?? uuidV4;
  const photo = draft.photos[0];
  if (!photo) return { status: 'failed' };

  const filename = photo.uri.split('/').pop() || 'id-photo.jpg';
  const form = new FormData();
  // React Native's FormData takes a `{ uri, name, type }` file part.
  form.append('file', { uri: photo.uri, name: filename, type: mimeFor(filename) } as unknown as Blob);
  form.append('kind', 'id_photo');
  form.append('attemptToken', mintToken());
  const uploaded = await call<{ objectKey: string }>(ENDPOINTS.uploads, {
    method: 'POST',
    formData: form,
    withoutWorkspace: true,
  });
  if (uploaded.status !== 'ok') return uploaded;

  const documentNumber = normaliseDocumentNumber(draft.documentNumber);
  return call<SelfCheckInReceipt>(ENDPOINTS.meBookingCheckIn(bookingId), {
    method: 'POST',
    body: {
      document:
        draft.documentType === 'national_id'
          ? { documentType: 'national_id', documentNumber, issuingCountry: 'RW' }
          : { documentType: 'passport', documentNumber, issuingCountry: draft.issuingCountry },
      idPhotoObjectKey: uploaded.data.objectKey,
      addressText: checkInAddressText(draft.address),
    },
  });
}
