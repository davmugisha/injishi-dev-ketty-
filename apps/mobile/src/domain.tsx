/**
 * Active domain, active workspace, and the SURFACE the two of them resolve to.
 *
 * `apps/mobile` is one Expo shell over every Injishi seat. The tab set, the
 * home screen and the Account surface all branch on this, the same way web
 * swaps sub-shells by active workspace.
 *
 * Three values, and they are not the same question:
 *
 *   - **domain** — Hospitality or Residence. The product's own split.
 *   - **workspace** — the seat the user is acting in (FL16). A workspace is the
 *     context a User acts within, and a Business or Broker workspace only
 *     exists on one side of the product, so selecting one *is* selecting a
 *     domain. Personal is the exception: it spans both (FL25 §9 — Guest and
 *     Tenant are one Personal workspace), so it leaves the domain alone.
 *   - **surface** — which of the six tab sets the shell draws. This is what
 *     `app/(tabs)/_layout.tsx` reads, and it is DERIVED, never set directly:
 *     one source of truth beats a fourth thing to keep in sync.
 *
 * The derivation, per Session 0 part A step 1:
 *
 *   personal + hospitality -> guest
 *   personal + residence   -> tenant
 *   landlord               -> landlord
 *   broker                 -> broker
 *   staff                  -> work
 *   host                   -> host
 *
 * Only Personal consults the domain, because it is the only seat that holds
 * two surfaces. Every other seat carries its surface on the row.
 *
 * Both the domain and the surface are persisted with `expo-secure-store` so a
 * switch survives a relaunch, and both are read back during bootstrap so they
 * are settled before the first frame — a surface resolved after mount is a
 * visible flash of the wrong tab bar. The WORKSPACE is not persisted directly;
 * the stored surface is what restores it, so a seat that has been revoked
 * cannot come back from the keychain.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { WorkspaceAccess } from '@injishi/contracts';
import type { Domain } from '@/components/domain-badge';
import type { Surface, WorkspaceEntry, WorkspaceKind } from '@/data/rentals';
import { useOptionalSession } from '@/session';
import { useOptionalWorkspace } from '@/workspace';
import { setCrashTags } from '@/lib/crash-reporter';

export type { Domain, Surface };

export interface DomainState {
  domain: Domain;
  setDomain: (d: Domain) => void;
  /**
   * The seat being acted in, in the shape the screens read.
   *
   * Sourced from `GET /api/v1/me/workspaces` through `workspace.tsx`, never
   * from a fixture. Until that answer lands it is the pending placeholder
   * below, which carries the stored surface and no invented org name.
   */
  workspace: WorkspaceEntry;
  /**
   * Every seat the person holds, in the same shape, for the switcher.
   *
   * Empty until the list resolves. A parked seat is present here and the
   * switcher is what leaves it out, the same way `SWITCHABLE_WORKSPACES` used
   * to — except the parking is now derived from the surface rather than being
   * a hand-set flag on a fixture row.
   */
  workspaces: WorkspaceEntry[];
  /**
   * Switch, server first, and resolve to whether it took (AC-S6).
   *
   * **Asynchronous, and that is the change task 8 makes.** It used to be a
   * setter over a fixture and could not fail. It now posts to
   * `POST /api/v1/me/active-workspace` and moves the app only on success,
   * because an app that moved optimistically would show a workspace the server
   * has not agreed to, and an unreachable server would leave the two
   * disagreeing about which workspace this person is in.
   */
  setWorkspace: (w: WorkspaceEntry) => Promise<boolean>;
  /** Derived from the active seat and the domain. Never settable on its own. */
  surface: Surface;
  /** True until the workspace list has answered once. */
  isResolving: boolean;
}

const DomainContext = createContext<DomainState | null>(null);

const STORE_KEY = 'injishi.active-domain';
const SURFACE_KEY = 'injishi.active-surface';

// SecureStore is a native keychain binding and has no web implementation; on
// web every call throws. Read and write through these so a web build (and a
// device that refuses the keychain) degrades to in-memory rather than crashing.
const persistable = Platform.OS !== 'web';

const SURFACES: readonly Surface[] = ['guest', 'tenant', 'landlord', 'broker', 'work', 'host'];

/**
 * The one derivation, and the whole mapping (ADR-038 parent cross child
 * contract, "Surface derivation is a client concern").
 *
 * The server answers what a person HOLDS and never sends a surface. This turns
 * that answer into a tab set:
 *
 *   | kind     | domain     | orgRole       | surface                        |
 *   |----------|------------|---------------|--------------------------------|
 *   | personal | any        | any           | guest or tenant, by the toggle |
 *   | broker   | any        | any           | broker                         |
 *   | business | residence  | any           | landlord                       |
 *   | business | hospitality| housekeeper   | work                           |
 *   | business | hospitality| anything else | host (parked)                  |
 *
 * It is presentation, not authorization, so it does not breach AC-6: nothing
 * about access is being decided, only which tabs to draw.
 *
 * Overloaded on purpose. Screens hold the flattened `WorkspaceEntry` and ask
 * with that; `workspace.tsx` holds the server's `WorkspaceAccess` and asks with
 * that. Both reach this one function, which is what keeps a surface from being
 * computed two slightly different ways in two places.
 */
export function surfaceFor(
  workspace: Pick<WorkspaceAccess, 'kind' | 'domain' | 'orgRole'> | WorkspaceEntry,
  domain: Domain,
): Surface {
  // Personal is the only seat holding two surfaces, so it is the only one that
  // consults the domain toggle. The server has no opinion on this split.
  if (workspace.kind === 'personal') {
    return domain === 'hospitality' ? 'guest' : 'tenant';
  }

  // A `WorkspaceEntry` has already been through the table below and carries the
  // answer, so it is read rather than recomputed.
  if ('surface' in workspace) return workspace.surface;

  if (workspace.kind === 'broker') return 'broker';
  if (workspace.domain === 'residence') return 'landlord';
  if (workspace.domain === 'hospitality') {
    return workspace.orgRole === 'housekeeper' ? 'work' : 'host';
  }

  // A business seat with no domain is not something the schema produces, and
  // guessing a surface for it would put somebody on a tab set nobody chose.
  // Personal is the one seat everybody has, so it is the safe landing.
  return domain === 'hospitality' ? 'guest' : 'tenant';
}

/** The client's own seat vocabulary, keyed by the surface that seat opens. */
const KIND_FOR_SURFACE: Readonly<Record<Surface, WorkspaceKind>> = {
  guest: 'personal',
  tenant: 'personal',
  landlord: 'landlord',
  broker: 'broker',
  work: 'staff',
  host: 'host',
};

/**
 * The server's answer, flattened into the shape the screens already read.
 *
 * Forty-seven files hold a `WorkspaceEntry`. Rebinding every one of them to
 * `WorkspaceAccess` in this slice would touch every surface at once, which is
 * exactly what ADR-038 is arranged to avoid — a surface is cut over whole, in
 * its own child. So the SOURCE changes here (the server, not `personas.ts`) and
 * the shape the screens read does not.
 */
export function toWorkspaceEntry(
  access: WorkspaceAccess & { label?: string },
  domain: Domain,
): WorkspaceEntry {
  const surface = surfaceFor(access, domain);
  return {
    id: access.workspaceId,
    type: access.kind,
    // `WorkspaceKind` is the CLIENT's vocabulary and it is not the server's:
    // the server says `business`, the app says `landlord` or `staff` or `host`
    // depending on what that business seat turned out to be. The surface is
    // what carries that distinction, so it is what this maps from.
    kind: KIND_FOR_SURFACE[surface],
    surface,
    name: access.label ?? access.orgName ?? 'Personal',
    // The role line a person reads, not a permission. Authorization is the
    // `permissions` array on the access row and is never derived from this.
    role: access.orgRole ?? (access.kind === 'personal' ? 'Guest · Tenant' : ''),
    domain: access.domain ?? undefined,
    org: access.orgName ?? undefined,
    property: access.propertyName ?? undefined,
    // `host` is parked (parent Follow-up), so it is reachable but never listed.
    parked: surface === 'host',
  };
}

/**
 * The seat to draw before the server has said what the seats are.
 *
 * ADR-038 child 0 task 8 deleted `WORKSPACES` from `src/data/personas.ts`, and
 * this is what replaced the lookup into it. There is a real window — one cold
 * start, one round trip — where the stored SURFACE is known and the workspace
 * behind it is not, and something has to be rendered in it.
 *
 * **It invents no name.** The fixture used to answer this window with
 * "Kayitare Court", an org that may not exist for the person holding the phone,
 * and an eyebrow reading somebody else's business is worse than one reading
 * nothing. So the placeholder carries the surface, the kind that surface
 * implies, and an EMPTY name, which every screen already renders as an empty
 * eyebrow rather than as a wrong one.
 *
 * `id` is empty too, deliberately: nothing may switch to it, and a call site
 * that tried would be asking the server to activate a workspace with no id
 * rather than silently acting in the wrong one.
 */
function pendingWorkspace(surface: Surface): WorkspaceEntry {
  return {
    id: '',
    type: surface === 'broker' ? 'broker' : surface === 'guest' || surface === 'tenant' ? 'personal' : 'business',
    kind: KIND_FOR_SURFACE[surface],
    surface,
    name: '',
    role: '',
  };
}

/**
 * Read during bootstrap, before the shell paints — see `app/_layout.tsx`. It is
 * exported rather than hydrated inside the provider because a domain resolved
 * after mount is a visible flash of the other domain's home tab.
 */
export async function readStoredDomain(): Promise<Domain | null> {
  if (!persistable) return null;
  try {
    const stored = await SecureStore.getItemAsync(STORE_KEY);
    return stored === 'hospitality' || stored === 'residence' ? stored : null;
  } catch {
    return null;
  }
}

/** The stored surface, narrowed to one this build still ships. */
export async function readStoredSurface(): Promise<Surface | null> {
  if (!persistable) return null;
  try {
    const stored = await SecureStore.getItemAsync(SURFACE_KEY);
    return SURFACES.includes(stored as Surface) ? (stored as Surface) : null;
  } catch {
    return null;
  }
}

async function writeStoredDomain(d: Domain): Promise<void> {
  if (!persistable) return;
  try {
    await SecureStore.setItemAsync(STORE_KEY, d);
  } catch {
    // A failed write costs the user one switch after a relaunch. It is never
    // worth taking the shell down for.
  }
}

async function writeStoredSurface(s: Surface): Promise<void> {
  if (!persistable) return;
  try {
    await SecureStore.setItemAsync(SURFACE_KEY, s);
  } catch {
    // Same trade as the domain write.
  }
}

/** Forget the stored seat. A failed delete costs the next person one flash. */
async function clearStoredSeat(): Promise<void> {
  if (!persistable) return;
  try {
    await SecureStore.deleteItemAsync(STORE_KEY);
    await SecureStore.deleteItemAsync(SURFACE_KEY);
  } catch {
    // Same trade as the writes above.
  }
}

export function DomainProvider({
  initial = 'residence',
  initialSurface,
  children,
}: {
  initial?: Domain;
  initialSurface?: Surface | null;
  children: ReactNode;
}) {
  const [domain, setDomainState] = useState<Domain>(initial);
  /**
   * The surface the shell draws, seeded from the keychain.
   *
   * It is state in its own right rather than a pure derivation, because it has
   * to be right BEFORE the workspace list resolves. A surface computed after
   * mount is a visible flash of the wrong tab bar, which is the failure the
   * bootstrap read exists to prevent, and the round trip to `/me/workspaces`
   * made that window a great deal longer than it used to be.
   */
  const [storedSurface, setStoredSurface] = useState<Surface>(
    initialSurface ?? (initial === 'hospitality' ? 'guest' : 'tenant'),
  );

  // Null when there is no provider above, which is the same state as "the list
  // has not answered yet" as far as this file is concerned. See
  // `useOptionalWorkspace`.
  const resolved = useOptionalWorkspace();

  /**
   * A session that ends takes its seat with it (mobile audit SA-19).
   *
   * The stored domain and surface belong to the person who chose them. Kept
   * across a sign out, the next person to sign in on this phone opened on the
   * previous one's tab set until their own seats resolved. Only the TRANSITION
   * from signed in to signed out clears it, so a cold start never throws away
   * a stored seat it has not yet had the chance to confirm.
   */
  const sessionStatus = useOptionalSession()?.status;
  const wasSignedIn = useRef(sessionStatus === 'authenticated');
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      wasSignedIn.current = true;
      return;
    }
    if (sessionStatus === 'anonymous' && wasSignedIn.current) {
      wasSignedIn.current = false;
      setDomainState('residence');
      setStoredSurface('tenant');
      void clearStoredSeat();
    }
  }, [sessionStatus]);

  /**
   * Every seat, in the shape the screens read.
   *
   * `toWorkspaceEntry` is what keeps forty-seven files from having to be
   * rebound to `WorkspaceAccess` in this slice: the SOURCE changed (the server,
   * not `personas.ts`) and the shape the screens read did not.
   */
  const workspaces = useMemo<WorkspaceEntry[]>(
    () => (resolved?.workspaces ?? []).map((w) => toWorkspaceEntry(w, domain)),
    [resolved?.workspaces, domain],
  );

  /**
   * The seat being acted in.
   *
   * The server's active workspace, mapped; the placeholder while nothing has
   * resolved. Never a fixture, and never a guess at somebody's org name.
   */
  const workspace = useMemo<WorkspaceEntry>(() => {
    if (resolved?.active) return toWorkspaceEntry(resolved.active, domain);
    return pendingWorkspace(storedSurface);
  }, [resolved?.active, domain, storedSurface]);

  /**
   * What the shell draws.
   *
   * Once a workspace has resolved it is derived from that seat, which is the
   * authority. Until then it is the stored value, so the tab bar is the one the
   * person left rather than a default.
   */
  const surface = resolved?.active ? surfaceFor(workspace, domain) : storedSurface;

  // Every crash report names the seat it happened in (ADR-063 AC-6): two tags,
  // never a workspace or a person. A no op when reporting is not running.
  useEffect(() => {
    setCrashTags({ surface, domain });
  }, [surface, domain]);

  // Both setters read the current values out of the closure rather than out of
  // a state updater. A `setState(prev => { write(prev); return prev })` fires
  // its side effect twice under StrictMode and once more on any replayed
  // render, and these side effects are keychain writes.
  const setDomain = useCallback(
    (d: Domain) => {
      // Only Personal spans both domains, so a seat belonging to the other one
      // cannot survive the toggle. It used to fall back to the Personal
      // FIXTURE; it now falls back to whichever Personal seat the server
      // returned, and to the placeholder when none has.
      const next = workspace.domain && workspace.domain !== d
        ? (workspaces.find((w) => w.type === 'personal') ?? pendingWorkspace(d === 'hospitality' ? 'guest' : 'tenant'))
        : workspace;
      const nextSurface = surfaceFor(next, d);
      setDomainState(d);
      setStoredSurface(nextSurface);
      void writeStoredDomain(d);
      void writeStoredSurface(nextSurface);
      // A domain toggle that also changes the SEAT has to be recorded on the
      // server like any other switch, or the next cold start reads the old one.
      if (next.id && next.id !== workspace.id) void resolved?.switchTo(next.id);
    },
    [workspace, workspaces, resolved],
  );

  /**
   * Switch, server first (AC-S6).
   *
   * Nothing local moves until `POST /me/active-workspace` has agreed. The
   * caller gets the answer so it can toast a success it actually had, rather
   * than announcing a switch that did not happen.
   *
   * Rows cached under the previous workspace can never surface under the new
   * one, because every workspace scoped key begins with the workspace id
   * (`query-keys.ts`). The switch changes the key; nothing has to be cleared.
   */
  const setWorkspace = useCallback(
    async (w: WorkspaceEntry): Promise<boolean> => {
      // The placeholder has no id and nothing may switch to it.
      if (!w.id) return false;

      if (resolved) {
        const took = await resolved.switchTo(w.id);
        if (!took) return false;
      }

      // Personal carries no domain, so it leaves the domain exactly as it was:
      // a Guest switching to Personal stays on Guest, a Tenant stays on Tenant.
      const nextDomain = w.domain ?? domain;
      const nextSurface = surfaceFor(w, nextDomain);
      setDomainState(nextDomain);
      setStoredSurface(nextSurface);
      void writeStoredDomain(nextDomain);
      void writeStoredSurface(nextSurface);
      return true;
    },
    [domain, resolved],
  );

  const value = useMemo<DomainState>(
    () => ({
      domain,
      setDomain,
      workspace,
      workspaces,
      setWorkspace,
      surface,
      isResolving: resolved?.isResolving ?? false,
    }),
    [domain, setDomain, workspace, workspaces, setWorkspace, surface, resolved?.isResolving],
  );
  return <DomainContext.Provider value={value}>{children}</DomainContext.Provider>;
}

export function useDomain(): DomainState {
  const ctx = useContext(DomainContext);
  if (!ctx) throw new Error('useDomain must be used within a DomainProvider');
  return ctx;
}
