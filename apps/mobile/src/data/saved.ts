/**
 * The saved set — one store, three screens.
 *
 * Explore (Session 2), this Property detail page (Session 3) and the Saved tab
 * (Session 6) all write the same heart, and a heart that keeps its own state is
 * a heart that disagrees with the Saved tab the moment you navigate. So the
 * truth lives in the fixture store `useFixtureMutation` owns, keyed once here,
 * and every screen reads it through this hook. **A later session must import
 * this rather than build a second one.**
 *
 * The shape is ADR-032's `/me/saved` seam: a flat set of property ids. The
 * screen knows about saved properties; the database knows about collections.
 * That is the whole reason the swap to TanStack Query is a hook change — the
 * value this hook returns is the value the endpoint returns.
 *
 * **The write is optimistic, and that is the point of the extra ten lines.**
 * `useFixtureMutation` simulates 300ms so a screen that forgot to disable its
 * button while saving is visibly wrong here rather than on the day the network
 * arrives. A heart is the one control where that would be a lie in the other
 * direction: nobody waits a third of a second to watch a heart fill, and every
 * real client flips it immediately and reconciles after. So `toggle` records
 * the intended value locally, fires the mutation, and drops the local record
 * once the store agrees — which is exactly what `onMutate` will do when this
 * becomes `useMutation`.
 *
 * **The heart is optimistic; the words are not.** The toast that names what
 * happened used to be picked from the INTENT, the instant the heart was
 * pressed, so a save that failed still said "Saved". `toggle` now hands back a
 * promise of how the write ended, and a failed one drops the optimistic record
 * so the heart goes back to the truth (mobile audit 2026-10-05, brief item 1).
 */
import { useCallback, useState } from 'react';
import {
  readFixture,
  useFixtureMutation,
  useFixtureValue,
  writeFixture,
  type MutationOutcome,
} from './use-fixture-mutation';
import { useOfflineSubmit } from './offline-submit';
import type { WriteOutcome } from './write-queue';

/** The fixture key. Also the shape of the endpoint that replaces it. */
export const SAVED_KEY = 'guest.saved';

/**
 * What a fresh launch already has saved. **Added by Session 6, and it had to
 * be.**
 *
 * The set used to start empty, which made the Saved tab a permanent empty state
 * until someone went and tapped a heart. Two things were wrong with that. The
 * smaller one is that every other fixture in this app is seeded — trips,
 * tenancies, tickets, leases — so Saved was the one tab that opened with
 * nothing in it, and the runbook's quality bar names a screen with no content
 * as not done.
 *
 * The larger one is that ADR-032's AC-10, the unavailable card, was
 * **unreachable**. A saved property whose listing is unpublished has to render
 * as unavailable rather than disappear, and the only property in the catalogue
 * with `active: false` is `virunga-tea-retreat` — which Explore correctly never
 * lists, because `EXPLORABLE_STAYS` filters it. So there was no sequence of
 * taps that could produce the state the ADR requires, and the branch could
 * never have been seen by anyone. It is seeded here instead.
 *
 * Order is the order they were saved, oldest first; the Saved grid reverses it,
 * because `collection_items.created_at` descending is the ADR's ordering.
 *
 * `kivu-sunbird-suite`, `kigali-cbd-loft` and `musanze-volcano-cabin` are
 * deliberately NOT here: `./saved.test.tsx` toggles them, and a seeded id would
 * turn each of those saves into an unsave.
 */
export const SEEDED_SAVED: readonly string[] = [
  'akagera-tented-camp',
  'nyamirambo-townhouse',
  // The unpublished one. See above: without it, AC-10 has no fixture.
  'virunga-tea-retreat',
  'karongi-lake-house',
  'lavender-hill-apartment',
];

/**
 * How one heart press ended. `queued` is a press made offline: it is in the
 * write queue and is sent when the connection is back, so it is neither done
 * nor failed yet, and a screen says exactly that.
 */
export type SaveOutcome = MutationOutcome | 'queued';

export interface SaveToggle {
  /** The state the heart moved to, at once. */
  next: boolean;
  /** How the write ended. Pick the words from this, never from `next` alone. */
  settled: Promise<SaveOutcome>;
}

export interface SavedStays {
  /** Property ids, in the order they were saved. */
  ids: readonly string[];
  isSaved: (propertyId: string) => boolean;
  /** Flips the heart now and reports how the write ended. See the header. */
  toggle: (propertyId: string) => SaveToggle;
  /** `saving` while a write is in flight, for a screen that shows progress. */
  status: ReturnType<typeof useFixtureMutation<string[], Toggle>>['status'];
}

interface Toggle {
  propertyId: string;
  next: boolean;
}

/** A fresh copy each time: the store must never be handed the shared array. */
function seed(): string[] {
  return [...SEEDED_SAVED];
}

function applyToggle(current: string[], { propertyId, next }: Toggle): string[] {
  const without = current.filter((id) => id !== propertyId);
  return next ? [...without, propertyId] : without;
}

/**
 * The `save` write. Module level so `write-handlers.ts` can register it before
 * any screen mounts, which is what a drain after a cold start needs.
 */
export function saveToggleHandler(toggleInput: Toggle): WriteOutcome {
  writeFixture<string[]>(SAVED_KEY, applyToggle(readFixture<string[]>(SAVED_KEY, seed()), toggleInput));
  // The fixture store cannot refuse and cannot be unreachable, so this
  // is always `ok`. The surface child that puts a real mutation here
  // (ADR-038 children 1 to 7) is where `refused` and `failed` start
  // being answered for real.
  return { status: 'ok' };
}

export function useSavedStays(): SavedStays {
  const stored = useFixtureValue<string[]>(SAVED_KEY, seed);
  const { mutate, status } = useFixtureMutation<string[], Toggle>(SAVED_KEY, applyToggle, seed);

  /**
   * The offline half (gaps.md §7's fourth queued action).
   *
   * ADR-032 already specifies optimistic-with-rollback here and the optimism
   * below implements it. What it could not do is survive: a heart pressed with
   * no signal rolled back and the stay was not saved, which on a browse surface
   * reads as the app losing a tap. The queue keeps the intent and replays it.
   *
   * The property id is the idempotency key, so pressing the heart twice while
   * offline is one intent rather than two — and the second press correctly
   * REPLACES nothing, because the queue returns the item already there. A
   * saved-then-unsaved pair offline settles as saved, which is the honest
   * reading of "the last thing the person asked for that we could not send".
   */
  const queued = useOfflineSubmit<Toggle>({
    kind: 'save',
    handler: saveToggleHandler,
    label: (toggleInput) => toggleInput.propertyId,
    idFor: (toggleInput) => `save-${toggleInput.propertyId}`,
  });

  // What the reader has just asked for, until the store says the same thing.
  // Keyed by id rather than held as a whole list so two hearts pressed in
  // quick succession do not overwrite each other's intent.
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const isSaved = useCallback(
    (propertyId: string) => pending[propertyId] ?? stored.includes(propertyId),
    [pending, stored],
  );

  const toggle = useCallback(
    (propertyId: string): SaveToggle => {
      const next = !isSaved(propertyId);
      setPending((now) => ({ ...now, [propertyId]: next }));
      if (queued.offline) {
        void queued.submit({ propertyId, next });
        return { next, settled: Promise.resolve<SaveOutcome>('queued') };
      }
      const settled = mutate({ propertyId, next }).then((outcome) => {
        // Either way the store is the truth again, so the local record goes:
        // after a landed write the store now says `next`, and after a failed
        // one it still says what it said before, which rolls the heart back
        // rather than leaving a save on screen that never happened.
        setPending((now) => {
          const { [propertyId]: _settled, ...rest } = now;
          return rest;
        });
        return outcome;
      });
      return { next, settled };
    },
    [isSaved, mutate, queued],
  );

  return { ids: stored, isSaved, toggle, status };
}
