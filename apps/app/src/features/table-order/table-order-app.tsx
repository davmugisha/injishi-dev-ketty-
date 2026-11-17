"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dishPhoto, isUpload } from "@/features/pos/dish-art";
import type { TableOrderMenu, TableOrderMenuItem, TableOrderStatus } from "@/server/table-order";
import {
  addToCart,
  type CartLine,
  cartTotals,
  countOf,
  lineAmounts,
  MAX_QUANTITY,
  optionProblem,
  orderBody,
  type Selection,
  setQuantity,
  unitPrice,
  uploadedPhotoSrc,
} from "./cart";

/**
 * A guest's phone at a table (migration 0156): the outlet's menu with photos and prices, a cart, a review with the
 * total, and the order's progress once sent. The table is the one whose QR was scanned; nothing here can change it.
 *
 * A cart carries one random key from its first item to its sending, kept for this table in the tab's session
 * storage: sending twice (a double tap, a retry after a dropped connection, a reload) gives the same order, never a
 * second one. After it is sent the next cart gets a new key. The orders sent from this phone are listed with their
 * progress; the bill and payment stay with the staff.
 */
const rwf = (n: number) => `RWF ${Math.round(n).toLocaleString("en-US")}`;

const STAGES: { id: TableOrderStatus["stage"]; label: string }[] = [
  { id: "received", label: "Received" },
  { id: "preparing", label: "Preparing" },
  { id: "ready", label: "Ready" },
  { id: "served", label: "Served" },
];

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;

interface Stored {
  cart: CartLine[];
  cartKey: string;
  sent: string[];
  note: string;
}

function readStored(code: string): Stored | null {
  try {
    const raw = window.sessionStorage.getItem(`table-order:${code}`);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}
function writeStored(code: string, value: Stored) {
  try {
    window.sessionStorage.setItem(`table-order:${code}`, JSON.stringify(value));
  } catch {
    // A private window may refuse storage: the cart still works, it just does not survive a reload.
  }
}

async function messageOf(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    const m = Array.isArray(body.message) ? body.message[0] : body.message;
    if (typeof m === "string" && m) return m;
  } catch {
    // fall through
  }
  return res.status === 429
    ? "Too many tries in a short time. Wait a minute and send again."
    : "That did not go through. Try again.";
}

export function TableOrderApp({ code, menu }: { code: string; menu: TableOrderMenu }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartKey, setCartKey] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [guests, setGuests] = useState(2);
  const [ready, setReady] = useState(false);
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState<TableOrderMenuItem | null>(null);
  const [view, setView] = useState<"menu" | "review" | "orders">("menu");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, TableOrderStatus>>({});
  const sendingRef = useRef(false);

  // The cart and the orders sent from this phone come back after a reload.
  useEffect(() => {
    const stored = readStored(code);
    if (stored) {
      setCart(stored.cart ?? []);
      setCartKey(stored.cartKey || newKey());
      setSent(stored.sent ?? []);
      setNote(stored.note ?? "");
      if ((stored.sent ?? []).length && !(stored.cart ?? []).length) setView("orders");
    } else setCartKey(newKey());
    setReady(true);
  }, [code]);
  useEffect(() => {
    if (ready) writeStored(code, { cart, cartKey, sent, note });
  }, [ready, code, cart, cartKey, sent, note]);

  const categoryName = useMemo(() => new Map(menu.categories.map((c) => [c.id, c.name])), [menu.categories]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return menu.items.filter(
      (i) =>
        (category === "all" || i.categoryId === category) &&
        (!q || i.name.toLowerCase().includes(q) || (i.description ?? "").toLowerCase().includes(q)),
    );
  }, [menu.items, category, query]);
  const totals = cartTotals(cart, menu.taxMode);

  const photoOf = (item: TableOrderMenuItem) =>
    uploadedPhotoSrc(code, item.id, item.photo) ??
    dishPhoto(item.name, categoryName.get(item.categoryId) ?? "", isUpload(item.photo) ? null : item.photo);

  const add = (item: TableOrderMenuItem) => {
    if (!menu.acceptingOrders) return;
    if (item.options.length) return setPicking(item);
    setCart((c) => addToCart(c, item, []));
  };
  const minus = (item: TableOrderMenuItem) => {
    const line = [...cart].reverse().find((l) => l.itemId === item.id);
    if (line) setCart((c) => setQuantity(c, line.key, line.quantity - 1));
  };

  const refresh = useCallback(
    async (keys: string[]) => {
      const pairs = await Promise.all(
        keys.map(async (k) => {
          try {
            const res = await fetch(`/api/table-order/${encodeURIComponent(code)}/orders/${encodeURIComponent(k)}`, {
              cache: "no-store",
            });
            return res.ok ? ([k, (await res.json()) as TableOrderStatus] as const) : null;
          } catch {
            return null;
          }
        }),
      );
      setStatuses((s) => {
        const next = { ...s };
        for (const p of pairs) if (p) next[p[0]] = p[1];
        return next;
      });
    },
    [code],
  );
  // Progress of the orders sent from this phone, every few seconds while they are open.
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart only when the list of orders changes, not on each poll
  useEffect(() => {
    if (!sent.length) return;
    refresh(sent);
    const open = () => sent.filter((k) => !["served", "cancelled"].includes(statuses[k]?.stage ?? ""));
    const timer = window.setInterval(() => {
      const keys = open();
      if (keys.length && document.visibilityState === "visible") refresh(keys);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [sent, refresh]);

  async function send() {
    if (sendingRef.current || !cart.length || !menu.acceptingOrders) return;
    sendingRef.current = true;
    setSending(true);
    setProblem(null);
    try {
      const res = await fetch(`/api/table-order/${encodeURIComponent(code)}/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(orderBody(cart, cartKey, note, guests)),
      });
      if (!res.ok) {
        setProblem(await messageOf(res));
        return;
      }
      const status = (await res.json()) as TableOrderStatus;
      setStatuses((s) => ({ ...s, [cartKey]: status }));
      setSent((s) => (s.includes(cartKey) ? s : [cartKey, ...s]));
      setCart([]);
      setNote("");
      setCartKey(newKey());
      setView("orders");
      window.scrollTo({ top: 0 });
    } catch {
      setProblem(
        "The restaurant could not be reached. Check your connection and send again: it will not be ordered twice.",
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  return (
    <div data-ui="table-order" className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col bg-background pb-28">
      <header className="sticky top-0 z-20 border-b border-separator bg-background/95 px-4 pt-4 pb-3 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold tracking-[0.12em] text-muted uppercase">
              {menu.outletName}
            </p>
            <h1 className="text-[22px] leading-7 font-bold">Order from your table</h1>
          </div>
          <span
            data-ui="table-badge"
            className="flex shrink-0 flex-col items-center rounded-2xl bg-accent px-3 py-1.5 text-accent-foreground"
          >
            <span className="text-[10px] font-semibold tracking-wider uppercase opacity-80">Table</span>
            <span className="text-[18px] leading-5 font-bold" data-field="table">
              {menu.tableLabel}
            </span>
          </span>
        </div>
        <p className="mt-1 text-[12px] text-muted">
          {menu.areaName} · your order goes straight to the kitchen and bar. Pay with your waiter when you are ready.
        </p>
        {sent.length ? (
          <nav
            className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 text-[13px] font-semibold"
            aria-label="Menu or your orders"
          >
            <button
              type="button"
              onClick={() => setView("menu")}
              aria-pressed={view !== "orders"}
              className={`rounded-lg py-1.5 ${view !== "orders" ? "bg-background shadow-sm" : "text-muted"}`}
            >
              Menu
            </button>
            <button
              type="button"
              data-ui="tab-orders"
              onClick={() => setView("orders")}
              aria-pressed={view === "orders"}
              className={`rounded-lg py-1.5 ${view === "orders" ? "bg-background shadow-sm" : "text-muted"}`}
            >
              Your orders ({sent.length})
            </button>
          </nav>
        ) : null}
      </header>

      {!menu.acceptingOrders ? (
        <p
          role="status"
          className="mx-4 mt-3 rounded-xl bg-warning-soft px-3 py-2 text-[13px] text-warning-soft-foreground"
        >
          {menu.notice}
        </p>
      ) : null}

      {view === "orders" ? (
        <OrdersView keys={sent} statuses={statuses} onMore={() => setView("menu")} />
      ) : (
        <>
          <div className="flex flex-col gap-2 bg-background px-4 pt-3 pb-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the menu"
              aria-label="Search the menu"
              className="h-10 w-full min-w-0 rounded-xl border border-separator bg-surface px-3 text-[15px] outline-none focus:border-accent"
            />
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Menu sections">
              {[{ id: "all", name: "All" }, ...menu.categories].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={category === c.id}
                  onClick={() => setCategory(c.id)}
                  className={`h-8 shrink-0 rounded-full border px-3 text-[13px] font-semibold ${
                    category === c.id ? "border-accent bg-accent text-accent-foreground" : "border-separator bg-surface"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {menu.items.length === 0 ? (
            <p className="px-4 py-10 text-center text-[14px] text-muted">
              Nothing can be ordered from the table right now. Please ask a member of staff.
            </p>
          ) : (
            <ul className="flex flex-col gap-3 px-4 pt-1" aria-label="Menu">
              {shown.map((item) => {
                const n = countOf(cart, item.id);
                const src = photoOf(item);
                return (
                  <li
                    key={item.id}
                    data-ui="menu-item"
                    data-item={item.name}
                    className="flex gap-3 rounded-2xl border border-separator bg-surface p-2.5"
                  >
                    <span className="relative size-[92px] shrink-0 overflow-hidden rounded-xl bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]">
                      {src ? (
                        // biome-ignore lint/performance/noImgElement: small JPEGs on a guest's phone; no optimiser needed
                        <img src={src} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center text-[22px] font-semibold text-muted">
                          {item.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] leading-5 font-semibold">{item.name}</span>
                      {item.description ? (
                        <span className="line-clamp-2 text-[12.5px] leading-4 text-muted">{item.description}</span>
                      ) : null}
                      {item.left !== null ? (
                        <span className="text-[11.5px] font-semibold text-warning">Only {item.left} left</span>
                      ) : null}
                      <span className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                        <span className="text-[15px] font-bold tabular-nums" data-field="price">
                          {rwf(item.priceRwf)}
                          {item.options.length ? (
                            <span className="ml-1 text-[11px] font-normal text-muted">+ options</span>
                          ) : null}
                        </span>
                        {n > 0 && !item.options.length ? (
                          <span className="flex items-center gap-1" data-ui="stepper">
                            <button
                              type="button"
                              aria-label={`One less ${item.name}`}
                              onClick={() => minus(item)}
                              className="size-9 rounded-full border border-separator bg-background text-[18px] font-bold"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-[15px] font-bold tabular-nums" data-field="count">
                              {n}
                            </span>
                            <button
                              type="button"
                              aria-label={`One more ${item.name}`}
                              onClick={() => add(item)}
                              disabled={n >= MAX_QUANTITY}
                              className="size-9 rounded-full bg-accent text-[18px] font-bold text-accent-foreground disabled:opacity-40"
                            >
                              +
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            data-ui="add"
                            aria-label={`Add ${item.name}`}
                            onClick={() => add(item)}
                            disabled={!menu.acceptingOrders}
                            className="h-9 rounded-full bg-accent px-4 text-[14px] font-semibold text-accent-foreground disabled:opacity-40"
                          >
                            {n > 0 ? `Add · ${n} in order` : "Add"}
                          </button>
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
              {shown.length === 0 ? (
                <li className="py-8 text-center text-[14px] text-muted">Nothing matches that search.</li>
              ) : null}
            </ul>
          )}
          <p className="px-4 pt-4 text-center text-[11.5px] text-muted">
            {menu.taxMode === "exclusive" ? "Prices are before VAT; VAT is added on your bill." : "Prices include VAT."}
          </p>
        </>
      )}

      {cart.length > 0 && view === "menu" ? (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[560px] px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            data-ui="view-cart"
            onClick={() => setView("review")}
            className="flex h-14 w-full items-center justify-between rounded-2xl bg-accent px-5 text-accent-foreground shadow-lg"
          >
            <span className="text-[15px] font-semibold">
              Review order · {totals.count} item{totals.count === 1 ? "" : "s"}
            </span>
            <span className="text-[16px] font-bold tabular-nums">{rwf(totals.totalRwf)}</span>
          </button>
        </div>
      ) : null}

      {view === "review" ? (
        <Sheet
          title="Your order"
          subtitle={`Table ${menu.tableLabel} · ${menu.areaName}`}
          onClose={() => setView("menu")}
        >
          <div data-ui="review" className="flex flex-col gap-3">
            {cart.length === 0 ? <p className="py-6 text-center text-[14px] text-muted">Your order is empty.</p> : null}
            <ul className="flex flex-col divide-y divide-separator">
              {cart.map((l) => (
                <li key={l.key} className="flex items-center gap-3 py-2.5" data-ui="cart-line" data-item={l.name}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-semibold">{l.name}</p>
                    {l.selectedOptions.length ? (
                      <p className="text-[12px] text-muted">
                        {l.selectedOptions.map((s) => s.choices.join(", ")).join(" · ")}
                      </p>
                    ) : null}
                    <p className="text-[12px] text-muted tabular-nums">{rwf(l.unitPriceRwf)} each</p>
                  </div>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={l.quantity === 1 ? `Remove ${l.name}` : `One less ${l.name}`}
                      onClick={() => setCart((c) => setQuantity(c, l.key, l.quantity - 1))}
                      className="size-8 rounded-full border border-separator text-[16px] font-bold"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-[14px] font-bold tabular-nums" data-field="qty">
                      {l.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`One more ${l.name}`}
                      onClick={() => setCart((c) => setQuantity(c, l.key, l.quantity + 1))}
                      disabled={l.quantity >= MAX_QUANTITY}
                      className="size-8 rounded-full border border-separator text-[16px] font-bold disabled:opacity-40"
                    >
                      +
                    </button>
                  </span>
                  <span className="w-[92px] text-right text-[14px] font-semibold tabular-nums">
                    {rwf(lineAmounts(l, menu.taxMode).netRwf)}
                  </span>
                </li>
              ))}
            </ul>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Anything the kitchen should know?
              <textarea
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Allergies, no onions, your name…"
                rows={2}
                className="rounded-xl border border-separator bg-surface px-3 py-2 text-[14px] font-normal outline-none focus:border-accent"
              />
            </label>
            <div className="flex items-center justify-between gap-2 text-[13px]">
              <span className="font-semibold">Guests at the table</span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="One guest less"
                  onClick={() => setGuests((g) => Math.max(1, g - 1))}
                  className="size-8 rounded-full border border-separator text-[16px] font-bold"
                >
                  −
                </button>
                <span className="w-6 text-center font-bold tabular-nums" data-field="guests">
                  {guests}
                </span>
                <button
                  type="button"
                  aria-label="One guest more"
                  onClick={() => setGuests((g) => Math.min(50, g + 1))}
                  className="size-8 rounded-full border border-separator text-[16px] font-bold"
                >
                  +
                </button>
              </span>
            </div>
            <dl className="flex flex-col gap-1 rounded-xl bg-surface p-3 text-[13.5px]" data-ui="review-totals">
              <div className="flex justify-between">
                <dt className="text-muted">Items</dt>
                <dd className="tabular-nums">{rwf(totals.netRwf)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{menu.taxMode === "exclusive" ? "VAT added" : "Of which VAT"}</dt>
                <dd className="tabular-nums">{rwf(totals.taxRwf)}</dd>
              </div>
              <div className="flex justify-between border-t border-separator pt-1.5 text-[16px] font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums" data-field="total">
                  {rwf(totals.totalRwf)}
                </dd>
              </div>
            </dl>
            {problem ? (
              <p
                role="alert"
                data-ui="order-problem"
                className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger-soft-foreground"
              >
                {problem}
              </p>
            ) : null}
            <button
              type="button"
              data-ui="send-order"
              onClick={send}
              disabled={sending || cart.length === 0 || !menu.acceptingOrders}
              aria-busy={sending}
              className="h-13 min-h-[52px] rounded-2xl bg-accent text-[16px] font-bold text-accent-foreground disabled:opacity-50"
            >
              {sending ? "Sending your order…" : `Send order · ${rwf(totals.totalRwf)}`}
            </button>
            <p className="text-center text-[11.5px] text-muted">
              Your order goes to Table {menu.tableLabel}. You pay your waiter or at the till; nothing is charged here.
            </p>
          </div>
        </Sheet>
      ) : null}

      {picking ? (
        <OptionsSheet
          item={picking}
          photo={photoOf(picking)}
          onClose={() => setPicking(null)}
          onAdd={(selected, quantity) => {
            setCart((c) => addToCart(c, picking, selected, quantity));
            setPicking(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full max-w-[560px] flex-col rounded-t-3xl bg-background"
      >
        <div className="flex items-start justify-between gap-3 border-b border-separator px-4 pt-4 pb-3">
          <div>
            <h2 className="text-[18px] font-bold">{title}</h2>
            {subtitle ? <p className="text-[12.5px] text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="size-9 shrink-0 rounded-full border border-separator text-[18px] leading-none"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

function OptionsSheet({
  item,
  photo,
  onClose,
  onAdd,
}: {
  item: TableOrderMenuItem;
  photo: string | null;
  onClose: () => void;
  onAdd: (selected: Selection[], quantity: number) => void;
}) {
  const [selected, setSelected] = useState<Selection[]>(() =>
    item.options.map((o) => ({
      name: o.name,
      choices: o.required && o.choices.length === 1 ? [o.choices[0]?.label ?? ""] : [],
    })),
  );
  const [quantity, setQty] = useState(1);
  const problem = optionProblem(item, selected);
  const price = unitPrice(item, selected);
  const toggle = (name: string, label: string, max: number) =>
    setSelected((s) =>
      s.map((x) => {
        if (x.name !== name) return x;
        if (x.choices.includes(label)) return { ...x, choices: x.choices.filter((c) => c !== label) };
        return { ...x, choices: max === 1 ? [label] : x.choices.length < max ? [...x.choices, label] : x.choices };
      }),
    );
  return (
    <Sheet title={item.name} subtitle={rwf(item.priceRwf)} onClose={onClose}>
      <div className="flex flex-col gap-4" data-ui="options">
        {photo ? (
          // biome-ignore lint/performance/noImgElement: small JPEG on a guest's phone
          <img src={photo} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover" />
        ) : null}
        {item.description ? <p className="text-[13.5px] text-muted">{item.description}</p> : null}
        {item.options.map((o) => {
          const picked = selected.find((s) => s.name === o.name)?.choices ?? [];
          return (
            <fieldset key={o.name} className="flex flex-col gap-1.5">
              <legend className="mb-1 text-[14px] font-semibold">
                {o.name}{" "}
                <span className="text-[12px] font-normal text-muted">
                  {o.required ? "required" : "optional"}
                  {o.maxChoices > 1 ? ` · up to ${o.maxChoices}` : ""}
                </span>
              </legend>
              {o.choices.map((c) => (
                <label
                  key={c.label}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-[14px] ${
                    picked.includes(c.label) ? "border-accent bg-accent/10" : "border-separator"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type={o.maxChoices === 1 ? "radio" : "checkbox"}
                      name={o.name}
                      checked={picked.includes(c.label)}
                      onChange={() => toggle(o.name, c.label, o.maxChoices)}
                      className="size-4 accent-[var(--accent)]"
                    />
                    {c.label}
                  </span>
                  {c.priceDeltaRwf ? (
                    <span className="text-[12.5px] text-muted tabular-nums">
                      {c.priceDeltaRwf > 0 ? "+" : "−"}
                      {rwf(Math.abs(c.priceDeltaRwf))}
                    </span>
                  ) : null}
                </label>
              ))}
            </fieldset>
          );
        })}
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-semibold">How many</span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              aria-label="One less"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="size-9 rounded-full border border-separator text-[18px] font-bold"
            >
              −
            </button>
            <span className="w-7 text-center text-[15px] font-bold tabular-nums">{quantity}</span>
            <button
              type="button"
              aria-label="One more"
              onClick={() => setQty((q) => Math.min(MAX_QUANTITY, q + 1))}
              className="size-9 rounded-full border border-separator text-[18px] font-bold"
            >
              +
            </button>
          </span>
        </div>
        {problem ? <p className="text-[12.5px] text-muted">{problem}</p> : null}
        <button
          type="button"
          data-ui="options-add"
          disabled={!!problem}
          onClick={() => onAdd(selected, quantity)}
          className="h-12 rounded-2xl bg-accent text-[15px] font-bold text-accent-foreground disabled:opacity-40"
        >
          Add {quantity} · {rwf(price * quantity)}
        </button>
      </div>
    </Sheet>
  );
}

function OrdersView({
  keys,
  statuses,
  onMore,
}: {
  keys: string[];
  statuses: Record<string, TableOrderStatus>;
  onMore: () => void;
}) {
  return (
    <section className="flex flex-col gap-3 px-4 pt-4" aria-label="Your orders" data-ui="orders">
      {keys.map((k, i) => {
        const s = statuses[k];
        if (!s) {
          return (
            <div key={k} className="rounded-2xl border border-separator bg-surface p-4 text-[13px] text-muted">
              Loading your order…
            </div>
          );
        }
        const at = STAGES.findIndex((x) => x.id === s.stage);
        return (
          <article
            key={k}
            data-ui="sent-order"
            data-order={s.orderNumber}
            data-stage={s.stage}
            className="flex flex-col gap-3 rounded-2xl border border-separator bg-surface p-4"
          >
            {i === 0 ? (
              <p
                className="rounded-xl bg-success-soft px-3 py-2 text-[13.5px] font-semibold text-success-soft-foreground"
                data-ui="order-sent"
              >
                Order sent to Table {s.tableLabel}. The kitchen and bar have it.
              </p>
            ) : null}
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[15px] font-bold" data-field="order-number">
                {s.orderNumber}
              </span>
              <span className="text-[12px] text-muted">
                Table {s.tableLabel} ·{" "}
                {new Date(s.placedAt).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "Africa/Kigali",
                })}
              </span>
            </div>
            {s.stage === "cancelled" ? (
              <p className="text-[13px] font-semibold text-danger">
                This order was cancelled by the staff. Please ask your waiter.
              </p>
            ) : (
              <ol className="grid grid-cols-4 gap-1" aria-label="Progress">
                {STAGES.map((x, n) => (
                  <li
                    key={x.id}
                    className="flex flex-col items-center gap-1 text-center"
                    aria-current={n === at ? "step" : undefined}
                  >
                    <span className={`h-1.5 w-full rounded-full ${n <= at ? "bg-accent" : "bg-separator"}`} />
                    <span className={`text-[11.5px] ${n === at ? "font-bold" : "text-muted"}`}>{x.label}</span>
                  </li>
                ))}
              </ol>
            )}
            <ul className="flex flex-col gap-0.5 text-[13.5px]">
              {s.lines.map((l, n) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a sent order's lines are fixed; two may read the same
                <li key={`${l.name}-${n}`} className="flex justify-between gap-2">
                  <span>
                    {l.quantity} × {l.name}
                  </span>
                  <span className="tabular-nums text-muted">{rwf(l.totalRwf)}</span>
                </li>
              ))}
            </ul>
            <p className="flex justify-between border-t border-separator pt-2 text-[14.5px] font-bold">
              <span>Total</span>
              <span className="tabular-nums" data-field="sent-total">
                {rwf(s.totalRwf)}
              </span>
            </p>
          </article>
        );
      })}
      <button
        type="button"
        data-ui="order-more"
        onClick={onMore}
        className="h-12 rounded-2xl border border-accent text-[15px] font-semibold text-accent"
      >
        Order something else
      </button>
      <p className="text-center text-[12px] text-muted">Ready to pay? Ask your waiter for the bill.</p>
    </section>
  );
}
