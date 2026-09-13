/**
 * The shape of every cache key.
 *
 * One file owns this because of one invariant (ADR-038 child 0, AC-S6):
 *
 *   **Every workspace scoped key BEGINS with the workspace id.**
 *
 * Without it, switching workspace shows the previous workspace's rows under the
 * new one's name — the cache has no idea the question changed, because the key
 * did not. That is not a stale read, it is one landlord looking at another
 * landlord's tenants, and it would look completely normal.
 *
 * Keys are arrays, hierarchical, and every part is JSON-serialisable, so
 * `invalidateQueries({ queryKey: forWorkspace(id) })` can drop everything for
 * one workspace in a single call.
 */

/**
 * The root of every workspace scoped key.
 *
 * Also the invalidation handle: passing this to `invalidateQueries` matches all
 * of that workspace's queries by prefix and nothing belonging to another.
 */
export function forWorkspace(workspaceId: string) {
  return ['ws', workspaceId] as const;
}

/** Person scoped keys. No workspace id, because no workspace is involved. */
export const meKeys = {
  all: ['me'] as const,
  workspaces: () => ['me', 'workspaces'] as const,
  profile: () => ['me', 'profile'] as const,
  twoFactor: () => ['me', 'two-factor'] as const,
  orderable: () => ['me', 'orderable'] as const,
  /** A placed order, seeded from the `POST` answer: there is no read route yet. */
  order: (id: string) => ['me', 'order', id] as const,
} as const;

/** The demo persona list. Person scoped, and only exists on a demo host. */
export const demoKeys = {
  personas: () => ['demo', 'personas'] as const,
} as const;

/** Which platform the API is (ADR-043). Public, and the same for everybody. */
export const platformKeys = {
  info: () => ['platform'] as const,
} as const;

/**
 * Landlord reads.
 *
 * The rent roll is the tracer (AC-S14) and the first real key in the app.
 */
export const landlordKeys = {
  all: (workspaceId: string) => [...forWorkspace(workspaceId), 'landlord'] as const,
  rentRoll: (workspaceId: string) =>
    [...forWorkspace(workspaceId), 'landlord', 'rent-roll'] as const,
} as const;
