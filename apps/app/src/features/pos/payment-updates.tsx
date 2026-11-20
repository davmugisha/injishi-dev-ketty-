"use client";

import { Bell, Bucket, CircleCheckFill, CircleExclamationFill, Envelope, Printer, Xmark } from "@gravity-ui/icons";
import { Button, toast } from "@heroui/react";
import { LinkButton } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { METHOD_LABEL, type PosOrder, type PosOutlet, type PosPaymentUpdate } from "@/server/pos";
import { orderAction, paymentUpdatesAction, releaseAction, sittingBillsAction, tableStatusAction } from "./actions";
import { ReceiptDialog } from "./ebm-receipt";
import { EmailReceiptDialog } from "./mobile-payment";
import {
  freshUpdates,
  nextTableStep,
  type ReleaseBlocker,
  releaseBlockerList,
  updateHeadline,
  whereOf,
} from "./payment-flow";
import { clock, money } from "./shared";

/** What the waiter's card knows about releasing a sitting's table (display only). */
type ReleaseCheck =
  | { state: "checking" }
  | { state: "clear" }
  | { state: "blocked"; items: ReleaseBlocker[] }
  | { state: "unknown" };

const POLL_MS = 5_000;
/** On a first visit, what is older than this is not news any more. */
const FIRST_LOOK_MS = 30 * 60_000;
/** A waiter keeps the news of the whole service (the API answers at most 12 hours back). */
const WAITER_LOOK_MS = 12 * 60 * 60_000;

const storeKey = (outletId: string, what: string) => `injishi-pos-payment-updates:${outletId}:${what}`;
function load(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private window or blocked storage: the cards still work, they just come back after a reload.
  }
}

/**
 * The waiter's news, on every POS screen: a payment on one of their bills that the cashier confirmed (or marked not
 * received). Asked of the API every few seconds while the screen is visible, so nobody refreshes the app. From the
 * card the waiter prints or emails the receipt (only if the customer wants one), then releases the table when the
 * guests leave, then makes it available once it is cleared and cleaned.
 */
export function PaymentUpdates({
  outletId,
  outlets,
  waiter = false,
}: {
  outletId: string;
  outlets: PosOutlet[];
  /**
   * The waiter's view (someone who takes orders but not payment): 12 hours of news, a "Pay the rest" link, and on a
   * phone the cards fold into one pill with the unread count. False keeps the cards exactly as they always were.
   */
  waiter?: boolean;
}) {
  const router = useRouter();
  const outlet = outlets.find((o) => o.id === outletId) ?? null;
  const [updates, setUpdates] = useState<PosPaymentUpdate[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [receipt, setReceipt] = useState<PosOrder | null>(null);
  const [emailFor, setEmailFor] = useState<PosPaymentUpdate | null>(null);
  const [busy, start] = useTransition();
  const since = useRef<string | null>(null);
  // Waiter view: folded into a pill at first; news that arrives later unfolds it again.
  const [folded, setFolded] = useState(false);
  const primed = useRef(false);
  // Waiter view, display only: may the table of a paid bill be released, by the sitting's OTHER bills too?
  // Keyed by table sitting. The API checks again on release and stays the judge.
  const [checks, setChecks] = useState<Record<string, ReleaseCheck>>({});
  const [recheck, setRecheck] = useState(0);

  // What this person already dismissed at this outlet, and where the last look stopped.
  useEffect(() => {
    if (!outletId) return;
    try {
      const raw = load(storeKey(outletId, "dismissed"));
      setDismissed(new Set(raw ? (JSON.parse(raw) as string[]) : []));
    } catch {
      setDismissed(new Set());
    }
    since.current = new Date(Date.now() - (waiter ? WAITER_LOOK_MS : FIRST_LOOK_MS)).toISOString();
    setUpdates([]);
    primed.current = false;
    setChecks({});
    // The waiter's earlier news starts folded on every screen size, so it never covers the table panel; the pill
    // opens it. (Before, only a phone started folded.)
    setFolded(waiter);
  }, [outletId, waiter]);

  const poll = useCallback(async () => {
    if (!outletId || document.visibilityState !== "visible") return;
    const result = await paymentUpdatesAction(outletId, since.current ?? undefined);
    if (!result.ok) return;
    const wasPrimed = primed.current;
    primed.current = true;
    if (result.value.length === 0) return;
    const fresh = result.value;
    // News after the first look unfolds the waiter's pill, and a payment may have freed a table: look again.
    if (wasPrimed) setFolded(false);
    setRecheck((n) => n + 1);
    since.current = fresh.reduce((max, u) => (u.at > max ? u.at : max), since.current ?? "");
    setUpdates((old) => {
      const byId = new Map(old.map((u) => [u.id, u]));
      for (const u of fresh) byId.set(u.id, u);
      return [...byId.values()];
    });
    // The bill on screen (till, floor, desk) shows the payment as paid without a reload.
    router.refresh();
  }, [outletId, router]);

  useEffect(() => {
    if (!outletId) return;
    void poll();
    const t = setInterval(() => void poll(), POLL_MS);
    const onShow = () => document.visibilityState === "visible" && void poll();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [outletId, poll]);

  const dismiss = (id: string) =>
    setDismissed((old) => {
      const next = new Set(old).add(id);
      // Keep the list short: only ids of the last day matter.
      save(storeKey(outletId, "dismissed"), JSON.stringify([...next].slice(-200)));
      return next;
    });

  const patch = (id: string, change: Partial<PosPaymentUpdate>) =>
    setUpdates((old) => old.map((u) => (u.id === id ? { ...u, ...change } : u)));

  const showReceipt = (u: PosPaymentUpdate) =>
    start(async () => {
      const r = await orderAction(u.orderId);
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      setReceipt(r.value);
    });

  const release = (u: PosPaymentUpdate) =>
    start(async () => {
      if (!u.tableSessionId) return;
      const r = await releaseAction(u.tableSessionId);
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      patch(u.id, { sessionOpen: false, tableStatus: "cleaning" });
      setChecks((old) => {
        const { [u.tableSessionId as string]: _released, ...rest } = old;
        return rest;
      });
      toast.success(`${whereOf(u.orderType, u.tableLabel)} is being cleaned. Nobody can be seated there yet.`);
      router.refresh();
    });

  const cleaned = (u: PosPaymentUpdate) =>
    start(async () => {
      if (!u.tableId) return;
      const r = await tableStatusAction(u.tableId, "available");
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      patch(u.id, { tableStatus: "available" });
      toast.success(`${whereOf(u.orderType, u.tableLabel)} is available`);
      router.refresh();
    });

  const shown = freshUpdates(updates, dismissed);

  // Waiter view: the sittings whose card offers "release", looked up while the cards are open (READ ONLY).
  const sessionKey =
    waiter && !folded
      ? [
          ...new Set(
            shown
              .filter((u) => nextTableStep(u) === "release" && u.tableSessionId)
              .map((u) => u.tableSessionId as string),
          ),
        ]
          .sort()
          .join(",")
      : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: `recheck` is the trigger to look again, not an input
  useEffect(() => {
    if (!sessionKey || !outletId) return;
    let gone = false;
    const ids = sessionKey.split(",");
    setChecks((old) => {
      const next = { ...old };
      for (const id of ids) next[id] ??= { state: "checking" };
      return next;
    });
    void Promise.all(ids.map(async (id) => [id, await sittingBillsAction(outletId, id)] as const)).then((results) => {
      if (gone) return;
      setChecks((old) => {
        const next = { ...old };
        for (const [id, r] of results) {
          // A failed look keeps the button as it always was: the API answers the press with its own reason.
          if (!r.ok) next[id] = { state: "unknown" };
          else {
            const items = releaseBlockerList(r.value);
            next[id] = items.length ? { state: "blocked", items } : { state: "clear" };
          }
        }
        return next;
      });
    });
    return () => {
      gone = true;
    };
  }, [sessionKey, recheck, outletId]);
  // Another bill of the sitting may be paid meanwhile: look again every 15 seconds while the cards are open.
  useEffect(() => {
    if (!sessionKey) return;
    const t = setInterval(() => document.visibilityState === "visible" && setRecheck((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, [sessionKey]);

  if (shown.length === 0 && !receipt && !emailFor) return null;

  if (waiter && folded && shown.length > 0) {
    return (
      <>
        <button
          type="button"
          data-ui="payment-updates-pill"
          onClick={() => setFolded(false)}
          // A phone: top right, as before. A larger screen: bottom left of the content, clear of the screen's own
          // buttons (top right) and of the table panel (right), beside the menu (84 px, 272 px from xl).
          className="fixed top-3 right-3 z-50 flex items-center gap-2 rounded-full border border-success/50 bg-surface px-3 py-2 text-[13px] font-semibold shadow-[0_8px_30px_rgb(0_0_0/0.14)] sm:top-auto sm:right-auto sm:bottom-4 sm:left-4 md:left-[100px] xl:left-[288px]"
        >
          <Bell className="size-4 text-success" />
          {shown.length} payment update{shown.length === 1 ? "" : "s"}
        </button>
        {receipt && outlet ? <ReceiptDialog order={receipt} outlet={outlet} onClose={() => setReceipt(null)} /> : null}
        {emailFor ? (
          <EmailReceiptDialog
            orderId={emailFor.orderId}
            orderNumber={emailFor.orderNumber}
            onClose={() => setEmailFor(null)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <section
        aria-label="Payment updates"
        aria-live="polite"
        data-ui="payment-updates"
        className="pointer-events-none fixed top-3 right-3 z-50 flex w-[380px] max-w-[calc(100vw-24px)] flex-col gap-2"
      >
        {waiter && shown.length > 0 ? (
          <div className="pointer-events-auto flex items-center justify-end">
            <Button size="sm" variant="secondary" onPress={() => setFolded(true)} data-ui="payment-updates-fold">
              Hide updates · {shown.length}
            </Button>
          </div>
        ) : null}
        {shown.map((u) => {
          const ok = u.outcome === "confirmed";
          const step = nextTableStep(u);
          return (
            <article
              key={u.id}
              data-ui="payment-update"
              data-outcome={u.outcome}
              className={`pointer-events-auto flex flex-col gap-2.5 rounded-2xl border bg-surface p-4 shadow-[0_8px_30px_rgb(0_0_0/0.14)] ${ok ? "border-success/50" : "border-danger/50"}`}
            >
              <div className="flex items-start gap-2.5">
                {ok ? (
                  <CircleCheckFill className="mt-0.5 size-5 shrink-0 text-success" />
                ) : (
                  <CircleExclamationFill className="mt-0.5 size-5 shrink-0 text-danger" />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-[15px] leading-5 font-semibold">{updateHeadline(u)}</p>
                  <p className="text-[13px] text-foreground tabular">
                    {u.orderNumber} · {whereOf(u.orderType, u.tableLabel)} · {money(u.amountRwf)}
                  </p>
                  <p className="text-[12px] text-muted">
                    {METHOD_LABEL[u.method]} · {ok ? "confirmed" : "marked not received"}
                    {u.byName ? ` by ${u.byName}` : ""} at {clock(u.at)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label={`Dismiss the update on ${u.orderNumber}`}
                  onPress={() => dismiss(u.id)}
                >
                  <Xmark className="size-4" />
                </Button>
              </div>
              {ok && u.billFullyPaid ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary" isDisabled={busy || !outlet} onPress={() => showReceipt(u)}>
                    <Printer className="size-4" />
                    Print receipt
                  </Button>
                  <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => setEmailFor(u)}>
                    <Envelope className="size-4" />
                    Email receipt
                  </Button>
                </div>
              ) : null}
              {step === "release" ? (
                <ReleaseStep
                  where={whereOf(u.orderType, u.tableLabel)}
                  // Only the waiter's view looks at the other bills; anyone else's card stays exactly as it was.
                  check={waiter && u.tableSessionId ? checks[u.tableSessionId] : undefined}
                  tableHref={u.tableId ? `/pos/floor?outlet=${outletId}&table=${u.tableId}` : null}
                  busy={busy}
                  onRelease={() => release(u)}
                />
              ) : step === "clean" ? (
                <Button
                  size="sm"
                  fullWidth
                  className="h-auto min-h-9 py-1.5 whitespace-normal"
                  isDisabled={busy}
                  data-ui="table-clean"
                  onPress={() => cleaned(u)}
                >
                  <Bucket className="size-4 shrink-0" />
                  Table cleaned · make it available
                </Button>
              ) : ok && u.billFullyPaid && u.tableId && u.tableStatus === "available" ? (
                <p className="text-[12px] text-success-soft-foreground">
                  {whereOf(u.orderType, u.tableLabel)} is clean and available again.
                </p>
              ) : null}
              {!ok ? (
                <p className="text-[12px] text-muted">
                  Ask the customer to pay again, or take another method on the bill.
                </p>
              ) : null}
              {waiter && (!ok || !u.billFullyPaid) ? (
                <LinkButton href={`/pos/till?order=${u.orderId}`} size="sm" variant="secondary" data-ui="pay-the-rest">
                  {ok ? `Pay the rest · ${money(u.outstandingRwf)}` : "Open the bill"}
                </LinkButton>
              ) : null}
            </article>
          );
        })}
      </section>
      {receipt && outlet ? <ReceiptDialog order={receipt} outlet={outlet} onClose={() => setReceipt(null)} /> : null}
      {emailFor ? (
        <EmailReceiptDialog
          orderId={emailFor.orderId}
          orderNumber={emailFor.orderNumber}
          onClose={() => setEmailFor(null)}
        />
      ) : null}
    </>
  );
}

/**
 * "Guests left · release table for cleaning" on a paid bill's card. In the waiter's view (`check` set) it waits for
 * the sitting's other bills: while any is a draft, owes money or waits for the cashier, the button is disabled and
 * the card says which bill and how much, with a way to the table. Without `check` it is the button as it always was.
 */
function ReleaseStep({
  where,
  check,
  tableHref,
  busy,
  onRelease,
}: {
  where: string;
  check: ReleaseCheck | undefined;
  tableHref: string | null;
  busy: boolean;
  onRelease: () => void;
}) {
  const blocked = check?.state === "blocked" ? check.items : null;
  const checking = check?.state === "checking";
  return (
    <>
      {blocked ? (
        <div
          data-ui="card-release-blocked"
          className="flex flex-col gap-1 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-soft-foreground"
        >
          <p className="font-semibold">{where} can't be released yet:</p>
          <ul className="flex list-disc flex-col gap-0.5 pl-4">
            {blocked.map((b) => (
              <li key={b.text}>{b.text}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Button
        size="sm"
        fullWidth
        className="h-auto min-h-9 py-1.5 whitespace-normal"
        isDisabled={busy || checking || blocked !== null}
        data-ui="table-release"
        onPress={onRelease}
      >
        {checking ? "Checking the table's other bills…" : "Guests left · release table for cleaning"}
      </Button>
      {blocked && tableHref ? (
        <LinkButton href={tableHref} size="sm" variant="secondary" data-ui="open-table">
          See the table's bills
        </LinkButton>
      ) : null}
    </>
  );
}
