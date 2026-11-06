import type { AccessSubject } from "@/server/access";
import { screenDecision } from "@/server/access";
import type { Account } from "@/server/auth";

/** A screen of the registry, as the access decision names it. */
type BoardId = Parameters<typeof screenDecision>[1];

/** What the access decisions read about an account (`server/access.ts`). */
export function accessSubject(account: Account): AccessSubject {
  return {
    demo: account.demo,
    personaId: account.persona.id,
    workspaces: account.workspaces,
    active: account.active,
    staff: account.staff,
    oversight: account.oversight,
  };
}

/** May this account open this screen? The predicate the sign-in landing passes on (`return-to.ts`). */
export function canOpen(account: Account): (board: BoardId) => boolean {
  const subject = accessSubject(account);
  return (board) => screenDecision(subject, board).ok;
}
