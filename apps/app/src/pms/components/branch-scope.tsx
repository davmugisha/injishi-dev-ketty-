"use client";

/**
 * The branch in view (ADR-054 AC-S1).
 *
 * THE URL IS THE SOURCE: `?branch=<id>`. This component turns it into the value
 * the data layer sends as `x-branch-id`, and it is the only writer of that value.
 *
 * - It resolves DURING RENDER, before any screen below it asks for data, so the
 *   first request a screen makes already names the right branch. An effect would
 *   land after the children had fetched with the old one.
 * - A value that is not one of the grant's `branches` is dropped and the URL is
 *   rewritten without it. The API would refuse it with a 404 anyway; the app does
 *   not render a screen it knows will be refused.
 * - The choice SURVIVES NAVIGATION. Nav links are plain paths, so the choice is
 *   remembered for the tab and written back onto a URL that arrives without it.
 * - A change of branch remounts the screens below, keyed on the branch, so no
 *   screen can hold one branch's rows in local state under another's name. The
 *   cache is already split by branch (`branchQueryKeyHash`).
 *
 * Coverage: a member covering every branch starts on All branches (no header).
 * A limited member gets no All branches row; until branch limits are read
 * (ADR-054 slice 4) there is no such member, and with no choice the API narrows
 * to the branches they cover.
 */

import type { WorkspaceBranch } from "@injishi/contracts";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import { setBranchInView } from "../data/branch";

interface BranchInView {
  /** The chosen branch, or null for every covered branch. */
  branchId: string | null;
  /** The active branches the member covers, head office first. */
  branches: WorkspaceBranch[];
  /** Whether All branches may be chosen. */
  coversEvery: boolean;
  /** Choose a branch, or null for All branches. */
  choose: (branchId: string | null) => void;
}

const BranchContext = createContext<BranchInView>({
  branchId: null,
  branches: [],
  coversEvery: true,
  choose: () => undefined,
});

export function useBranchInView(): BranchInView {
  return useContext(BranchContext);
}

const PARAM = "branch";
const storageKey = (workspaceId: string) => `injishi.branch.${workspaceId}`;

/** Session storage can be absent or throw (private windows); the URL still works. */
function remembered(workspaceId: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(storageKey(workspaceId));
  } catch {
    return null;
  }
}

function remember(workspaceId: string, branchId: string | null): void {
  try {
    if (branchId) window.sessionStorage.setItem(storageKey(workspaceId), branchId);
    else window.sessionStorage.removeItem(storageKey(workspaceId));
  } catch {
    // Nothing to do: the choice lives in the URL for this page either way.
  }
}

export function BranchScope({
  workspaceId,
  branches,
  coverage,
  children,
}: {
  workspaceId: string;
  branches: WorkspaceBranch[];
  coverage: "all" | "limited" | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const fromUrl = search.get(PARAM);
  const known = (id: string | null) => (id && branches.some((b) => b.id === id) ? id : null);
  // A value in the URL wins, valid or not: an invalid one means All, and is
  // then removed. With none, the tab's remembered choice.
  const branchId = fromUrl !== null ? known(fromUrl) : known(remembered(workspaceId));

  // During render, on purpose (see the header).
  setBranchInView(branchId);

  const hrefWith = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(search.toString());
      if (id) next.set(PARAM, id);
      else next.delete(PARAM);
      const query = next.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, search],
  );

  useEffect(() => {
    if (fromUrl !== null && !known(fromUrl)) {
      // Not a branch this member covers, or no longer active: drop it.
      remember(workspaceId, null);
      router.replace(hrefWith(null));
    } else if (fromUrl !== null) {
      remember(workspaceId, fromUrl);
    } else if (branchId) {
      // Arrived on a plain path: put the remembered choice back in the URL.
      router.replace(hrefWith(branchId));
    }
    // `known` is derived from `branches`, which is in the list.
  }, [fromUrl, branchId, branches, workspaceId, router, hrefWith]);

  const choose = useCallback(
    (id: string | null) => {
      remember(workspaceId, id);
      router.push(hrefWith(id));
    },
    [workspaceId, router, hrefWith],
  );

  const value = useMemo<BranchInView>(
    () => ({ branchId, branches, coversEvery: coverage !== "limited", choose }),
    [branchId, branches, coverage, choose],
  );

  return (
    <BranchContext.Provider value={value}>
      <Fragment key={branchId ?? "all"}>{children}</Fragment>
    </BranchContext.Provider>
  );
}
