import type { PersonaId } from "@injishi/data/types";

export type OtpStart =
  | { ok: true; challengeId: string; email: string; expiresAt: Date }
  | { ok: false; reason: "unknown-email" };

export type OtpCheck =
  | { ok: true; personaId: PersonaId }
  | { ok: false; reason: "wrong-code"; attemptsLeft: number }
  | { ok: false; reason: "expired" | "locked" | "not-found" };

/** 32-bit FNV-1a hash (hex) — detects fixture changes to re-seed the device database. */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Random id for demo sessions and challenges (not security-sensitive: the data is dummy). */
export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}
