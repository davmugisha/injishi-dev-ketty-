"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * `navigator.onLine`, live. The server render assumes online.
 *
 * It answers only whether the device has a network. True does not mean the API
 * answers; false does mean nothing will reach it, which is what a screen can
 * say plainly ("Checking the TIN needs a connection").
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
