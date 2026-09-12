"use client";

/**
 * Maintenance tickets (F-P05) — a board that walks a fault to done.
 *
 * **On real data** (ADR-035, D-f wave 1). Reads `GET /api/v1/ops/tickets` and
 * commands `POST /ops/tickets/:id/advance`. The demo store is gone from this
 * screen; `WorkspaceBoundary` guarantees a workspace before any of this renders,
 * so there was never a second path to keep alive here (D-i).
 *
 * Shared board across both sectors: the landlord Maintenance screen renders
 * this too. The endpoint is workspace scoped, so it serves a hotel and a rented
 * building from the same read and `landlord` only changes the wording.
 *
 * TWO THINGS THE DEMO GOT WRONG AND THIS FIXES.
 *
 * **A photo band that had no photo.** The demo card led with a striped
 * placeholder and a filename. There is no photo column on `maintenance_tickets`
 * and no upload path to one, so a band promising a photo was the screen making
 * a claim the data could not keep. The card leads with the fault instead.
 *
 * **Advancing took no note, and the server requires one.**
 * `AdvanceTicketRequest.note` is `min(1)` on purpose: `maintenance_events` is
 * the only record of WHY a ticket moved, and a resolved ticket with no reason
 * is the one a tenant reopens next week. So the button opens a note field and
 * the command waits for it. A one click advance would simply be refused.
 */

import { Button, Input } from "@injishi/ui";
import type { MaintenanceStatus, OperatorTicket } from "@injishi/contracts";
import { useState } from "react";
import { ActionButton, Badge, EmptyState, LoadFailed, Skeleton } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useAdvanceTicket, useTickets } from "../data/ops";
import { dshortIso } from "../lib/format";
import { usePms } from "../store";

/**
 * The four columns, and where the other two statuses land.
 *
 * `MaintenanceStatus` has six values; a board with six columns would be four
 * columns of work and two of history. `closed` sits with `resolved` because to
 * a desk they are the same answer — this is done. `cancelled` is off the board
 * entirely: it is not a stage of the work, it is the work being called off.
 */
const COLUMNS: {
  key: MaintenanceStatus;
  label: string;
  holds: MaintenanceStatus[];
  empty: (landlord: boolean) => string;
}[] = [
  {
    key: "open",
    label: "Open",
    holds: ["open"],
    empty: (l) =>
      l
        ? "New reports land here — from tenants or your caretaker."
        : "New reports land here — usually from a housekeeper's phone.",
  },
  { key: "assigned", label: "Assigned", holds: ["assigned"], empty: () => "Nothing assigned." },
  {
    key: "in_progress",
    label: "In progress",
    holds: ["in_progress"],
    empty: () => "Nothing being worked on.",
  },
  {
    key: "resolved",
    label: "Resolved",
    holds: ["resolved", "closed"],
    empty: () => "Nothing resolved yet.",
  },
];

/** Where a card goes next, and what the button that sends it there says. */
const NEXT: Partial<Record<MaintenanceStatus, { to: MaintenanceStatus; label: string }>> = {
  open: { to: "assigned", label: "Assign" },
  assigned: { to: "in_progress", label: "Start" },
  in_progress: { to: "resolved", label: "Resolve" },
};

/** What the note field asks for, worded for the move being made. */
const NOTE_PROMPT: Partial<Record<MaintenanceStatus, string>> = {
  assigned: "Who is taking it?",
  in_progress: "What is being done?",
  resolved: "What was done?",
};

const PRIORITY_INTENT: Record<string, "bad" | "warn" | "info" | "neutral"> = {
  urgent: "bad",
  high: "warn",
  normal: "info",
  low: "neutral",
};

export function Tickets({ landlord = false }: { landlord?: boolean }) {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useTickets(workspaceId);
  const advance = useAdvanceTicket(workspaceId);

  /** The card whose note field is open, and what has been typed into it. */
  const [noting, setNoting] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const mayAdvance = can("ticket.advance");
  const denied = mayAdvance ? undefined : reasonFor("ticket.advance");

  function submit(ticket: OperatorTicket, to: MaintenanceStatus) {
    const text = note.trim();
    // The server refuses an empty note, so refuse it here rather than sending a
    // request that can only come back as a validation error.
    if (!text) return;
    advance.mutate(
      { ticketId: ticket.id, to, note: text },
      {
        onSuccess: () => {
          setNoting(null);
          setNote("");
          // Where the fault stands, not the word on the button. "Kettle — in
          // progress" reads like a log line; the desk wants to know whether it
          // can stop apologising for the room.
          toast(
            to === "resolved"
              ? `${ticket.title} is fixed and closed. Your note is on the ticket.`
              : to === "in_progress"
                ? `${ticket.title} is being worked on now.`
                : `${ticket.title} is assigned and waiting on maintenance.`,
            "ok",
          );
        },
        onError: toastError,
      },
    );
  }

  if (query.isPending) {
    return (
      <div
        className="pms-enter"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 12,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={220} delay={i * 60} />
        ))}
      </div>
    );
  }

  if (query.isError) {
    /* An unreachable API is not an empty board. A property told it has no
       faults stops looking for the one that is flooding a bathroom. */
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your maintenance board. Every reported fault is still open —
        this is on our side, not an empty list.
      </LoadFailed>
    );
  }

  const tickets = query.data?.tickets ?? [];

  return (
    <div className="pms-enter">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
          {landlord
            ? "Tenants report from their app and your caretaker from theirs — both land here."
            : "Housekeepers report from their phone and it lands here."}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 12,
          alignItems: "start",
        }}
      >
        {COLUMNS.map((col) => {
          const cards = tickets.filter((t) => col.holds.includes(t.status));
          return (
            <div
              key={col.key}
              style={{
                background: "var(--field)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-surface)",
                padding: 10,
                minHeight: 220,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 7, padding: "2px 4px 8px" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--muted2)",
                  }}
                >
                  {col.label}
                </span>
                <span className="pms-num" style={{ fontSize: 11, color: "var(--faint)" }}>
                  {cards.length}
                </span>
              </div>

              {cards.length === 0 && (
                <div
                  style={{
                    border: "1px dashed var(--line2)",
                    borderRadius: 10,
                    padding: "14px 12px",
                    fontSize: 11.5,
                    color: "var(--faint)",
                  }}
                >
                  {col.empty(landlord)}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cards.map((t) => {
                  const next = NEXT[t.status];
                  const open = noting === t.id;
                  // This ticket only: a shared pending relabelled every card
                  // on the board at once.
                  const busy = advance.isPending && advance.variables?.ticketId === t.id;
                  return (
                    <div
                      key={t.id}
                      style={{
                        background: "var(--card)",
                        border: "1px solid var(--card-bd)",
                        borderRadius: 12,
                        overflow: "hidden",
                        opacity: col.key === "resolved" ? 0.72 : 1,
                      }}
                    >
                      <div style={{ padding: "11px 12px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                          {t.title}
                        </div>
                        <div style={{ marginTop: 3, fontSize: 11, color: "var(--muted)" }}>
                          {[
                            t.unitLabel,
                            t.raisedByName,
                            dshortIso(t.createdAt),
                            t.noteCount > 0 ? `${t.noteCount} note${t.noteCount === 1 ? "" : "s"}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                        {t.description && (
                          <div
                            style={{
                              marginTop: 6,
                              fontSize: 11.5,
                              color: "var(--muted)",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {t.description}
                          </div>
                        )}

                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                          <Badge intent={PRIORITY_INTENT[t.priority] ?? "neutral"}>
                            {t.priority}
                          </Badge>
                          {t.category && <Badge intent="neutral">{t.category}</Badge>}
                          <span style={{ flex: 1 }} />
                          {next && !open && (
                            <Button
                              variant="ghost"
                              onClick={() => {
                                if (denied) return;
                                setNoting(t.id);
                                setNote("");
                              }}
                              aria-disabled={denied ? true : undefined}
                              title={denied}
                              style={{
                                border: "1px solid var(--card-bd)",
                                background: "var(--panel)",
                                color: "var(--foreground)",
                                borderRadius: 9,
                                padding: "6px 11px",
                                fontSize: 11.5,
                                fontWeight: 600,
                                cursor: denied ? "not-allowed" : "pointer",
                                opacity: denied ? 0.5 : 1,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {next.label}
                            </Button>
                          )}
                        </div>

                        {next && open && (
                          <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 7 }}>
                            <Input
                              autoFocus
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") submit(t, next.to);
                                if (e.key === "Escape") setNoting(null);
                              }}
                              placeholder={NOTE_PROMPT[next.to] ?? "Add a note"}
                              aria-label={NOTE_PROMPT[next.to] ?? "Add a note"}
                              maxLength={1000}
                              style={{
                                minHeight: 36,
                                border: "1.5px solid var(--line2)",
                                background: "var(--field)",
                                color: "var(--foreground)",
                                borderRadius: 9,
                                padding: "0 10px",
                                fontSize: 12,
                                width: "100%",
                              }}
                            />
                            <div style={{ display: "flex", gap: 6 }}>
                              <Button
                                variant="ghost"
                                onClick={() => setNoting(null)}
                                style={{
                                  border: "1px solid var(--card-bd)",
                                  background: "var(--panel)",
                                  color: "var(--muted)",
                                  borderRadius: 9,
                                  padding: "6px 11px",
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => submit(t, next.to)}
                                aria-disabled={!note.trim() || busy ? true : undefined}
                                style={{
                                  flex: 1,
                                  border: "none",
                                  background: "var(--accent)",
                                  color: "var(--accent-ink)",
                                  borderRadius: 9,
                                  padding: "6px 11px",
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  cursor: !note.trim() || busy ? "not-allowed" : "pointer",
                                  opacity: !note.trim() || busy ? 0.5 : 1,
                                }}
                              >
                                {busy ? "Saving" : next.label}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
