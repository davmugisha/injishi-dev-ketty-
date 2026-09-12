"use client";

/**
 * The officer's queue — Verification for a field verifier, Approval for an
 * approver. One component, because the difference is which stage the officer
 * `actsOn`, not what the screen looks like.
 *
 * Three rules the screen enforces rather than describes:
 *  - **Scope is a boundary.** A file outside the officer's district is absent,
 *    not greyed out. Karongi and Kicukiro files never appear here.
 *  - **Separation of duties.** An approver cannot approve what they themselves
 *    field-verified; the action is disabled and says why.
 *  - **Rejection is recoverable.** It needs a reason code from
 *    `RegistrationRejectionReason`, so the registrant is never told merely "no".
 */

import { useState } from "react";
import { ScrollShadow } from "@heroui/react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@injishi/ui";
import { useConsole } from "../store";
import { CLASS_LABEL } from "../data/oversight";
import type { RegOrg } from "../data/types";
import { ActionButton, Badge, EmptyState, Initials, Skeleton, StatCard, surfaceClass } from "../components/ui";
import { ConfirmAction } from "../../components/confirm-action";
// The failed-read state is the operator app's, not a second copy: the console
// and the desk owe a person the same three things when a read does not answer.
import { LoadFailed } from "../../components/ui";
import { Icon } from "../components/icon";
import { cn } from "@/lib/utils";

const COLS = "minmax(180px,1.6fr) minmax(90px,.8fr) minmax(130px,1.1fr) minmax(150px,1.2fr) minmax(70px,.6fr) auto";

/** Past 48 h a file has been waiting too long, and the row has to say so. */
function ageOf(o: RegOrg) {
  return o.ageH >= 24 ? `${Math.floor(o.ageH / 24)}d` : `${o.ageH}h`;
}

/** A document gap the officer should see before they open the file. */
function flagOf(o: RegOrg): string | null {
  if (o.type === "host" && !o.tourismLic) return "No tourism license";
  if (o.type === "host" && o.rha === false) return "Not an RHA member";
  if (o.type === "landlord" && !o.upi) return "No land plot (UPI)";
  if (o.docs.length < 2) return "Missing documents";
  return null;
}

export function OfficerQueue() {
  const { oversight, officer, actOn, reject, queueLoading, queueError, refetchQueue, acting } =
    useConsole();
  const [typeFilter, setTypeFilter] = useState<"all" | "host" | "landlord">("all");
  const [q, setQ] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");

  if (!officer) return null;

  // The API already scoped the queue to this officer's region and stage.
  const inScope = oversight.orgs;
  const query = q.trim().toLowerCase();
  const rows = inScope
    .filter((o) => typeFilter === "all" || o.type === typeFilter)
    .filter((o) => !query || `${o.biz} ${o.owner ?? ""}`.toLowerCase().includes(query))
    .sort((a, b) => b.ageH - a.ageH);

  const sel = oversight.orgs.find((o) => o.id === selId) ?? null;
  const verifying = officer.fn === "business_field_verifier";
  // The one thing the console will not let an officer do.
  const sameOfficer =
    !verifying &&
    (sel?.blockedBySeparationOfDuties === true || sel?.fieldVerifiedBy === "you");

  const filtered = rows.length === 0 && inScope.length > 0;

  const closeReject = () => {
    setRejecting(null);
    setReason(null);
    setNote("");
  };

  const confirmReject = () => {
    if (!rejecting || !reason || acting) return;
    // Closed by the ANSWER, not by the press. The registrant is told a reason
    // they will act on; the officer has to know it was actually recorded.
    reject(rejecting, reason, note, () => {
      closeReject();
      setSelId(null);
    });
  };

  if (queueLoading) {
    return (
      <div className="pms-enter flex flex-col gap-4" aria-busy>
        <span className="text-sm text-muted-foreground">Opening your queue</span>
        <Skeleton height={74} />
        <Skeleton height={240} delay={80} />
      </div>
    );
  }

  if (queueError) {
    return (
      <LoadFailed onRetry={() => refetchQueue()}>
        We couldn&apos;t load your queue. Every file waiting on you is still waiting —
        this is on our side, not an empty queue.
      </LoadFailed>
    );
  }

  return (
    <div className="pms-enter flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard n={String(inScope.length)} label={`Awaiting your ${verifying ? "verification" : "approval"}`} />
        <StatCard n={String(inScope.filter((o) => o.ageH >= 48).length)} label="Waiting over 48 hours" />
        <StatCard n={String(inScope.filter((o) => o.type === "host").length)} label="Hospitality files" />
        <StatCard n={String(inScope.filter((o) => o.type === "landlord").length)} label="Residence files" />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {(["all", "host", "landlord"] as const).map((f) => (
          <Button
            key={f}
            variant="outline"
            onClick={() => setTypeFilter(f)}
            className={cn(
              "h-9 rounded-full border-[1.5px] px-4 text-sm font-semibold capitalize",
              typeFilter === f
                ? "border-accent-text bg-accent-soft text-accent-text hover:bg-accent-soft"
                : "border-card-bd bg-card text-ink2 hover:bg-hover",
            )}
          >
            {f}
          </Button>
        ))}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search business or owner"
          className="h-9 max-w-tile border-line2 bg-field text-sm rounded"
        />
        <span className="flex-1" />
        <span className="pms-num text-xs text-muted-foreground">
          {rows.length} in queue
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState className="flex flex-col items-center gap-2 p-9 text-center">
          <Icon name="inbox" size={24} strokeWidth={1.6} />
          <span className="text-base font-semibold text-ink">
            {filtered ? "No matches" : "All clear"}
          </span>
          <span className="max-w-form text-sm text-muted-foreground">
            {filtered
              ? `Nothing in your queue matches ${query ? `“${q.trim()}”` : "that filter"}. Clear the search or filter to see the full queue.`
              : `No businesses are awaiting your ${verifying ? "verification" : "approval"} right now. New ones appear here the moment they reach your stage.`}
          </span>
        </EmptyState>
      ) : (
        <div className={cn(surfaceClass, "scrollbar overflow-x-auto")}>
          <div className="min-w-[860px]">
            <div
              className="grid gap-2.5 border-b border-line px-[18px] py-[11px] text-2xs font-bold tracking-[0.05em] uppercase text-[var(--muted2)]"
              style={{ gridTemplateColumns: COLS }}
            >
              <span>Business</span>
              <span>Type</span>
              <span>Location</span>
              <span>TIN · RRA</span>
              <span>In queue</span>
              <span />
            </div>
            {rows.map((o, i) => {
              const flag = flagOf(o);
              return (
                <Button variant="ghost"
                  key={o.id}
                  onClick={() => setSelId(o.id)}
                  className={cn(
                    "grid w-full items-center gap-2.5 px-[18px] py-3 text-left transition-colors hover:bg-hover",
                    i === 0 ? "border-t border-transparent" : "border-t border-line",
                  )}
                  style={{ gridTemplateColumns: COLS }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{o.biz}</span>
                    <span className="block truncate text-2xs text-muted-foreground">{o.owner ?? "You"}</span>
                  </span>
                  <span>
                    <Badge intent={o.type === "host" ? "accent" : "info"}>
                      {o.type === "host" ? "Host" : "Landlord"}
                    </Badge>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink2">{o.sector}</span>
                    <span className="block text-2xs text-muted-foreground">{o.district} District</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge intent={o.tinOk ? "ok" : "bad"}>{o.tinOk ? "Verified" : "Mismatch"}</Badge>
                    {flag && o.tinOk && <Badge intent="warn">{flag}</Badge>}
                  </span>
                  <span
                    className={cn(
                      "pms-num text-sm",
                      o.ageH >= 48 ? "font-bold text-warn" : "text-muted-foreground",
                    )}
                  >
                    {ageOf(o)}
                  </span>
                  <span className="text-muted-foreground">
                    <Icon name="chevron-right" size={18} />
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-2xs text-muted-foreground">
        Your queue is bounded by the district your assignment covers. Files elsewhere belong to the
        officer for that jurisdiction — they never appear here.
      </p>

      <Sheet open={!!sel} onOpenChange={(open) => !open && setSelId(null)}>
        <SheetContent className="w-full gap-0 scrollbar overflow-y-auto border-panel-bd bg-panel sm:max-w-narrow">
          {sel && (
            <>
              <SheetHeader className="gap-2 border-b border-line">
                <SheetTitle className="pms-display text-xl font-bold text-ink">{sel.biz}</SheetTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge intent={sel.type === "host" ? "accent" : "info"}>
                    {sel.type === "host" ? "Host" : "Landlord"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {sel.sector}, {sel.district} District · in queue {ageOf(sel)}
                  </span>
                </div>
              </SheetHeader>

              <div className="flex flex-col gap-5 px-4 py-4">
                {/* ONLY WHAT THE FILE ACTUALLY SAYS. This block used to fall
                    back to "Rayan Iraguha" for an owner the queue did not name,
                    print a masked NID the wire does not carry, and stamp every
                    file "KYC verified" whether or not anybody had checked one.
                    An officer approving a business on the strength of a badge
                    nothing produced is the failure this console exists to
                    prevent. */}
                <section className="flex items-center gap-3">
                  <Initials size={40}>
                    {sel.owner
                      ? sel.owner
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                      : "—"}
                  </Initials>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {sel.owner ?? "Owner not on this file"}
                    </span>
                    <span className="block text-2xs text-muted-foreground">
                      Identity documents are checked outside this console.
                    </span>
                  </span>
                </section>

                {sel.obo && (
                  <div className="border border-warn-bg bg-warn-bg px-3.5 py-2.5 text-xs text-warn rounded">
                    Registered by an agent. Payouts stay locked until {sel.owner ?? "the owner"} claims the business.
                  </div>
                )}

                <section className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">TIN</span>
                    <span className="flex items-center gap-2">
                      <span className="pms-num text-sm font-semibold text-ink">{sel.tin}</span>
                      <Badge intent={sel.tinOk ? "ok" : "bad"}>
                        {sel.tinOk ? "Matches RRA register" : "Does not match"}
                      </Badge>
                    </span>
                  </div>
                  <Fact k="Type & class" v={`${sel.type === "host" ? "Host" : "Landlord"} · ${CLASS_LABEL[sel.cls] ?? sel.cls}`} />
                  {sel.type === "host" && <Fact k="Tourism license" v={sel.tourismLic ?? "—"} />}
                  {sel.type === "host" && <Fact k="RHA member" v={sel.rha ? "Yes" : "No"} />}
                  {sel.type === "host" && !!sel.star && <Fact k="EAC grade" v={`${sel.star} star`} />}
                  {sel.type === "landlord" && <Fact k="Land plot (UPI)" v={sel.upi ?? "—"} />}
                  <Fact k="Address" v={`${sel.address}, ${sel.sector}, ${sel.district}`} />
                </section>

                <section>
                  <div className="text-2xs font-bold tracking-[0.09em] uppercase text-[var(--muted2)]">
                    Documents
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    {sel.docs.map(([name, kind]) => (
                      <div
                        key={name}
                        className="flex items-center gap-2.5 rounded border border-line2 bg-field px-3 py-2.5"
                      >
                        <Icon name="file-text" size={17} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-ink">{name}</span>
                          <span className="block text-2xs text-muted-foreground">{kind}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="text-2xs font-bold tracking-[0.09em] uppercase text-[var(--muted2)]">
                    Audit trail
                  </div>
                  <div className="mt-2 flex flex-col gap-2 text-xs">
                    <Trail label="Submitted" meta={sel.submittedTs} />
                    {/* The RRA line used to read "TIN verified with RRA" on
                        every file, including the ones whose TIN did NOT match —
                        directly contradicting the badge three rows above it. It
                        reports the check's actual answer. */}
                    <Trail
                      label={sel.tinOk ? "TIN matched the RRA register" : "TIN did not match the RRA register"}
                      meta="automatic check"
                    />
                    {sel.fieldVerifiedBy && <Trail label="Field-verified" meta={`by ${sel.fieldVerifiedBy}`} />}
                  </div>
                </section>

                {sameOfficer && (
                  <div className="flex items-start gap-2.5 border border-info bg-info-bg px-3.5 py-3 text-xs text-info rounded">
                    <Icon name="git-fork" size={16} />
                    <span>
                      You field-verified this business — a different officer must approve it. This keeps one person
                      from checking and approving their own work.
                    </span>
                  </div>
                )}

                {/* PASSING A GATE IS FINAL, so it asks once — and the sheet
                    stays open until the server has agreed. It used to close on
                    the press, so an officer saw the file vanish and then read a
                    refusal about a business no longer on screen; worse, a
                    second press during the wait sent the decision twice. */}
                <div className="flex flex-wrap gap-2.5">
                  <ConfirmAction
                    variant="primary"
                    tone="primary"
                    className="h-11"
                    fullWidth
                    disabled={sameOfficer}
                    pending={acting}
                    onConfirm={() => actOn(sel.id, () => setSelId(null))}
                    confirmLabel={`Yes, ${officer.act.toLowerCase()}`}
                  >
                    {acting ? "Recording your decision" : officer.act}
                  </ConfirmAction>
                  <ActionButton className="h-11" onClick={() => setRejecting(sel.id)}>
                    Reject
                  </ActionButton>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* It cannot be dismissed while the rejection is in flight: a dialog that
          vanishes mid-write leaves its outcome arriving with nothing on screen
          to explain it. */}
      <Dialog open={!!rejecting} onOpenChange={(open) => !open && !acting && closeReject()}>
        <DialogContent className="border-panel-bd bg-panel sm:max-w-narrow">
          <DialogHeader>
            <DialogTitle className="pms-display text-lg font-bold text-ink">
              Reject {oversight.orgs.find((o) => o.id === rejecting)?.biz}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Pick the reason the registrant will see. They fix it and resubmit into the same slot — a rejection is
              never a dead end.
            </DialogDescription>
          </DialogHeader>

          <ScrollShadow className="flex max-h-[46vh] flex-col gap-2 scrollbar overflow-y-auto">
            {oversight.rejectReasons.map(([code, label, desc]) => {
              const on = reason === code;
              return (
                <Button variant="ghost"
                  key={code}
                  onClick={() => setReason(code)}
                  className={cn(
                    "flex items-start gap-2.5 rounded border px-3.5 py-2.5 text-left",
                    on ? "border-accent-text bg-accent-soft" : "border-line2 bg-field hover:bg-hover",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 size-4 shrink-0 rounded-full border-2",
                      on ? "border-accent-text bg-primary" : "border-line2",
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{label}</span>
                    {desc && <span className="block text-2xs text-muted-foreground">{desc}</span>}
                  </span>
                </Button>
              );
            })}
          </ScrollShadow>

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note for the registrant (optional)"
            className="min-h-[76px] border-line2 bg-field text-sm rounded"
          />

          <DialogFooter>
            <ActionButton className="h-11" onClick={closeReject}>
              Cancel
            </ActionButton>
            <Button
              disabled={!reason}
              pending={acting}
              onClick={confirmReject}
              className="h-11 bg-destructive px-5 text-sm font-bold text-destructive-foreground hover:bg-destructive/90 disabled:bg-field disabled:text-muted-foreground rounded"
            >
              {acting ? "Recording the rejection" : "Reject with reason"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted-foreground">{k}</span>
      <span className="text-right text-sm font-medium text-ink">{v}</span>
    </div>
  );
}

function Trail({ label, meta }: { label: string; meta: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="size-2 shrink-0 rounded-full bg-primary" />
      <span className="flex-1 font-medium text-ink">{label}</span>
      <span className="text-muted-foreground">{meta}</span>
    </div>
  );
}
