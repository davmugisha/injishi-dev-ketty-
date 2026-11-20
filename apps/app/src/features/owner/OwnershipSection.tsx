"use client";

import { Check, Clock, ShieldCheck, ShieldKeyhole } from "@gravity-ui/icons";
import { Avatar, Button, Card, Chip } from "@heroui/react";
import type { TeamRolesMember } from "@injishi/data/fixtures/owner";
import { toneColor } from "@injishi/ui";
import { useEffect, useState } from "react";
import type { OwnershipTransferInfo } from "@/server/ownership-transfer";
import { kigaliDay, OWNER_PRIVILEGES, timeLeft } from "./ownership-model";

/**
 * Setup → Team → Ownership: who owns the business, what the owner can do, and, kept apart as the one sensitive
 * action on this page, handing the business to someone else. Display only: the transfer itself is asked for and
 * decided by the API (`TeamRolesTransfer`), and only the owner sees the button (the API refuses anyone else too).
 */
export function OwnershipSection({
  owner,
  viewerIsOwner,
  waiting,
  eligibleCount,
  onOpenTransfer,
}: {
  owner: TeamRolesMember | undefined;
  viewerIsOwner: boolean;
  /** The request waiting for an answer (the owner's view only: the API tells nobody else). */
  waiting: OwnershipTransferInfo | null;
  eligibleCount: number;
  onOpenTransfer: () => void;
}) {
  // The "days left" of a waiting request, read after the page is on screen (the server's clock is not the viewer's).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  return (
    <section aria-labelledby="own-h" data-ui="ownership-section">
      <Card className="gap-0 overflow-hidden rounded-[20px] border border-separator p-0 shadow-none">
        <div className="flex flex-col gap-1 px-5 pt-5 pb-4 sm:px-6">
          <h2 id="own-h" className="flex items-center gap-2 text-[17px] leading-6 font-semibold">
            <ShieldCheck className="size-5 text-accent" aria-hidden="true" />
            Business ownership
          </h2>
          <p className="max-w-[640px] text-[13.5px] leading-5 text-muted" data-ui="ownership-text">
            The owner is the person ultimately responsible for this business on Injishi. There is always exactly one
            owner.
          </p>
        </div>

        <div className="grid gap-4 border-t border-separator px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          {/* Who owns it now. */}
          <div className="flex flex-col gap-2" data-ui="ownership-current">
            <p className="text-[12px] font-medium tracking-wide text-muted uppercase">Current owner</p>
            <div className="flex items-center gap-3 rounded-2xl bg-surface-secondary p-3.5">
              <Avatar size="md" variant="soft" color={owner ? toneColor(owner.avatarTone) : "default"}>
                <Avatar.Fallback>{owner?.initials ?? "?"}</Avatar.Fallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-[15px] font-semibold">{owner?.name ?? "Not known"}</span>
                  {viewerIsOwner ? (
                    <Chip size="sm" variant="soft" color="accent">
                      You
                    </Chip>
                  ) : null}
                </span>
                {owner?.contact ? <span className="truncate text-[13px] text-muted">{owner.contact}</span> : null}
              </div>
              <Chip size="sm" variant="soft" color="success" className="shrink-0">
                Owner
              </Chip>
            </div>
          </div>

          {/* What that means. */}
          <div className="flex flex-col gap-2">
            <p className="text-[12px] font-medium tracking-wide text-muted uppercase">What the owner can do</p>
            <ul className="grid gap-2 sm:grid-cols-2" data-ui="ownership-privileges">
              {OWNER_PRIVILEGES.map((p) => (
                <li key={p.title} className="flex gap-2.5 rounded-xl border border-separator px-3 py-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span className="text-[13.5px] font-medium">{p.title}</span>
                    <span className="text-[12.5px] leading-[18px] text-muted">{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* The sensitive action, set apart from the everyday team actions above it. */}
        <div
          className="flex flex-col gap-3 border-t border-separator bg-[color-mix(in_oklab,var(--danger)_4%,transparent)] px-5 py-5 sm:px-6"
          data-ui="ownership-transfer-zone"
        >
          {waiting ? (
            <div className="flex flex-col gap-3" data-ui="ownership-waiting">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-[1_1_320px] gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning-soft-foreground">
                    <Clock className="size-4" aria-hidden="true" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h3 className="text-[15px] font-semibold">Transfer waiting for {waiting.toName}</h3>
                    <p className="text-[13px] leading-5 text-muted">
                      You are still the owner. Nothing changes unless {waiting.toName} accepts before{" "}
                      {kigaliDay(waiting.expiresAt)}
                      {now !== null ? ` (${timeLeft(waiting.expiresAt, now)})` : ""}. You would then become{" "}
                      {waiting.previousOwnerRoleLabel}.
                    </p>
                  </div>
                </div>
                {viewerIsOwner ? (
                  <Button variant="secondary" onPress={onOpenTransfer} data-ui="ownership-open">
                    <ShieldKeyhole className="size-4" aria-hidden="true" />
                    View or cancel
                  </Button>
                ) : null}
              </div>
              <ol className="grid gap-2 text-[12.5px] sm:grid-cols-3" aria-label="Transfer progress">
                <Stage done label="Requested" detail={`By you on ${kigaliDay(waiting.requestedAt)}`} />
                <Stage current label={`Waiting for ${waiting.toName}`} detail="They accept with a code we email them" />
                <Stage label="Ownership moves" detail={`${waiting.toName} becomes the owner`} />
              </ol>
            </div>
          ) : viewerIsOwner ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-0.5">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                  <ShieldKeyhole className="size-4 text-danger" aria-hidden="true" />
                  Transfer ownership
                </h3>
                <p className="text-[13px] leading-5 text-muted">
                  Hand the business to another member of your team, for example when you sell it or step back. Nothing
                  changes until they accept, and you can cancel until then.
                  {eligibleCount === 0
                    ? " Nobody on the team can receive it yet: they must be active and have verified their identity."
                    : ` ${eligibleCount} team member${eligibleCount === 1 ? " is" : "s are"} able to receive it.`}
                </p>
              </div>
              <Button variant="danger-soft" onPress={onOpenTransfer} data-ui="ownership-open">
                <ShieldKeyhole className="size-4" aria-hidden="true" />
                Transfer ownership
              </Button>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-[13px] text-muted" data-ui="ownership-owner-only">
              <ShieldKeyhole className="size-4 shrink-0" aria-hidden="true" />
              Only {owner?.name ?? "the owner"} can transfer ownership of this business.
            </p>
          )}
        </div>
      </Card>
    </section>
  );
}

function Stage({
  label,
  detail,
  done = false,
  current = false,
}: {
  label: string;
  detail: string;
  done?: boolean;
  current?: boolean;
}) {
  return (
    <li
      aria-current={current ? "step" : undefined}
      className={`flex flex-col gap-0.5 rounded-xl border px-3 py-2 ${
        current ? "border-warning/60 bg-surface" : done ? "border-success/40 bg-surface" : "border-separator"
      }`}
    >
      <span className="flex items-center gap-1.5 font-semibold">
        {done ? (
          <Check className="size-3.5 text-success" aria-hidden="true" />
        ) : current ? (
          <Clock className="size-3.5 text-warning" aria-hidden="true" />
        ) : (
          <span className="size-3.5 rounded-full border border-separator" aria-hidden="true" />
        )}
        {label}
      </span>
      <span className="text-muted">{detail}</span>
    </li>
  );
}
