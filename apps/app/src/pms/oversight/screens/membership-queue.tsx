"use client";

/**
 * The PSF Membership console's queue (ADR-056 AC-10 to AC-14, and the PSF path).
 *
 * The applications waiting on PSF in the officer's own region, oldest first,
 * 25 a page: a district officer reads their district, a country officer the
 * whole country. Each row says who the business is to PSF (its code, its
 * sector, who owns it) and what it asked for, with the amount it chose to pay.
 * Opening one shows the form as filed; the officer approves it (PSF's number;
 * the business then pays) or declines it with a reason the business reads.
 */
import { useCallback, useEffect, useState } from "react";

import { PSF_OWNER_GROUP_SHORT, type PsfQueueItem } from "@injishi/contracts";
import { Button } from "@injishi/ui";
import { formatPrice } from "@injishi/utils";

import { LoadFailed } from "../../components/ui";
import { fetchPsfQueue } from "../../data/psf";
import type { QueuedToast } from "../../lib/toast-queue";
import { ActionButton, Badge, EmptyState, Skeleton, surfaceClass } from "../components/ui";
import { MembershipShell } from "../components/membership-shell";
import { PsfApplicationSheet, shortDate } from "../components/psf-application-sheet";
import { cn } from "@/lib/utils";

export function MembershipQueue() {
  const [items, setItems] = useState<PsfQueueItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const [selId, setSelId] = useState<string | null>(null);

  const toast = useCallback((txt: string, intent: QueuedToast["intent"] = "ok") => {
    setToasts((t) => [...t, { id: Date.now() + Math.random(), txt, intent }]);
  }, []);

  const load = useCallback(async () => {
    setLoadFailed(false);
    const res = await fetchPsfQueue(null);
    if (res.outcome !== "ok") {
      setLoadFailed(true);
      return;
    }
    setItems(res.data.items);
    setNextCursor(res.data.nextCursor);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    const res = await fetchPsfQueue(nextCursor);
    setLoadingMore(false);
    if (res.outcome !== "ok") {
      toast("We couldn't load more applications. Try again.", "bad");
      return;
    }
    setItems((prev) => [...(prev ?? []), ...res.data.items]);
    setNextCursor(res.data.nextCursor);
  };

  return (
    <MembershipShell title="Membership queue" queued={items?.length ?? null} toasts={toasts}>
      {loadFailed ? (
        <LoadFailed onRetry={() => void load()}>We couldn&apos;t load the membership queue.</LoadFailed>
      ) : items === null ? (
        <div className="flex flex-col gap-3">
          <Skeleton height={76} />
          <Skeleton height={76} delay={80} />
          <Skeleton height={76} delay={160} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState>
          No applications are waiting in your region. A business&apos;s application arrives here once it is registered and, when
          it gave a TIN, the Rwanda Revenue Authority has checked it.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
            <Button
              key={item.applicationId}
              variant="ghost"
              onClick={() => setSelId(item.applicationId)}
              className={cn(surfaceClass, "h-auto w-full justify-between gap-4 px-4 py-3.5 text-left hover:bg-hover")}
            >
              <span className="flex min-w-0 items-center gap-3">
                {item.businessCode && (
                  <span className="pms-num hidden shrink-0 rounded bg-accent-soft px-2 py-1 text-xs font-bold text-accent-text sm:inline">
                    {item.businessCode}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">{item.businessName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[item.associationName, item.districtName ?? "District not recorded", `sent ${shortDate(item.submittedAt)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {item.ownerGroups.map((g) => (
                  <Badge key={g} intent="accent">
                    {PSF_OWNER_GROUP_SHORT[g]}
                  </Badge>
                ))}
                {!item.canDecide && <Badge intent="warn">Your business</Badge>}
                <span className="hidden text-right sm:block">
                  <span className="block text-xs font-semibold text-ink">{item.requestedTierName}</span>
                  {item.declaredFeeRwf !== null && (
                    <span className="pms-num block text-xs text-muted-foreground">{formatPrice(item.declaredFeeRwf)} a year</span>
                  )}
                </span>
              </span>
            </Button>
          ))}
          {nextCursor && (
            <ActionButton className="self-start" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? "Loading" : "Load more"}
            </ActionButton>
          )}
        </div>
      )}

      <PsfApplicationSheet
        applicationId={selId}
        onClose={() => setSelId(null)}
        onDecided={(decided, message) => {
          // A decided application leaves the queue, only after the server agreed.
          setItems((prev) => (prev ?? []).filter((i) => i.applicationId !== decided.id));
          setSelId(null);
          toast(message);
        }}
      />
    </MembershipShell>
  );
}
