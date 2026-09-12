/**
 * Every registered-but-unbuilt route, in one place.
 *
 * Session 0 pre-registers the whole route map so the tab bar is complete on day
 * one and a tap never dead-ends. Rather than repeat a frame id and a session
 * number across forty route files, each of those files renders `<Stub id="…" />`
 * and the facts live here — which also means a reviewer can read the whole
 * "what is not built yet" list without opening forty files, and Session 12 has
 * one file to check as it empties.
 *
 * **A session deletes its own entries as it builds them.** When this map is
 * empty the prototype is done, which makes it a progress bar as well as a
 * registry.
 *
 * The frame ids are the canvas labels from `design/mobile-prototype/frames.md`
 * and, for Guest, `design/mobile-guest/`. `session` is the number in
 * MOBILE-PROTOTYPE-PROMPTS.md Part 5. A missing `frame` means the canvas does
 * not draw that surface at all — Host and oversight, the two optional sessions.
 */
import { ComingSoon, type IconName } from '@/components';
import { useT, type MessageKey, type Translate } from '@/i18n/i18n';
import { useDomain } from '@/domain';
import type { Surface } from '@/data/rentals';

export interface StubSpec {
  frame?: string;
  session: number;
  /** The page title. A nav label where the route is a tab, its own name where not. */
  title: MessageKey;
  icon?: IconName;
  /** Which surface this route belongs to, for the sibling index. */
  surface?: Surface;
}

export const STUBS = {
  /* X · Auth — frames X1 to X3 — BUILT by session 1, entries removed. */

  /* Guest — sessions 2 to 6 */
  search: { frame: 'G-Explore', session: 2, title: 'nav.explore', icon: 'search' },
  'trip/arrival-guide': { frame: 'G-TripDetail', session: 5, title: 'nav.trips', icon: 'mapPin' },
  'trip/review': { frame: 'G-TripDetail', session: 5, title: 'nav.trips', icon: 'star' },
  'self-check-in': { frame: 'G-SelfCheckIn', session: 5, title: 'nav.trips', icon: 'key' },
  /* `thread` (frame R13) BUILT by session 6, entry removed. */

  /* R · Tenant — frames R11, R12, R15 to R20 — BUILT by session 7, entries removed. */

  /* R · Landlord — frames R1 to R10 — BUILT by session 8, entries removed. */

  /* B · Broker — frames B21 to B24 — BUILT by session 9, entries removed. */

  /* W · Work · Housekeeping — frames W1 to W8 BUILT by session 10, entries
     removed: queue, rooms, tickets, task, inspection, report-fault. */

  /* Host — the canvas draws neither of these. BUILT by optional session A,
     entries removed: today, reservations, reservation/[id] and its check-in. */
} as const satisfies Record<string, StubSpec>;

export type StubId = keyof typeof STUBS;

/**
 * One spec, widened to `StubSpec`.
 *
 * `STUBS` is `as const` so a typo in an id is a compile error, which means
 * indexing it yields a 35-member literal union where `frame` exists on most
 * members and not on the two undrawn ones. Reading `.frame` off that union is
 * an error even though every member either has it or is allowed not to. This
 * is the one widening point, rather than a cast at each call site.
 */
export function stubSpec(id: StubId): StubSpec {
  return STUBS[id];
}

/** The tab set for a surface, as the sibling index renders it. */
const SIBLINGS: Record<Surface, { label: MessageKey; href: string; icon: IconName }[]> = {
  guest: [
    { label: 'nav.trips', href: '/trips', icon: 'calendar' },
    { label: 'nav.saved', href: '/saved', icon: 'heart' },
    { label: 'nav.inbox', href: '/inbox', icon: 'inbox' },
    { label: 'nav.account', href: '/account', icon: 'user' },
  ],
  tenant: [
    { label: 'nav.rent', href: '/rent', icon: 'wallet' },
    { label: 'nav.inbox', href: '/inbox', icon: 'inbox' },
    { label: 'nav.account', href: '/account', icon: 'user' },
  ],
  landlord: [
    { label: 'nav.leases', href: '/leases', icon: 'fileText' },
    { label: 'nav.repairs', href: '/maintenance', icon: 'wrench' },
    { label: 'nav.account', href: '/account', icon: 'user' },
  ],
  broker: [
    { label: 'nav.placements', href: '/placements', icon: 'key' },
    { label: 'nav.earnings', href: '/earnings', icon: 'coins' },
    { label: 'nav.account', href: '/account', icon: 'user' },
  ],
  work: [
    { label: 'nav.rooms', href: '/rooms', icon: 'bed' },
    { label: 'nav.tickets', href: '/tickets', icon: 'flag' },
    { label: 'nav.account', href: '/account', icon: 'user' },
  ],
  host: [
    { label: 'nav.reservations', href: '/reservations', icon: 'calendar' },
    { label: 'nav.inbox', href: '/inbox', icon: 'inbox' },
    { label: 'nav.account', href: '/account', icon: 'user' },
  ],
};

function siblingsFor(surface: Surface, t: Translate, self: MessageKey) {
  return SIBLINGS[surface]
    // Never link the tab the reader is already standing on.
    .filter((row) => row.label !== self)
    .map((row) => ({ label: t(row.label), href: row.href, icon: row.icon }));
}

/**
 * Renders the stub for a route id. Route files are one line each, so a session
 * replacing one deletes a line here and writes a screen there.
 */
export function Stub({ id }: { id: StubId }) {
  const spec: StubSpec = STUBS[id];
  const t = useT();
  const { surface } = useDomain();

  // A tab stub indexes its own surface's tabs; a stack stub indexes the
  // surface the reader is actually in, which is the set they can get back to.
  const shownSurface = spec.surface ?? surface;

  return (
    <ComingSoon
      frame={spec.frame}
      session={spec.session}
      title={t(spec.title)}
      icon={spec.icon}
      relatedLabel={t('comingSoon.eyebrow')}
      related={siblingsFor(shownSurface, t, spec.title)}
    />
  );
}
