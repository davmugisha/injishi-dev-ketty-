/**
 * `saved` — the Saved tab. Session 6 owns this file.
 *
 * **A new namespace, and why it is not `guest`.** The session prompt names
 * `saved.ts` as this screen's string file, and the six keys that existed on the
 * day it was written (`saved.greeting`, `saved.title`, the empty state, the
 * list label) live in `./guest.ts`, which Session 2 owns and is still editing.
 * Appending a session's keys to another session's file is the merge conflict
 * the one-file-per-namespace split exists to prevent, so the NEW keys land here
 * and the original six stay where they are. Both files prefix `saved.`; the
 * merge in `../messages.ts` is a spread, so the two halves of one prefix are a
 * union rather than a collision, and no key is defined twice.
 *
 * Session 11's audit is the right place to fold the original six in here, once
 * Session 2 has stopped writing to `guest.ts`.
 */

export const en = {
  /* The grid */
  'saved.countOne': '1 stay saved',
  'saved.countMany': '{count} stays saved',

  /* Unsaving, and the way back */
  'saved.removed': 'Removed {title} from saved',
  'saved.undo': 'Undo',
  'saved.restored': '{title} is saved again',
  'saved.undoLabel': 'Undo removing {title} from saved',

  /* A saved property whose listing is no longer published (ADR-032, AC-10) */
  'saved.unavailable': 'Unavailable',
  'saved.unavailableNote':
    'This place is not taking bookings right now. It stays here until you remove it.',
  'saved.unavailableA11y': '{title}, not currently available to book',

  /* States the grid owes its reader */
  'saved.errorLabel': 'your saved stays',
  // A heart pressed offline is queued and sent later, so the note says that
  // rather than that saving stops (mobile audit 2026-10-05, GB-23).
  'saved.offlineNote':
    'Showing the stays that were already loaded. Anything you save or remove now is sent when the connection is back.',

  /* How a heart press ended. Said only once the write has (mobile audit
     2026-10-05: a toast from intent claimed saves that had failed). */
  'saved.toggleFailed': 'That change did not save. Try again.',
  'saved.queuedSave': 'Saved on this phone. It is sent when you are back online.',
  'saved.queuedRemove': 'Removed on this phone. It is sent when you are back online.',
  /* The unit `ListingCard` prints after its own slash: "/ guest / night". */
  'saved.perGuestNight': 'guest / night',
} as const;

/**
 * Parity is a type error here, not a review note: `rw` is keyed off this file's
 * own `en`, so a key added to one and not the other fails `tsc` in this file
 * rather than in the merge.
 */
export const rw: Record<keyof typeof en, string> = {
  'saved.countOne': 'Hantu 1 hazigamye',
  'saved.countMany': 'Hantu {count} hazigamye',

  'saved.removed': '{title} yakuwe mu byabitswe',
  'saved.undo': 'Subiramo',
  'saved.restored': '{title} yongeye kubikwa',
  'saved.undoLabel': 'Subiza {title} mu byabitswe',

  'saved.unavailable': 'Ntibiboneka',
  'saved.unavailableNote':
    'Aha hantu ntihakira abashyitsi ubu. Hazaguma hano kugeza uhakuyeho.',
  'saved.unavailableA11y': '{title}, ntibishoboka kwandika ubu',

  'saved.errorLabel': 'aho wabitse',
  /* English until Kinyarwanda work starts (v1 is English only). */
  'saved.offlineNote': en['saved.offlineNote'],
  'saved.toggleFailed': en['saved.toggleFailed'],
  'saved.queuedSave': en['saved.queuedSave'],
  'saved.queuedRemove': en['saved.queuedRemove'],
  'saved.perGuestNight': en['saved.perGuestNight'],
};
