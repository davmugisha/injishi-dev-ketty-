// The sample data session (proto-ui, mock mode only): who the prototype is being shown as. No API, no
// account: a role (which of the seven apps) and whether "signed in" was pressed. Kept with
// expo-secure-store's sync calls so a reload keeps it; where those throw (the web), it lives in memory.
// Api mode never reads it: there the real session (`src/lib/session.tsx`) decides.

import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";
import { APP_KEYS, type AppKey } from "./screens";

export interface ProtoSession {
  /** "Signed in" was pressed (sign in, the launcher's Sign in as…), and not signed out since. */
  signedIn: boolean;
  /** The app the prototype is being shown as; null until a role is picked. */
  role: AppKey | null;
}

const KEY = "proto.session";
const SIGNED_OUT: ProtoSession = { signedIn: false, role: null };

let current: ProtoSession | null = null;
const listeners = new Set<() => void>();

function isAppKey(value: unknown): value is AppKey {
  return typeof value === "string" && (APP_KEYS as readonly string[]).includes(value);
}

function load(): ProtoSession {
  try {
    const raw = SecureStore.getItem(KEY);
    if (!raw) return SIGNED_OUT;
    const saved = JSON.parse(raw) as { signedIn?: unknown; role?: unknown };
    return { signedIn: saved.signedIn === true, role: isAppKey(saved.role) ? saved.role : null };
  } catch {
    return SIGNED_OUT;
  }
}

function read(): ProtoSession {
  current ??= load();
  return current;
}

function set(next: ProtoSession): void {
  current = next;
  try {
    SecureStore.setItem(KEY, JSON.stringify(next));
  } catch {
    // The web has no secure store: the session lasts until the page reloads.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The sample data session; re-renders when it changes. */
export function useProtoSession(): ProtoSession {
  return useSyncExternalStore(subscribe, read, read);
}

/** The session outside React (the start route's first frame, an event handler). */
export function protoSession(): ProtoSession {
  return read();
}

/** Signed in as one app's person: the start route opens that app. */
export function protoSignIn(role: AppKey): void {
  set({ signedIn: true, role });
}

/** Signed out: the start route shows the welcome again. */
export function protoSignOut(): void {
  set(SIGNED_OUT);
}

/** Show the prototype as another app's person, signed in or not as before (the launcher, the switcher). */
export function setProtoRole(role: AppKey): void {
  const now = read();
  if (now.role !== role) set({ ...now, role });
}
