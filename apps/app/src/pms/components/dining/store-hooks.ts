"use client";

/**
 * How the four dining screens read the two demo stores, and how they refuse.
 *
 * Three things live here rather than in each screen, because each of them was
 * a defect the first time it was written per-screen:
 *
 *  - **The subscription.** A screen that read `localStorage` during render
 *    disagreed with the server-rendered markup and React threw the tree away.
 *    Every hook below opens on the SEEDED value — the same one the server
 *    produced — and re-reads in an effect, so the first client render matches
 *    and every later write lands in every open screen at once.
 *  - **The property.** The Live orders board, the Menu lens and the desk
 *    threads must all be talking about the same hotel, and `state.prop` plus
 *    `DEMO_PMS_PROPERTY_SLUG` is the one bridge that says which.
 *  - **The refusal.** See `useDiningGuard`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Permission } from "../../authz";
import { DEMO_PMS_PROPERTY_SLUG, type DiningProduct } from "../../data/dining";
import { useCapability } from "../../data/capability";
import { usePms } from "../../store";
import { authorize, propertyKey } from "../../store/helpers";
import { menuFromFixture, readMenu, subscribeMenuStore } from "./menu-store";
import {
  type ChatThread,
  type RoomOrder,
  demoOrdersFor,
  demoThreadsFor,
  readOrders,
  readThreads,
  subscribeOrderStore,
} from "./order-store";

/**
 * Which marketplace catalogue the workspace in view manages.
 *
 * Null in the landlord workspace, which sells no food: a residence has no
 * outlet, and pointing it at a hotel's menu to have something to render would
 * be the demo bridge lying rather than standing in.
 */
export function useDemoPropertySlug(): string | null {
  const { state } = usePms();
  const key = propertyKey(state);
  return key === "residence" ? null : DEMO_PMS_PROPERTY_SLUG[key];
}

/**
 * Re-read a store on every write, starting from the seeded value.
 *
 * The seed is what the SERVER rendered, and the read happens in an effect,
 * which is what keeps the first client paint identical to it. `read` has to be
 * stable — every caller below wraps it in `useCallback` keyed on the property —
 * because an inline closure would tear the subscription down and rebuild it on
 * every keystroke anywhere on the screen.
 */
function useStoreValue<T>(
  seed: T,
  read: () => T,
  subscribe: (listener: () => void) => () => void,
): T {
  const [value, setValue] = useState<T>(seed);

  useEffect(() => {
    const sync = () => setValue(read());
    sync();
    return subscribe(sync);
  }, [read, subscribe]);

  return value;
}

/** Every room order for the property in view, newest first. */
export function useRoomOrders(propertySlug: string | null): RoomOrder[] {
  const seed = useMemo(
    () => (propertySlug === null ? [] : demoOrdersFor(propertySlug)),
    [propertySlug],
  );
  const read = useCallback(
    () => (propertySlug === null ? [] : readOrders(propertySlug)),
    [propertySlug],
  );
  return useStoreValue(seed, read, subscribeOrderStore);
}

/** The five department threads for the property in view. */
export function useDepartmentThreads(propertySlug: string | null): ChatThread[] {
  const seed = useMemo(
    () => (propertySlug === null ? [] : demoThreadsFor(propertySlug)),
    [propertySlug],
  );
  const read = useCallback(
    () => (propertySlug === null ? [] : readThreads(propertySlug)),
    [propertySlug],
  );
  return useStoreValue(seed, read, subscribeOrderStore);
}

/** The menu this property is selling, with the operator's edits applied. */
export function useMenu(propertySlug: string | null): DiningProduct[] {
  const seed = useMemo(
    () => (propertySlug === null ? [] : menuFromFixture(propertySlug)),
    [propertySlug],
  );
  const read = useCallback(
    () => (propertySlug === null ? [] : readMenu(propertySlug)),
    [propertySlug],
  );
  return useStoreValue(seed, read, subscribeMenuStore);
}

/**
 * The one gate every mutation on these four screens passes through.
 *
 * It ASKS `authorize()` in `store/helpers.ts` — the app's single permission
 * choke point, the same function the reducer asks — and it never resolves a
 * permission from a role. `authorize` answers `null` when the permission is
 * held and a toasted `State` when it is not; only the reducer can apply that
 * `State`, so the refusal is echoed here through `toast` instead of returned.
 * The ANSWER still comes from one place, which is what stops a demo mutation
 * and a reducer mutation from ever disagreeing about who may do what.
 *
 * The wording comes from `useCapability().reasonFor`, so a refusal names its
 * CAUSE: "your business is not approved yet" and "your role cannot do this"
 * both arrive as an empty permission array and need opposite sentences.
 *
 * This runs in the browser. It is a product correctness control; the API's
 * `WorkspaceGuard` is the boundary.
 */
export function useDiningGuard(): (permission: Permission) => boolean {
  const { state, toast } = usePms();
  const { reasonFor } = useCapability();

  return useCallback(
    (permission: Permission) => {
      if (authorize(state, permission) === null) return true;
      const reason = reasonFor(permission);
      if (reason) toast(reason, "bad");
      return false;
    },
    [state, toast, reasonFor],
  );
}
