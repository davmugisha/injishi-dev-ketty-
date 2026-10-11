/**
 * The self check-in draft — three steps, autosaved, and typed to the contract.
 *
 * F-B09 collects four things: document type, document number, an ID photo and
 * an address. The flow that collects them is three screens deep and a `formSheet`
 * away from a camera roll, so **none of it can live in the screen's own state**:
 * `expo-image-picker` backgrounds the app on some Android builds, and a draft
 * held in `useState` is a draft that is gone when the picker comes back. It goes
 * in the fixture store, keyed per booking, exactly as `./booking-draft` does and
 * for the same reason.
 *
 * ## Typed to `@injishi/contracts`, and where it stops
 *
 * `IdentityDocumentInput` is a real contract and this uses it verbatim: a
 * discriminated union where `national_id` pins `issuingCountry` to `RW` and
 * `passport` takes any known country. That is why the country picker disappears
 * when the guest chooses a national ID — the contract says a Rwandan NID is
 * Rwandan by definition, so offering to change it would offer an invalid value.
 *
 * The ADDRESS stops short of its contract, deliberately. `RwandanAddress` wants
 * `provinceId`, `districtId` and `sectorId` — numeric ids from the geography
 * cascade, which is served by `GET /geography/*` and has no fixture in this app.
 * Inventing three ids would be inventing rows that will not match the real
 * table. So the draft keeps the contract's DISCRIMINATOR — Rwanda gets the
 * hierarchy, everywhere else gets one free-form block — and carries the district
 * as the name the guest picked. `toContractAddress` below is the one function
 * that has to change when the cascade lands, and it says so.
 *
 * The photo is a local `file://` uri and nothing is uploaded. F-B09 asks for a
 * resumable upload on poor 4G; that is Phase 3's, and the screen says so rather
 * than pretending.
 */
import { useCallback } from 'react';
import {
  isKnownCountry,
  type AccountDocumentType,
  type InternationalAddress,
} from '@injishi/contracts';
import type { PickedPhoto } from '@/components';
import type { MessageKey } from '@/i18n/i18n';
import { readFixture, useFixtureValue, writeFixture } from './use-fixture-mutation';

/* -------------------------------------------------------------- the shape --- */

/**
 * The two document types that may anchor an account, straight from
 * `registration.ts`. `DocumentType` in the primitives keeps a third value,
 * `other`, for walk-in capture at a desk — a self check-in is not that, and the
 * database enforces the same narrowing with a CHECK on `identity_documents`.
 */
export const DOCUMENT_TYPES: readonly AccountDocumentType[] = ['national_id', 'passport'];

export const DOCUMENT_LABEL: Record<AccountDocumentType, MessageKey> = {
  national_id: 'checkin.docNationalId',
  passport: 'checkin.docPassport',
};

/** Where the draft holds an address before the geography cascade exists. */
export interface DraftAddress {
  /** ISO-3166-1 alpha-2, upper case. `RW` is the discriminator (D24). */
  country: string;
  /** Rwanda: the street line. Elsewhere: unused. */
  street: string;
  /** Rwanda: the district NAME. Becomes `districtId` when the cascade lands. */
  district: string;
  /** Everywhere but Rwanda: the whole address as written locally. */
  addressText: string;
}

export interface CheckInDraft {
  documentType: AccountDocumentType;
  documentNumber: string;
  /** Pinned to `RW` while the type is `national_id`, per the contract. */
  issuingCountry: string;
  photos: readonly PickedPhoto[];
  address: DraftAddress;
  /** The furthest step reached, so backing out and returning lands there. */
  step: number;
}

export const EMPTY_CHECK_IN_DRAFT: CheckInDraft = {
  documentType: 'national_id',
  documentNumber: '',
  issuingCountry: 'RW',
  photos: [],
  address: { country: 'RW', street: '', district: '', addressText: '' },
  step: 0,
};

/** One draft per booking, so two trips in the window keep separate answers. */
export function checkInDraftKey(bookingId: string): string {
  return `checkin.draft:${bookingId}`;
}

export function readCheckInDraft(bookingId: string): CheckInDraft {
  return readFixture<CheckInDraft>(checkInDraftKey(bookingId), EMPTY_CHECK_IN_DRAFT);
}

/* ---------------------------------------------------------- the three steps --- */

export const CHECK_IN_STEPS = ['document', 'photo', 'address'] as const;
export type CheckInStep = (typeof CHECK_IN_STEPS)[number];

export const STEP_LABEL: Record<CheckInStep, MessageKey> = {
  document: 'checkin.stepDocument',
  photo: 'checkin.stepPhoto',
  address: 'checkin.stepAddress',
};

/**
 * A Rwandan National ID is 16 digits, commonly written in spaced groups.
 * Spaces are stripped before checking, because the field is DISPLAYED grouped
 * and a person who types what they see should not be told they are wrong —
 * that rule is `RwandanNationalId`'s own, restated here so the screen can show
 * the error as the guest types rather than only on submit.
 */
export function normaliseDocumentNumber(value: string): string {
  return value.replace(/\s+/g, '');
}

/**
 * Why a step cannot be left, or `null` when it can.
 *
 * A key rather than a sentence, because the caller renders it in the reader's
 * catalogue and this stays pure enough to test without a provider. The design
 * brief's rule is that a disabled control always carries its reason, and this
 * is where every one of those reasons comes from.
 */
export function stepBlockedKey(draft: CheckInDraft, step: CheckInStep): MessageKey | null {
  if (step === 'document') {
    const number = normaliseDocumentNumber(draft.documentNumber);
    if (number.length === 0) return 'checkin.blockedNumberEmpty';
    if (draft.documentType === 'national_id') {
      // 16 digits, and the message names the count rather than saying "invalid".
      if (!/^\d{16}$/.test(number)) return 'checkin.blockedNidShape';
    } else {
      // Loose on alphabet, but no looser than the server: `PassportNumber`
      // takes 6 to 12, and a check-in the API would refuse must not look ready
      // here (ADR-060, now that it is actually sent).
      if (number.length < 6) return 'checkin.blockedPassportShort';
      if (!isKnownCountry(draft.issuingCountry)) return 'checkin.blockedCountry';
    }
    return null;
  }

  if (step === 'photo') {
    return draft.photos.length === 0 ? 'checkin.blockedPhoto' : null;
  }

  if (draft.address.country === 'RW') {
    if (draft.address.street.trim().length === 0) return 'checkin.blockedStreet';
    if (draft.address.district.trim().length === 0) return 'checkin.blockedDistrict';
    return null;
  }
  if (!isKnownCountry(draft.address.country)) return 'checkin.blockedCountry';
  return draft.address.addressText.trim().length === 0 ? 'checkin.blockedAddressText' : null;
}

/** Every step answered. What the last Continue is gated on. */
export function draftComplete(draft: CheckInDraft): boolean {
  return CHECK_IN_STEPS.every((step) => stepBlockedKey(draft, step) === null);
}

/**
 * The address as the wire will want it.
 *
 * **This is the function the geography cascade changes.** The non-Rwandan half
 * is already exactly `InternationalAddress`; the Rwandan half returns the draft
 * shape because there is nothing to resolve `districtId` and `sectorId` against
 * yet. Typed as a union with the draft rather than cast at the call site, so
 * the gap is visible to a reader and to the compiler instead of being a lie
 * that type-checks.
 */
export function toContractAddress(
  address: DraftAddress,
): InternationalAddress | { country: 'RW'; street: string; district: string } {
  if (address.country === 'RW') {
    return { country: 'RW', street: address.street.trim(), district: address.district.trim() };
  }
  return { country: address.country, addressText: address.addressText.trim() };
}

/* --------------------------------------------------------------- the hook --- */

export interface CheckInDraftHandle {
  draft: CheckInDraft;
  /**
   * Merge a patch and save it. Every field on every step calls this on change,
   * which is the whole autosave: there is no Save and nothing to lose.
   */
  patch: (next: Partial<CheckInDraft>) => void;
  setAddress: (next: Partial<DraftAddress>) => void;
  /** Drop the draft. Called once the check-in is committed. */
  clear: () => void;
}

/**
 * Writes through `writeFixture` rather than `useFixtureMutation`, on purpose —
 * the same call `./booking-draft` makes. That hook simulates 300ms so a screen
 * that forgot to disable its button while saving is visibly wrong here rather
 * than on the day the network lands, which is right for a write that becomes an
 * HTTP call. A keystroke is not one: the draft never leaves the device until
 * the guest presses Finish, and putting a third of a second between a character
 * and its appearance would be modelling a call that does not exist.
 */
export function useCheckInDraft(bookingId: string): CheckInDraftHandle {
  const key = checkInDraftKey(bookingId);
  const draft = useFixtureValue<CheckInDraft>(key, () => EMPTY_CHECK_IN_DRAFT);

  const patch = useCallback(
    (next: Partial<CheckInDraft>) => {
      const current = readFixture<CheckInDraft>(key, EMPTY_CHECK_IN_DRAFT);
      const merged = { ...current, ...next };
      // The contract pins a national ID to Rwanda. Enforced on the write rather
      // than in the field, so no path through the screen can leave a passport's
      // country behind on a document that cannot carry one.
      if (merged.documentType === 'national_id') merged.issuingCountry = 'RW';
      writeFixture<CheckInDraft>(key, merged);
    },
    [key],
  );

  const setAddress = useCallback(
    (next: Partial<DraftAddress>) => {
      const current = readFixture<CheckInDraft>(key, EMPTY_CHECK_IN_DRAFT);
      writeFixture<CheckInDraft>(key, {
        ...current,
        address: { ...current.address, ...next },
      });
    },
    [key],
  );

  const clear = useCallback(() => {
    writeFixture<CheckInDraft>(key, EMPTY_CHECK_IN_DRAFT);
  }, [key]);

  return { draft, patch, setAddress, clear };
}
