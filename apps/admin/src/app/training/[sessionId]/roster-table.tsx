"use client";

import type { TrainingRosterEntry } from "@injishi/contracts";
import { Badge, Button, Input, Label } from "@injishi/ui";
import { useState, useTransition } from "react";

import {
  addWalkIn,
  closeRoster,
  markAttendance,
  revokeCertificate,
} from "@/lib/actions/training";
import { useAdminUi } from "@/lib/store";

/**
 * The roster, and the tick (ADR-049 AC-9, AC-10, AC-11, AC-22).
 *
 * FOUR WRITES, and each is worded so a trainer can tell what it did:
 *
 * PRESENT issues a certificate. The toast names the serial, and on a replay it
 * says the certificate already existed rather than claiming a new one, because
 * the action derives a stable idempotency key and the API returns the first
 * answer. A trainer on a bad connection tapping twice must not believe two
 * certificates exist.
 *
 * ABSENT issues nothing, and does NOT delete a certificate already issued
 * (AC-11, AC-23). Both decisions stay on record and the later one wins. Taking
 * a credential away is a separate, named act with a reason, which is the
 * Withdraw button.
 *
 * CLOSE ROSTER marks everybody undecided absent in one action and issues
 * nothing. It is the last thing a trainer does, and it is deliberately not
 * automatic: "that is everyone who came" is a judgement, not a timeout.
 *
 * WITHDRAW needs a reason, which goes to the audit log. The public page for
 * that certificate says withdrawn from the very next load.
 *
 * THE DECISION COUNT IS SHOWN, not just the latest decision. A trainer who
 * corrected a mistake should be able to see that both marks are on record, so
 * they do not wonder whether the first one registered at all.
 */
export function RosterTable({
  sessionId,
  rows,
  total,
  rosterClosed,
}: {
  sessionId: string;
  rows: TrainingRosterEntry[];
  total: number;
  rosterClosed: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showWalkIn, setShowWalkIn] = useState(false);
  const toast = useAdminUi((state) => state.toast);

  function tick(row: TrainingRosterEntry, decision: "present" | "absent") {
    startTransition(async () => {
      const out = await markAttendance(row.registrationId, decision);
      toast(`${row.fullName}: ${out.message}`, out.tone);
    });
  }

  function close() {
    startTransition(async () => {
      const out = await closeRoster(sessionId);
      toast(out.message, out.tone);
    });
  }

  function withdraw(row: TrainingRosterEntry) {
    if (!row.certificateId) return;
    const certificateId = row.certificateId;
    startTransition(async () => {
      const out = await revokeCertificate(certificateId, reason);
      toast(`${row.fullName}: ${out.message}`, out.tone);
      if (out.ok) {
        setRevoking(null);
        setReason("");
      }
    });
  }

  const decided = rows.filter((row) => row.latestDecision !== null).length;

  return (
    <section className="mt-8" aria-label="Roster">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {rows.length.toLocaleString("en-RW")} on the loaded page
          {total > rows.length
            ? `, ${total.toLocaleString("en-RW")} in total`
            : ""}
          {" · "}
          {decided.toLocaleString("en-RW")} decided
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowWalkIn((open) => !open)}
            disabled={rosterClosed}
          >
            {showWalkIn ? "Cancel" : "Add a walk-in"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={close}
            disabled={pending || rosterClosed}
          >
            {rosterClosed ? "Roster closed" : "Close the roster"}
          </Button>
        </div>
      </div>

      {showWalkIn ? (
        <WalkInForm
          sessionId={sessionId}
          onDone={() => setShowWalkIn(false)}
        />
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Nobody has registered for this session yet. A trainer can still add
          somebody who turns up on the day.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[60rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <Th>Who</Th>
                <Th>Business</Th>
                <Th>Standing</Th>
                <Th>Certificate</Th>
                <Th>Record attendance</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.registrationId} className="border-b border-border">
                  <Td>
                    <span className="font-medium">{row.fullName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {row.email}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {row.phone}
                      {row.source === "walk_in" ? " · walk-in" : ""}
                    </span>
                  </Td>
                  <Td>
                    {row.businessName ?? (row.orgId ? "On Injishi" : "—")}
                  </Td>
                  <Td>
                    <Badge variant={STATUS_TONE[row.status]}>
                      {STATUS_LABEL[row.status]}
                    </Badge>
                    {row.decisionCount > 1 ? (
                      <span className="block text-xs text-muted-foreground">
                        {row.decisionCount} decisions on record, latest wins
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    {row.certificateId === null ? (
                      <span className="text-xs text-muted-foreground">
                        none
                      </span>
                    ) : (
                      <>
                        <span className="block font-mono text-xs">
                          {row.certificateSerial}
                        </span>
                        {row.certificateRevokedAt ? (
                          <Badge variant="danger">Withdrawn</Badge>
                        ) : revoking === row.registrationId ? (
                          <div className="mt-2 max-w-form">
                            <Label htmlFor={`reason-${row.registrationId}`}>
                              Why is it being withdrawn?
                            </Label>
                            <Input
                              id={`reason-${row.registrationId}`}
                              value={reason}
                              onChange={(event) =>
                                setReason(event.target.value)
                              }
                              placeholder="Recorded in the audit log"
                            />
                            <div className="mt-2 flex gap-2">
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => withdraw(row)}
                                disabled={pending || reason.trim().length < 3}
                              >
                                Withdraw it
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setRevoking(null);
                                  setReason("");
                                }}
                              >
                                Keep it
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRevoking(row.registrationId)}
                          >
                            Withdraw
                          </Button>
                        )}
                      </>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => tick(row, "present")}
                        disabled={pending || rosterClosed}
                      >
                        Present
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => tick(row, "absent")}
                        disabled={pending || rosterClosed}
                      >
                        Absent
                      </Button>
                    </div>
                    {row.latestDecisionAt ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        last decided {formatWhen(row.latestDecisionAt)}
                      </span>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Add somebody who turned up without registering (AC-8).
 *
 * THE E-MAIL IS THE ONE FIELD THAT MATTERS MOST. It is matched against existing
 * accounts, so getting it right is what puts the certificate on the identity
 * the person can actually sign in to. The form says so, because a trainer
 * typing quickly at a door has no other reason to care about the spelling.
 */
function WalkInForm({
  sessionId,
  onDone,
}: {
  sessionId: string;
  onDone: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+250");
  const [businessName, setBusinessName] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useAdminUi((state) => state.toast);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const out = await addWalkIn(sessionId, {
        fullName,
        email,
        phone,
        businessName,
      });
      toast(`${fullName || "Walk-in"}: ${out.message}`, out.tone);
      if (out.ok) {
        setFullName("");
        setEmail("");
        setPhone("+250");
        setBusinessName("");
        onDone();
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 max-w-page rounded-card border border-border bg-field p-5"
    >
      <p className="text-sm font-semibold">Add somebody who turned up</p>
      <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
        If that e-mail already has an Injishi account, they are added to it
        rather than getting a second one. Otherwise an account is created with no
        password and they claim it with the usual e-mail code.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="walkin-name">Full name</Label>
          <Input
            id="walkin-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="walkin-email">E-mail</Label>
          <Input
            id="walkin-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="walkin-phone">Phone</Label>
          <Input
            id="walkin-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="walkin-business">Business</Label>
          <Input
            id="walkin-business"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            required
          />
        </div>
      </div>

      <Button type="submit" size="sm" className="mt-4" disabled={pending}>
        {pending ? "Adding…" : "Add to the roster"}
      </Button>
    </form>
  );
}

const STATUS_LABEL: Record<TrainingRosterEntry["status"], string> = {
  registered: "Registered",
  attended: "Attended",
  absent: "Absent",
  withdrawn: "Withdrew",
  released: "Released",
};

const STATUS_TONE: Record<
  TrainingRosterEntry["status"],
  "subtle" | "success" | "warning" | "light"
> = {
  registered: "subtle",
  attended: "success",
  absent: "warning",
  withdrawn: "light",
  released: "light",
};

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-RW", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Africa/Kigali",
  }).format(new Date(iso));
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3 align-top">{children}</td>;
}
