"use client";

import { Check, Eye, Receipt, Xmark } from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Label,
  Pagination,
  Popover,
  Skeleton,
  TextArea,
  TextField,
  toast,
} from "@heroui/react";
import { EmptyState, Segment } from "@heroui-pro/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { PayClaimView } from "../../model/payroll.ts";
import { useHrActions } from "../mount.tsx";
import { avatarColor, firstName, initials } from "../people/parts";
import { openPendingTab } from "./parts";
import { rwf } from "./pay-calc";

type Show = "waiting" | "approved" | "all";
const PAGE = 12;

/** "November" for "2026-11". */
const monthOf = (period: string) =>
  new Date(`${period}-01T12:00:00Z`).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
/** "26 Oct" in Kigali for an ISO instant. */
const dayOf = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Kigali" }).format(new Date(iso));

/** What a claim asks for, in money: the amount, or the days of leave paid out. */
const askOf = (c: PayClaimView) =>
  c.amountRwf !== null ? rwf(c.amountRwf) : c.days !== null ? `${c.days} d ${c.leaveType ?? "leave"}` : "—";

/** Decline with a word why; the person reads it on their phone. */
function DeclineButton({
  c,
  pending,
  onDecline,
}: {
  c: PayClaimView;
  pending: boolean;
  onDecline: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <Popover>
      <Button size="sm" variant="ghost" className="text-danger" isPending={pending}>
        <Xmark className="size-4" />
        Decline
      </Button>
      <Popover.Content placement="bottom end" className="w-[280px] p-3">
        <Popover.Dialog aria-label={`Decline ${firstName(c.name)}'s claim`} className="flex flex-col gap-2">
          <TextField value={note} onChange={setNote} className="flex flex-col gap-1">
            <Label className="text-xs">Why, for {firstName(c.name)}</Label>
            <TextArea rows={2} placeholder="No receipt for the taxi" />
          </TextField>
          <Button size="sm" variant="danger" isPending={pending} onPress={() => onDecline(note.trim())}>
            Decline the claim
          </Button>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

/**
 * Claims: money staff asked back from their phone (and leave they asked paid out). HR follows them
 * here while preparing the month; the owner approves one into the next open month's pay, where it
 * is paid untaxed beside the salary, or declines it with a reason the person reads.
 */
export function ClaimsPanel({ canDecide }: { canDecide: boolean }) {
  const { decidePayClaim, loadClaims, openClaimReceipt } = useHrActions();
  const [claims, setClaims] = useState<PayClaimView[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [show, setShow] = useState<Show>("waiting");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const reload = useCallback(() => {
    loadClaims()
      .then((r) => {
        if (r.ok) {
          setClaims(r.claims);
          setFailure(null);
        } else setFailure(r.error);
      })
      .catch(() => setFailure("Claims could not load. Refresh the page."));
  }, [loadClaims]);
  useEffect(reload, [reload]);

  const decide = (c: PayClaimView, decision: "approve" | "reject", note: string | null) =>
    start(async () => {
      setBusy(c.id);
      const r = await decidePayClaim(c.id, decision, note || null);
      setBusy(null);
      if (r.ok) {
        toast.success(
          decision === "approve"
            ? `${firstName(c.name)}'s ${askOf(c)} approved for the next pay.`
            : `${firstName(c.name)}'s claim is declined.`,
        );
        reload();
      } else toast.danger(r.error);
    });

  const receipt = (c: PayClaimView) => {
    const tab = openPendingTab();
    start(async () => {
      const r = await openClaimReceipt(c.id).catch(() => null);
      if (r?.ok) tab.go(r.url);
      else {
        tab.close();
        toast.danger(r?.error ?? "The receipt could not be opened. Try again.");
      }
    });
  };

  const all = claims ?? [];
  const waiting = all.filter((c) => c.status === "requested");
  const approved = all.filter((c) => c.status === "approved");
  const list = show === "waiting" ? waiting : show === "approved" ? approved : all;
  const owed = waiting.reduce((t, c) => t + (c.amountRwf ?? 0), 0);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const at = Math.min(page, pages);

  return (
    <section className="flex flex-col gap-[10px]" aria-labelledby="cl-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="cl-h" className="flex items-center gap-2 text-[15px] leading-[22px] font-semibold">
          Claims
          {waiting.length ? (
            <Chip size="sm" variant="soft" color="warning">
              {waiting.length} waiting · {rwf(owed)}
            </Chip>
          ) : null}
        </h2>
        <Segment
          aria-label="Show claims"
          size="sm"
          selectedKey={show}
          onSelectionChange={(k) => {
            setShow(k as Show);
            setPage(1);
          }}
        >
          <Segment.Item id="waiting">Waiting {waiting.length}</Segment.Item>
          <Segment.Item id="approved">
            <Segment.Separator />
            Approved {approved.length}
          </Segment.Item>
          <Segment.Item id="all">
            <Segment.Separator />
            All
          </Segment.Item>
        </Segment>
      </div>

      <Card className="gap-0 overflow-hidden p-0">
        {failure ? (
          <p className="p-4 text-sm text-danger">{failure}</p>
        ) : claims === null ? (
          <div className="flex flex-col gap-2 p-3" aria-busy="true">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-12 rounded-xl" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState size="sm" className="py-8">
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <Receipt />
              </EmptyState.Media>
              <EmptyState.Title>{show === "waiting" ? "No claim is waiting" : "No claims"}</EmptyState.Title>
            </EmptyState.Header>
          </EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-separator">
            {list.slice((at - 1) * PAGE, at * PAGE).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="flex min-w-[180px] flex-[1_1_180px] items-center gap-2.5">
                  <Avatar size="sm" variant="soft" color={avatarColor(c.name)} className="shrink-0">
                    <Avatar.Fallback>{initials(c.name)}</Avatar.Fallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-semibold">{c.name}</span>
                    <span className="truncate text-xs text-muted">
                      {c.title ?? "Staff"} · asked {dayOf(c.createdAt)}
                    </span>
                  </span>
                </span>
                <span className="flex min-w-[160px] flex-[2_1_200px] items-center gap-2">
                  <span className="min-w-0 truncate text-[13px]">{c.reason}</span>
                  {c.hasReceipt ? (
                    <Button size="sm" variant="ghost" className="shrink-0" onPress={() => receipt(c)}>
                      <Eye className="size-4" />
                      Receipt
                    </Button>
                  ) : (
                    <Chip size="sm" variant="soft" className="shrink-0">
                      No receipt
                    </Chip>
                  )}
                </span>
                <span className="w-[110px] text-right text-[15px] font-semibold tabular">{askOf(c)}</span>
                <span className="flex min-w-[190px] flex-[0_0_auto] items-center justify-end gap-1.5">
                  {c.status === "requested" ? (
                    canDecide ? (
                      <>
                        <DeclineButton c={c} pending={busy === c.id} onDecline={(note) => decide(c, "reject", note)} />
                        <Button size="sm" isPending={busy === c.id} onPress={() => decide(c, "approve", null)}>
                          <Check className="size-4" />
                          Approve
                        </Button>
                      </>
                    ) : (
                      <Chip size="sm" variant="soft" color="warning">
                        Waiting for approval
                      </Chip>
                    )
                  ) : c.status === "approved" ? (
                    <Chip size="sm" variant="soft" color="success">
                      {c.paid ? `Paid in ${monthOf(c.period)}` : `With ${monthOf(c.period)} pay`}
                    </Chip>
                  ) : c.status === "rejected" ? (
                    <Chip size="sm" variant="soft" color="danger">
                      Declined{c.decisionNote ? ` · ${c.decisionNote}` : ""}
                    </Chip>
                  ) : (
                    <Chip size="sm" variant="soft">
                      Withdrawn
                    </Chip>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 ? (
          <Pagination
            size="sm"
            className="flex flex-wrap items-center justify-between gap-2 border-t border-separator p-3"
          >
            <Pagination.Summary className="text-xs text-muted tabular">
              {(at - 1) * PAGE + 1}–{Math.min(at * PAGE, list.length)} of {list.length}
            </Pagination.Summary>
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous aria-label="Previous page" isDisabled={at === 1} onPress={() => setPage(at - 1)}>
                  <Pagination.PreviousIcon />
                </Pagination.Previous>
              </Pagination.Item>
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <Pagination.Item key={n}>
                  <Pagination.Link
                    isActive={n === at}
                    aria-label={`Page ${n}`}
                    aria-current={n === at ? "page" : undefined}
                    onPress={() => setPage(n)}
                  >
                    {n}
                  </Pagination.Link>
                </Pagination.Item>
              ))}
              <Pagination.Item>
                <Pagination.Next aria-label="Next page" isDisabled={at === pages} onPress={() => setPage(at + 1)}>
                  <Pagination.NextIcon />
                </Pagination.Next>
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
        ) : null}
      </Card>
    </section>
  );
}
