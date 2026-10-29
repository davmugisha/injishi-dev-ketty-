import type { OperatorFolio } from "@injishi/contracts";

import type { Lens } from "../components/object-page";
import { workspaceBase } from "./nav";

/**
 * The lenses each record carries, and the addresses they live at (ADR-018,
 * move 3).
 *
 * ONE PLACE, because two of them exist: the rail a person clicks, and the route
 * guard that decides whether a typed URL is a 404 (D-n). If those two lists ever
 * came from different places, the rail would offer a link that refuses, or a
 * record would quietly grow a lens nobody can reach.
 *
 * EVERY LENS APPLIES TO EVERY RECORD OF ITS KIND. The spec lists seven lenses
 * for a lease without conditions, so a lease that has not ended still has a
 * `move-out` lens: it is where you go to see that there is nothing there yet.
 * If a record ever genuinely lacks one, this is the file that says so, and the
 * rail and the 404 will agree because they read the same answer.
 */

/** What we call each kind of record in a URL. */
export type ObjectKind = "reservations" | "stays" | "leases";

interface LensDef {
  key: string;
  label: string;
}

/**
 * The first entry is the DEFAULT lens and lives at the record's own address
 * rather than at a named child, so `/…/reservations/[id]` is a real page and not
 * a redirect.
 */
const LENSES: Record<ObjectKind, readonly LensDef[]> = {
  reservations: [
    { key: "overview", label: "Overview" },
    { key: "guests", label: "Guests" },
    { key: "payment", label: "Payment" },
    { key: "messages", label: "Messages" },
    { key: "history", label: "History" },
  ],
  stays: [
    { key: "overview", label: "Overview" },
    // The folio is the reason a stay matters, so it sits first after the
    // overview rather than last.
    { key: "folio", label: "Folio" },
    { key: "guests", label: "Guests" },
    { key: "documents", label: "Documents" },
    { key: "notes", label: "Notes" },
  ],
  leases: [
    { key: "overview", label: "Overview" },
    { key: "contract", label: "Contract" },
    { key: "rent", label: "Rent" },
    { key: "caution", label: "Caution" },
    { key: "filing", label: "Filing" },
    { key: "move-out", label: "Move-out" },
    { key: "visitors", label: "Visitors" },
  ],
};

/** The canonical address of one record. */
export function objectHref(
  workspaceId: string | null,
  kind: ObjectKind,
  id: string,
): string {
  return `${workspaceBase(workspaceId)}/${kind}/${id}`;
}

/**
 * The one address of one folio (ADR-044, D-c): it lives under the record it
 * bills, and a folio that bills no record is a record itself, in Finance.
 *
 * ONE FUNCTION, because three screens each spelling the rule is how the folio
 * got two addresses. Bills links with it, and the stay's Folio lens, the
 * reservation's Payment lens and the Finance bill each render a folio only when
 * this answer is their own address, so a folio is never shown in two places.
 *
 * A guest folio takes the first match, top to bottom: a stay before a booking.
 * A guest folio on a lease has no address yet (P-O2 is not designed, and the
 * contract carries no `leaseId`), so this says `null` rather than pointing at
 * Finance, which refuses a guest folio.
 */
export function folioHref(
  workspaceId: string | null,
  folio: Pick<OperatorFolio, "id" | "folioType" | "guestStayId" | "bookingId">,
): string | null {
  if (folio.folioType !== "guest") {
    return `${workspaceBase(workspaceId)}/finance/bills/${folio.id}`;
  }
  if (folio.guestStayId) return `${objectHref(workspaceId, "stays", folio.guestStayId)}/folio`;
  if (folio.bookingId) return `${objectHref(workspaceId, "reservations", folio.bookingId)}/payment`;
  return null;
}

/** The rail for one record: every lens it has, each at its own address. */
export function lensesFor(
  workspaceId: string | null,
  kind: ObjectKind,
  id: string,
): Lens[] {
  const base = objectHref(workspaceId, kind, id);
  return LENSES[kind].map((lens, i) => ({
    key: lens.key,
    label: lens.label,
    // The default lens is the record's own address, not a named child.
    href: i === 0 ? base : `${base}/${lens.key}`,
  }));
}

/** Does this kind of record carry this lens at all? */
export function hasLens(kind: ObjectKind, lensKey: string): boolean {
  return LENSES[kind].some((lens) => lens.key === lensKey);
}
