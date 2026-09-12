import { authorize, updateHost, updateResidence, withToast } from "./helpers";
import type { Action, State } from "./types";

/**
 * Conversations and the housekeeping board.
 *
 * Returns null for an action it does not own, so `reducer` in ../store.tsx can
 * try each slice in turn. Behaviour is the original switch verbatim — the cases
 * moved, nothing about them changed.
 */
export function messagingReducer(s: State, a: Action): State | null {
  switch (a.type) {
    case "readThread": {
      const mark = <T extends { threads: typeof s.db.residence.threads }>(p: T): T => ({
        ...p,
        threads: p.threads.map((t) => (t.id === a.threadId ? { ...t, unread: false } : t)),
      });
      // Two scopes here now, not three. Personal moved to `apps/web` with its
      // own inbox (ADR-018, move 4), so this reducer only ever answers for the
      // operator side.
      if (a.scope === "landlord") return updateResidence(s, mark);
      return updateHost(s, mark);
    }

    case "sendMessage": {
      const denied = authorize(s, "message.send");
      if (denied) return denied;
      const text = a.text.trim();
      if (!text) return s;
      // The operator replies as the business, in both workspaces.
      const stamp = { from: "host" as const, text, ts: "Just now" };
      const append = <T extends { threads: typeof s.db.residence.threads }>(p: T): T => ({
        ...p,
        threads: p.threads.map((t) => (t.id === a.threadId ? { ...t, unread: false, msgs: [...t.msgs, stamp] } : t)),
      });
      const next =
        a.scope === "landlord" ? updateResidence(s, append) : updateHost(s, append);
      return withToast(next, "Sent — they get it on their phone", "ok");
    }

    case "assignTask": {
      const denied = authorize(s, "task.assign");
      if (denied) return denied;
      const next = updateHost(s, (p) => ({
        ...p,
        tasks: p.tasks.map((t) => (t.room === a.room ? { ...t, who: a.who } : t)),
      }));
      return withToast(
        next,
        a.who
          ? `Assigned — Room ${a.room} · ${a.who}. It moves to the top of their phone.`
          : `Unassigned — Room ${a.room} goes back to the shared list`,
        a.who ? "ok" : "info",
      );
    }


    default:
      return null;
  }
}
