/**
 * Who is holding the phone, from the server rather than from a constant.
 *
 * `GET /api/v1/me/profile` already existed and this app had never called it.
 * `src/data/personas.ts` says so in as many words — "`ME` survives, and only
 * until ADR-038 child 4 replaces it with `GET /me/profile`" — so this is that
 * replacement for the READ half, and the read half only. See the note on
 * `PUT /me/profile` at the bottom of this file for why the write is not here.
 *
 * ## The placeholder is nobody
 *
 * It used to be `ME`, the fixture persona, and that put a stranger's name and
 * phone number on every account the server had no name for: every new account
 * (Step 1 unanswered, `fullName: null`), the load window, and any failed read
 * (mobile audit 2026-10-05, SA-01). A placeholder that names a real looking
 * person is a fabricated fact about whoever is holding the phone. So it is now
 * empty, and `fromServer` and `pending` tell a caller which of three things it
 * holds: a name, a read still in flight (draw a skeleton), or an account with
 * no name on file (draw `identity.unnamed`, never a guess).
 *
 * ## Person scoped, so no workspace header
 *
 * The path starts with `/me/`, which is exactly what `isPersonScoped()` in
 * `lib/api.ts` looks for, so `x-workspace-id` is left off and `WorkspaceGuard`
 * never runs. Your own name does not belong to a workspace, and asking for it
 * under one would make it look as though it did.
 */
import type { MyProfile } from '@injishi/contracts';
import { useQuery } from '@tanstack/react-query';

import { api, unwrap } from '../lib/api';
import { ENDPOINTS } from '../lib/endpoints';
import { meKeys } from '../lib/query-keys';
import { useOptionalSession } from '../session';

/** The caller's own Step 1 answers. Every field is nullable on a new account. */
export function fetchMyProfile(signal?: AbortSignal): Promise<MyProfile> {
  return unwrap(api<MyProfile>(ENDPOINTS.meProfile, { signal }));
}

/**
 * `+250788431209` → `+250 788 431 209`.
 *
 * Presentation, not data. The wire carries E.164 with no spaces (the contract
 * calls the field `phoneE164`) and must keep doing so — a space in a stored
 * number is a number that stops matching itself. The fixture prints the spaced
 * form, so grouping here is what keeps a real number and the placeholder from
 * looking like two different kinds of thing on the same screen.
 *
 * Only the Rwandan shape is grouped, because it is the only one whose grouping
 * this app can claim to know. Anything else is returned untouched rather than
 * chopped into threes, which is how a Kenyan or French number ends up printed
 * in groups its own country does not use.
 */
export function formatPhone(e164: string): string {
  const digits = e164.trim();
  const rwandan = /^\+250(\d{3})(\d{3})(\d{3})$/.exec(digits);
  return rwandan ? `+250 ${rwandan[1]} ${rwandan[2]} ${rwandan[3]}` : digits;
}

/** `Samuel Kayitare` → `SK`, for an avatar that has no photograph. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

export interface MyIdentity {
  name: string;
  initials: string;
  phone: string;
  /**
   * True only when the server answered AND had a name on file.
   *
   * A brand new account has `fullName: null` — Step 1 is unanswered — and that
   * is NOT a server-sourced identity. When this is false, `name`, `initials` and
   * `phone` are empty strings: a caller draws a skeleton while `pending`, and
   * `identity.unnamed` once it is not. It never prints a name of its own.
   */
  fromServer: boolean;
  /** The profile read has not answered yet. Draw a skeleton, not "unnamed". */
  pending: boolean;
}

/**
 * What the app holds before the server has answered, where it has no session,
 * and for an account with no name on file. Deliberately nobody: see the module
 * header for why this is not the fixture persona any more.
 */
export const PLACEHOLDER_IDENTITY: MyIdentity = {
  name: '',
  initials: '',
  phone: '',
  fromServer: false,
  pending: false,
};

/**
 * The person this device is signed in as.
 *
 * Gated on the session, through the OPTIONAL hook: a `/me/` call made by
 * somebody who is not signed in earns a 401, and a 401 anywhere clears the
 * token and flips the tree to anonymous (`session.tsx`). So firing this from
 * the sign-in screen — or from a screen test with no provider stack — would
 * sign a person out for the crime of looking at the app.
 *
 * `staleTime` is long because a person's own name does not change while they
 * are looking at it, and a round trip in front of every visit to Account buys
 * nothing.
 */
export function useMyIdentity(): MyIdentity {
  const session = useOptionalSession();
  const enabled = session?.status === 'authenticated';

  const { data, isPending } = useQuery({
    queryKey: meKeys.profile(),
    queryFn: ({ signal }) => fetchMyProfile(signal),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  // A disabled query reports `isPending` forever, so only an ENABLED one that
  // has not answered is a read in flight. A failed read is not pending: it is
  // an account whose name we do not know, and says so.
  return toIdentity(data, enabled && isPending);
}

/**
 * The server's profile as the screens need it, or the placeholder.
 *
 * Exported so it can be tested without a React tree — the mapping is where the
 * null handling lives, and null handling is the whole of the risk here.
 */
export function toIdentity(profile: MyProfile | undefined, pending = false): MyIdentity {
  const name = profile?.fullName?.trim();
  if (!name) {
    // Either we have not asked yet, or Step 1 is unanswered. Both mean the
    // same thing on screen: we do not know this person's name. A phone number
    // on its own under a blank line is not an improvement on the placeholder.
    return pending ? { ...PLACEHOLDER_IDENTITY, pending: true } : PLACEHOLDER_IDENTITY;
  }

  const phone = profile?.phoneE164?.trim();
  return {
    name,
    initials: initialsOf(name),
    // A real name beside a placeholder phone number would be a fabricated fact
    // about a real person, so an absent number reads as absent.
    phone: phone ? formatPhone(phone) : '',
    fromServer: true,
    pending: false,
  };
}

/**
 * There is deliberately no `saveMyProfile()` here, and that is a limit rather
 * than an oversight.
 *
 * `PUT /api/v1/me/profile` takes `PersonalDetails`, which is the WHOLE Step 1
 * block — full name, gender, date of birth, phone, identity document and
 * address — and it replaces rather than merges, on purpose: "a person
 * correcting their document type must not be left holding half of the old
 * answer" (`me.controller.ts`). The Personal details screen in this app
 * collects a name and an email and nothing else, so a PUT built from what it
 * holds would erase the caller's stored identity document and address.
 *
 * Editing therefore stays local until this app grows the rest of Step 1. See
 * `screens/account/personal-details.tsx`, which says the same thing where the
 * edit is.
 */
