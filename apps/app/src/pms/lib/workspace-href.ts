"use client";

import { useCallback } from "react";

import { useWorkspaceId } from "../data/capability";
import { workspaceBase } from "./nav";

/**
 * Build a link inside the workspace in view (ADR-018, AC-1).
 *
 * Screens used to write `/host/bills/${id}` by hand. That address named a KIND,
 * so it was the same address for every hotel a person ran, and every screen
 * that wrote one was a second place the prefix lived. This is the one place
 * now: pass the part after the workspace, get back a real address.
 *
 *   const href = useWorkspaceHref();
 *   router.push(href(`/bills/${id}`));
 *
 * The id comes from the route param, so a link built here always points at the
 * workspace the person is actually looking at, even with two tabs open on two
 * hotels.
 */
export function useWorkspaceHref(): (path: string) => string {
  const workspaceId = useWorkspaceId();
  return useCallback(
    (path: string) => `${workspaceBase(workspaceId)}${path}`,
    [workspaceId],
  );
}
