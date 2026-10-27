import { RegistrationDraft } from "@injishi/contracts";

/**
 * The registration's device copy (ADR-075 S9, AC-9): the wizard's answers kept
 * in this browser as well as on the server, so typing goes on with no
 * connection and nothing typed is lost before the server has it.
 *
 * - BOUND TO ONE PERSON: the key carries the signed in user's id, and the
 *   wizard reads only its own person's key.
 * - GONE AT SIGN OUT: `lib/session.ts` deletes every copy when a sign out is
 *   made here, and whenever the API answers that nobody is signed in, which is
 *   where every other way of signing out lands. A person opening the wizard
 *   deletes anyone else's copy on this browser too.
 * - GONE ON SUBMIT: the wizard deletes it once the fee settles, as the server
 *   deletes its draft (D-m).
 * - NEVER AN ID NUMBER OR A PHOTO: it is written only when it passes the same
 *   `RegistrationDraft` contract the server holds the draft to, which refuses
 *   both.
 *
 * `pending` says the server has not acknowledged this copy yet. `basedOn` is
 * the server's `savedAt` this copy last agreed with, so a copy made offline
 * wins on return only if the server has not moved on since, from another
 * device (`chooseDraft`).
 *
 * No React here, so `tests/register-device-copy.test.mjs` runs it as it is.
 */

const PREFIX = "injishi:register-draft:";

export interface DeviceCopy {
  draft: RegistrationDraft;
  pending: boolean;
  basedOn: string | null;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // A browser that refuses storage altogether (some private modes) has no copy to keep.
    return null;
  }
}

/** This person's copy, or null when there is none or it no longer reads. */
export function readDeviceCopy(userId: string): DeviceCopy | null {
  const raw = storage()?.getItem(PREFIX + userId);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { draft?: unknown; pending?: unknown; basedOn?: unknown };
    const draft = RegistrationDraft.safeParse(value.draft);
    if (!draft.success) return null;
    return {
      draft: draft.data,
      pending: value.pending === true,
      basedOn: typeof value.basedOn === "string" ? value.basedOn : null,
    };
  } catch {
    return null;
  }
}

/**
 * Keep the copy. False when it was not kept: the contract refused the draft, or
 * the browser would not store it (storage full or switched off), so the screen
 * never claims it was saved on this phone when it was not.
 */
export function writeDeviceCopy(userId: string, copy: DeviceCopy): boolean {
  const store = storage();
  if (!store || !RegistrationDraft.safeParse(copy.draft).success) return false;
  try {
    store.setItem(PREFIX + userId, JSON.stringify(copy));
    return true;
  } catch {
    return false;
  }
}

export function clearDeviceCopy(userId: string): void {
  try {
    storage()?.removeItem(PREFIX + userId);
  } catch {
    // Nothing kept, nothing to clear.
  }
}

/** Every person's copy on this browser, or every one but `keep`'s. */
export function clearDeviceCopies(keep?: string): void {
  const store = storage();
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX) && key !== (keep ? PREFIX + keep : null)) keys.push(key);
    }
    for (const key of keys) store.removeItem(key);
  } catch {
    // As above.
  }
}

/**
 * Which answers reopen the wizard: the server's, or this browser's copy.
 *
 * - A copy the server has not acknowledged (`pending`) wins while the server
 *   is still where the copy left it (`basedOn` is its `savedAt`, or it holds
 *   nothing), and is sent on. That is typing done offline, or in the moment
 *   before the tab closed.
 * - Otherwise the server's answers win: it may have moved on from another
 *   device, and a copy that was acknowledged has nothing the server lacks.
 * - A copy left when the server holds nothing and nothing is pending belongs
 *   to a draft that is gone (its fee settled, or another device started over),
 *   so it is dropped.
 */
export function chooseDraft(
  server: { draft: RegistrationDraft | null; savedAt: string | null },
  device: DeviceCopy | null,
): { draft: RegistrationDraft | null; from: "server" | "device" | "none"; push: boolean; dropDevice: boolean } {
  if (device?.pending && (server.draft === null || server.savedAt === device.basedOn)) {
    return { draft: device.draft, from: "device", push: true, dropDevice: false };
  }
  if (server.draft) return { draft: server.draft, from: "server", push: false, dropDevice: false };
  return { draft: null, from: "none", push: false, dropDevice: device !== null };
}
