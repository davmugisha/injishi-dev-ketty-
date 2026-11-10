"use client";

import { Button, Card, Chip, Input, Label, SearchField, TextArea, TextField } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  CUSTOMER_SEARCH_MIN,
  ORDER_STATUS_LABEL,
  type PosCustomerList,
  type PosCustomerProfile,
  type PosCustomerSummary,
  type PosOutlet,
} from "@/server/pos";
import {
  createCustomerAction,
  eraseCustomerAction,
  exportCustomerAction,
  mergeCustomerAction,
  searchCustomersAction,
  updateCustomerAction,
} from "./actions";
import { Panel } from "./back-office";
import { type CustomerForm, customerFormProblem, customerPayload, emptyCustomerForm } from "./customer-form";
import { kigaliToday, rwf, shortDay } from "./format";
import { CustomerFormFields } from "./pos-customer-form";
import { initialsOf } from "./pos-me";
import { PosShell } from "./pos-shell";
import { ORDER_COLOR, PosDialog, StatusChip, usePosAction } from "./shared";

const day = (iso: string | null) => (iso ? shortDay(kigaliToday(new Date(iso))) : "Never");

type Dialog = { kind: "new" } | { kind: "edit" } | { kind: "merge" } | { kind: "erase" } | null;

/**
 * The customers of the business (CRM, phase 1): find one, open their profile and order history, register a new one,
 * correct their details, and (for the owner and manager) merge a duplicate, export what is held, or erase it.
 *
 * What a person sees follows the API: without `customer.manage` the phone and email arrive masked and the book can
 * only be searched (never listed), so this screen shows what it is given and says why when it is partial. Nothing is
 * deleted from here: a duplicate is merged, and an erase keeps every order and amount, anonymised.
 */
export function PosCustomersScreen({
  outlets,
  outlet,
  list,
  selected,
  q,
  can,
}: {
  outlets: PosOutlet[];
  outlet: PosOutlet;
  list: PosCustomerList;
  selected: PosCustomerProfile | null;
  q: string;
  can: string[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [typed, setTyped] = useState(q);
  const manage = can.includes("customer.manage");
  const admin = can.includes("customer.admin");

  const outletId = outlet.id;
  const openId = selected?.id;
  const href = useCallback(
    (next: { q?: string; c?: string | null }) => {
      const p = new URLSearchParams();
      p.set("outlet", outletId);
      const query = next.q ?? q;
      if (query) p.set("q", query);
      const c = next.c === undefined ? openId : next.c;
      if (c) p.set("c", c);
      return `/pos/customers?${p.toString()}`;
    },
    [outletId, q, openId],
  );

  // The URL is the source of truth: when the query changes from OUTSIDE (the Back button) the box follows it. A change
  // this box asked for itself is ignored, so a search that arrives while the person is still typing never overwrites
  // what they have typed since.
  const asked = useRef(q);
  useEffect(() => {
    if (q === asked.current) return;
    asked.current = q;
    setTyped(q);
  }, [q]);

  // Search a moment after the person stops typing. Nothing is scheduled while what is typed already is the query.
  useEffect(() => {
    const text = typed.trim();
    if (text === q) return;
    const t = setTimeout(() => {
      asked.current = text;
      router.replace(href({ q: text }));
    }, 350);
    return () => clearTimeout(t);
  }, [typed, q, router, href]);

  return (
    <PosShell
      board="PosCustomers"
      title="Customers"
      subtitle="Who your guests are, and what they have ordered"
      outlet={outlet}
      outlets={outlets}
      outletId={outlet.id}
      switchHref={`/pos/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`}
      can={can}
      actions={
        manage ? (
          <Button size="sm" onPress={() => setDialog({ kind: "new" })}>
            New customer
          </Button>
        ) : undefined
      }
    >
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-4 md:px-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel
          title="Customers"
          note={
            list.searchRequired
              ? undefined
              : `${list.total} ${list.total === 1 ? "customer" : "customers"}${q ? ` matching "${q}"` : ""}`
          }
        >
          <SearchField
            aria-label="Search customers"
            value={typed}
            onChange={setTyped}
            fullWidth
            onSubmit={() => router.replace(href({ q: typed.trim() }))}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder={manage ? "Search by name, phone or email" : "Search by name or whole phone number"}
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          {list.contactHidden ? (
            <p className="text-[12px] text-muted" data-field="masked-note">
              Phone numbers and emails are partly hidden for your role.
            </p>
          ) : null}
          {list.searchRequired ? (
            <p className="py-6 text-[13px] text-muted" data-field="search-required">
              Type at least {CUSTOMER_SEARCH_MIN} letters of a name, or a whole phone number, to find a customer.
            </p>
          ) : list.customers.length === 0 ? (
            <p className="py-6 text-[13px] text-muted" data-field="empty">
              {q
                ? "No customer matches that."
                : manage
                  ? "No customers yet. Register the first one with New customer, or from a bill at the till."
                  : "No customers yet."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-separator text-left text-[11px] tracking-wide text-muted uppercase">
                    <th className="py-2 pr-3 font-medium">Name</th>
                    <th className="py-2 pr-3 font-medium">Phone</th>
                    <th className="py-2 pr-3 text-right font-medium">Visits</th>
                    <th className="hidden py-2 pr-3 text-right font-medium sm:table-cell">Spent</th>
                    <th className="hidden py-2 font-medium sm:table-cell">Last visit</th>
                  </tr>
                </thead>
                <tbody>
                  {list.customers.map((c) => (
                    <CustomerRow
                      key={c.id}
                      c={c}
                      active={c.id === selected?.id}
                      onOpen={() => router.push(href({ c: c.id }))}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {list.total > list.customers.length && !list.searchRequired ? (
            <p className="text-[12px] text-muted">
              Showing the first {list.customers.length}. Narrow the search to find the rest.
            </p>
          ) : null}
        </Panel>

        <Profile profile={selected} manage={manage} admin={admin} onDialog={setDialog} hidden={list.contactHidden} />
      </div>

      {dialog?.kind === "new" ? (
        <NewCustomerDialog
          onClose={() => setDialog(null)}
          onOpenExisting={(id) => router.push(href({ c: id }))}
          onCreated={(id) => router.push(href({ c: id }))}
        />
      ) : null}
      {dialog?.kind === "edit" && selected ? <EditDialog profile={selected} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "merge" && selected ? (
        <MergeDialog
          profile={selected}
          onClose={() => setDialog(null)}
          onMerged={(into) => router.push(href({ c: into }))}
        />
      ) : null}
      {dialog?.kind === "erase" && selected ? (
        <EraseDialog
          profile={selected}
          onClose={() => setDialog(null)}
          onErased={() => router.push(href({ c: null }))}
        />
      ) : null}
    </PosShell>
  );
}

function CustomerRow({ c, active, onOpen }: { c: PosCustomerSummary; active: boolean; onOpen: () => void }) {
  return (
    <tr
      className={`border-b border-separator/60 last:border-0 ${active ? "bg-accent/10" : ""}`}
      data-customer={c.id}
      aria-selected={active}
    >
      <td className="max-w-[170px] py-2.5 pr-3 sm:max-w-none">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-semibold text-accent-soft-foreground"
          >
            {initialsOf(c.fullName)}
          </span>
          <button
            type="button"
            onClick={onOpen}
            className="block min-w-0 truncate text-left font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {c.fullName}
          </button>
        </span>
      </td>
      <td className="py-2 pr-3 tabular text-muted">{c.phone}</td>
      <td className="py-2 pr-3 text-right tabular">{c.visitCount}</td>
      <td className="hidden py-2 pr-3 text-right tabular sm:table-cell">
        {c.visitCount ? rwf(c.lifetimeSpendRwf) : "-"}
      </td>
      <td className="hidden py-2 text-muted sm:table-cell">{day(c.lastVisitAt)}</td>
    </tr>
  );
}

/** One figure of a profile. The value wraps rather than being cut off, so a large amount of money always reads whole. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-0 gap-1 p-3 sm:p-4">
      <span className="text-[12px] font-medium text-muted">{label}</span>
      <span className="text-[20px] leading-6 font-semibold tabular break-words sm:text-[24px] sm:leading-[30px]">
        {value}
      </span>
    </Card>
  );
}

function Profile({
  profile,
  manage,
  admin,
  hidden,
  onDialog,
}: {
  profile: PosCustomerProfile | null;
  manage: boolean;
  admin: boolean;
  hidden: boolean;
  onDialog: (d: Dialog) => void;
}) {
  const { run, pending } = usePosAction();
  if (!profile) {
    return (
      <Panel title="Profile">
        <p className="py-6 text-[13px] text-muted" data-field="no-selection">
          Choose a customer to see their details and what they have ordered.
        </p>
      </Panel>
    );
  }

  function download() {
    if (!profile) return;
    run(
      () => exportCustomerAction(profile.id),
      "Customer data downloaded",
      (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `customer-${profile.id.slice(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
    );
  }

  return (
    <div className="order-first flex min-w-0 flex-col gap-4 xl:order-none" data-field="profile">
      <Panel
        title={profile.fullName}
        note={`Customer since ${day(profile.createdAt)}`}
        action={
          manage ? (
            <Button size="sm" variant="secondary" onPress={() => onDialog({ kind: "edit" })}>
              Edit
            </Button>
          ) : undefined
        }
      >
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          <dt className="text-muted">Phone</dt>
          <dd className="tabular" data-field="phone">
            {profile.phone}
          </dd>
          <dt className="text-muted">Email</dt>
          <dd className="min-w-0 truncate" data-field="email">
            {profile.email ?? "-"}
          </dd>
          <dt className="text-muted">Offers</dt>
          <dd>
            {profile.marketingConsent ? (
              <Chip size="sm" variant="soft" color="success">
                <Chip.Label>Agreed {profile.consentAt ? day(profile.consentAt) : ""}</Chip.Label>
              </Chip>
            ) : (
              <Chip size="sm" variant="soft">
                <Chip.Label>No consent given</Chip.Label>
              </Chip>
            )}
          </dd>
          {profile.notes ? (
            <>
              <dt className="text-muted">Note</dt>
              <dd className="whitespace-pre-wrap" data-field="notes">
                {profile.notes}
              </dd>
            </>
          ) : null}
        </dl>
        {hidden ? <p className="text-[12px] text-muted">Contact details are partly hidden for your role.</p> : null}
        {admin ? (
          <div className="flex flex-wrap gap-2 border-t border-separator pt-3">
            <Button size="sm" variant="secondary" isDisabled={pending} onPress={() => onDialog({ kind: "merge" })}>
              Merge a duplicate
            </Button>
            <Button size="sm" variant="secondary" isDisabled={pending} onPress={download}>
              Download their data
            </Button>
            <Button size="sm" variant="danger-soft" isDisabled={pending} onPress={() => onDialog({ kind: "erase" })}>
              Erase details
            </Button>
          </div>
        ) : null}
      </Panel>

      <section aria-label="Customer summary" className="grid grid-cols-3 gap-3">
        <Stat label="Visits" value={String(profile.visitCount)} />
        <Stat
          label="Spent (RWF)"
          value={profile.visitCount ? Math.round(profile.lifetimeSpendRwf).toLocaleString("en-US") : "-"}
        />
        <Stat label="Last visit" value={day(profile.lastVisitAt)} />
      </section>

      <Panel title="Orders" note="Newest first, at the outlets you cover.">
        {profile.orders.length === 0 ? (
          <p className="py-2 text-[13px] text-muted" data-field="no-orders">
            No orders yet. Put this customer on a bill at the till and it will appear here.
          </p>
        ) : (
          <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
            {profile.orders.map((o) => (
              <li
                key={o.orderId}
                className="rounded-xl border border-separator px-3 py-2 text-[12px]"
                data-order={o.orderNumber}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold tabular">{o.orderNumber}</span>
                  <StatusChip color={ORDER_COLOR[o.status]}>{ORDER_STATUS_LABEL[o.status]}</StatusChip>
                </div>
                <div className="flex items-baseline justify-between gap-2 text-muted">
                  <span className="min-w-0 truncate">
                    {o.outletName}
                    {o.tableLabel ? ` · Table ${o.tableLabel}` : ""}
                  </span>
                  <span className="shrink-0 tabular text-foreground">{rwf(o.totalRwf)}</span>
                </div>
                <div className="text-muted">{day(o.createdAt)}</div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// ── Dialogs ──────────────────────────────────────────────────────────────────────────────────────────

function NewCustomerDialog({
  onClose,
  onCreated,
  onOpenExisting,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  onOpenExisting: (id: string) => void;
}) {
  const { run, pending } = usePosAction();
  const [form, setForm] = useState<CustomerForm>(emptyCustomerForm);
  const [existing, setExisting] = useState<{ id: string; message: string } | null>(null);
  const problem = customerFormProblem(form);

  function save() {
    setExisting(null);
    run(
      async () => {
        const r = await createCustomerAction(customerPayload(form));
        if (!r.ok && r.existingCustomerId) setExisting({ id: r.existingCustomerId, message: r.error });
        return r;
      },
      (c) => `${c.fullName} registered`,
      (c) => {
        onClose();
        onCreated(c.id);
      },
    );
  }

  return (
    <PosDialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title="New customer"
      subtitle="Name and phone are enough. The phone is how they are found again."
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button isDisabled={pending || problem !== null} onPress={save}>
            Save customer
          </Button>
        </>
      }
      onEnter={problem === null && !pending ? save : undefined}
    >
      <CustomerFormFields value={form} onChange={setForm} disabled={pending} />
      {existing ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-[13px]"
        >
          <span>{existing.message}</span>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => {
              onClose();
              onOpenExisting(existing.id);
            }}
          >
            Open that customer
          </Button>
        </div>
      ) : null}
    </PosDialog>
  );
}

function EditDialog({ profile, onClose }: { profile: PosCustomerProfile; onClose: () => void }) {
  const { run, pending } = usePosAction();
  const [form, setForm] = useState<CustomerForm>({
    fullName: profile.fullName,
    phone: profile.phone,
    email: profile.email ?? "",
    notes: profile.notes ?? "",
    marketingConsent: profile.marketingConsent,
  });
  const problem = customerFormProblem(form);
  const changed =
    form.fullName.trim() !== profile.fullName ||
    form.phone.trim() !== profile.phone ||
    form.email.trim() !== (profile.email ?? "") ||
    form.notes.trim() !== (profile.notes ?? "") ||
    form.marketingConsent !== profile.marketingConsent;

  function save() {
    run(
      () => updateCustomerAction(profile.id, customerPayload(form)),
      "Customer updated",
      () => onClose(),
    );
  }

  return (
    <PosDialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={`Edit ${profile.fullName}`}
      subtitle="Changing the phone number means it has not been confirmed yet."
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button isDisabled={pending || problem !== null || !changed} onPress={save}>
            Save changes
          </Button>
        </>
      }
      onEnter={problem === null && changed && !pending ? save : undefined}
    >
      <CustomerFormFields value={form} onChange={setForm} disabled={pending} />
    </PosDialog>
  );
}

function MergeDialog({
  profile,
  onClose,
  onMerged,
}: {
  profile: PosCustomerProfile;
  onClose: () => void;
  onMerged: (intoId: string) => void;
}) {
  const { run, pending } = usePosAction();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PosCustomerSummary[]>([]);
  const [target, setTarget] = useState<PosCustomerSummary | null>(null);
  const [reason, setReason] = useState("");
  const [, startSearch] = useTransition();
  const latest = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (text.length < CUSTOMER_SEARCH_MIN) {
      setFound([]);
      return;
    }
    const ticket = ++latest.current;
    const t = setTimeout(
      () =>
        startSearch(async () => {
          const r = await searchCustomersAction(text);
          if (ticket === latest.current && r.ok) setFound(r.value.customers.filter((c) => c.id !== profile.id));
        }),
      300,
    );
    return () => clearTimeout(t);
  }, [query, profile.id]);

  const ready = target !== null && reason.trim().length >= 3;
  return (
    <PosDialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={`Merge ${profile.fullName}`}
      subtitle="Use this when the same person was registered twice."
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            isDisabled={pending || !ready}
            onPress={() =>
              target &&
              run(
                () => mergeCustomerAction(profile.id, target.id, reason.trim()),
                `${profile.fullName} merged into ${target.fullName}`,
                () => {
                  onClose();
                  onMerged(target.id);
                },
              )
            }
          >
            Merge
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-muted">
        All of {profile.fullName}'s orders move to the customer you choose, and this record stops being listed. It is
        recorded with your name.
      </p>
      <SearchField aria-label="Find the customer to keep" value={query} onChange={setQuery} fullWidth>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Find the customer to keep" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <div className="flex flex-col gap-1.5" aria-live="polite">
        {found.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setTarget(c)}
            aria-pressed={target?.id === c.id}
            className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-accent ${
              target?.id === c.id ? "border-accent bg-accent/10" : "border-separator hover:border-accent"
            }`}
          >
            <span className="min-w-0 truncate font-medium">{c.fullName}</span>
            <span className="shrink-0 text-[12px] text-muted tabular">{c.phone}</span>
          </button>
        ))}
      </div>
      <TextField value={reason} onChange={setReason} fullWidth isRequired>
        <Label>Why are these the same person?</Label>
        <Input placeholder="e.g. registered twice with different spellings" maxLength={300} />
      </TextField>
    </PosDialog>
  );
}

function EraseDialog({
  profile,
  onClose,
  onErased,
}: {
  profile: PosCustomerProfile;
  onClose: () => void;
  onErased: () => void;
}) {
  const { run, pending } = usePosAction();
  const [reason, setReason] = useState("");
  return (
    <PosDialog
      isOpen
      onOpenChange={(o) => !o && onClose()}
      title={`Erase ${profile.fullName}'s details`}
      subtitle="This cannot be undone."
      footer={
        <>
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            isDisabled={pending || reason.trim().length < 3}
            onPress={() =>
              run(
                () => eraseCustomerAction(profile.id, reason.trim()),
                "Customer details erased",
                () => {
                  onClose();
                  onErased();
                },
              )
            }
          >
            Erase details
          </Button>
        </>
      }
    >
      <p className="text-[13px]">
        The name, phone, email and notes are removed for good. Their orders and the money on them stay in your records,
        shown as "Erased customer". Use this when the customer asks to be forgotten.
      </p>
      <TextField value={reason} onChange={setReason} fullWidth isRequired>
        <Label>Reason (recorded)</Label>
        <TextArea rows={2} maxLength={300} placeholder="e.g. the customer asked us to delete their details" />
      </TextField>
    </PosDialog>
  );
}
