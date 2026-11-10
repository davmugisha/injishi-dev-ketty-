"use client";

import { Archive, Check, CircleInfo, Pencil, Plus } from "@gravity-ui/icons";
import { Button, Card, Input, Label, TextField } from "@heroui/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  PaymentMethod,
  PosOutlet,
  PosSetup,
  PosVenue,
  PosVenueStation,
  SetupStepKey,
  StationKind,
  TableStatus,
} from "@/server/pos";
import {
  archiveAreaAction,
  archiveRegisterAction,
  archiveStationAction,
  archiveTableAction,
  createAreaAction,
  createRegisterAction,
  createStationAction,
  createTableAction,
  renameAreaAction,
  setRouteAction,
  updateRegisterAction,
  updateSettingsAction,
  updateStationAction,
  updateTableAction,
} from "./actions";
import { METHOD_NAME, Panel } from "./back-office";
import { PosShell } from "./pos-shell";
import { PosDialog, StatusChip, TABLE_COLOR, useDialogKey, usePosAction, useStickyTitle } from "./shared";

/** Every step, in the order an owner meets them: what it is, and where it is done. */
const STEPS: Record<SetupStepKey, { label: string; hint: string; anchor?: string; href?: string }> = {
  areas: { label: "Dining areas", hint: "Group your tables: Terrace, Main hall, Bar counter.", anchor: "floor" },
  tables: { label: "Tables", hint: "Add each table with the seats it has.", anchor: "floor" },
  stations: { label: "Kitchen and bar stations", hint: "Where tickets go to be prepared.", anchor: "stations" },
  registers: { label: "Registers", hint: "A till for each place a cashier takes payment.", anchor: "registers" },
  categories: { label: "Menu sections", hint: "Beer, Grill, Desserts…", href: "/pos/menu" },
  products: { label: "Menu products", hint: "Add what you sell, with its price.", href: "/pos/menu" },
  routing: {
    label: "Item routing",
    hint: "Send each dish to the kitchen and each drink to the bar.",
    anchor: "routing",
  },
  receipts: { label: "Receipt text", hint: "The line printed at the top of every bill.", anchor: "settings" },
  team: { label: "Your team", hint: "Invite waiters, cashiers, kitchen and bar staff.", href: "/settings/team" },
};

const METHODS: PaymentMethod[] = [
  "cash",
  "mtn_momo",
  "airtel_money",
  "card",
  "bank_transfer",
  "voucher",
  "customer_credit",
];
const NO_TICKET = "";

const selectClass =
  "h-10 w-full rounded-lg border border-separator bg-field px-3 text-[14px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent";

type Dialog =
  | { kind: "area"; id?: string; name: string }
  | { kind: "table"; id?: string; areaId: string; label: string; seats: string }
  | { kind: "station"; id?: string; name: string; stationKind: StationKind; printerName: string }
  | { kind: "register"; id?: string; name: string; deviceLabel: string }
  | { kind: "archive"; what: "area" | "table" | "station" | "register"; id: string; name: string };

/**
 * Venue setup: the floor, the stations, the registers and where each menu item is prepared. Nothing here is
 * required before the rest of the POS opens; the checklist only shows what is still empty. The API owns every
 * rule (unique names, nothing in use is removed) and answers a refusal with its reason, which shows as a toast.
 */
export function PosSetupView({
  outlets,
  outlet,
  venue: initialVenue,
  setup,
  can,
}: {
  outlets: PosOutlet[];
  outlet: PosOutlet;
  venue: PosVenue;
  setup: PosSetup;
  can: string[];
}) {
  const [venue, setVenue] = useState(initialVenue);
  useEffect(() => setVenue(initialVenue), [initialVenue]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [query, setQuery] = useState("");
  const { run, pending } = usePosAction();
  const dialogName = useStickyTitle(dialogTitle(dialog));
  const dialogKey = useDialogKey(dialog ? `${dialog.kind}:${dialog.id ?? "new"}` : null);
  const o = outlet.id;
  const close = () => setDialog(null);
  const apply = (v: PosVenue) => {
    setVenue(v);
    close();
  };

  const stationName = useMemo(() => new Map(venue.stations.map((s) => [s.id, s.name])), [venue.stations]);
  const routing = venue.routing.filter((r) =>
    `${r.name} ${r.categoryName ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const unrouted = venue.routing.filter((r) => !r.stationId).length;

  const submit = () => {
    if (!dialog) return;
    switch (dialog.kind) {
      case "area":
        return run(
          () => (dialog.id ? renameAreaAction(o, dialog.id, dialog.name) : createAreaAction(o, dialog.name)),
          dialog.id ? "Area renamed." : "Area added.",
          apply,
        );
      case "table": {
        const seats = Number(dialog.seats);
        const body = { areaId: dialog.areaId, label: dialog.label, seats };
        return run(
          () => (dialog.id ? updateTableAction(o, dialog.id, body) : createTableAction(o, body)),
          dialog.id ? "Table saved." : "Table added.",
          apply,
        );
      }
      case "station": {
        const body = { name: dialog.name, kind: dialog.stationKind, printerName: dialog.printerName.trim() || null };
        return run(
          () => (dialog.id ? updateStationAction(o, dialog.id, body) : createStationAction(o, body)),
          dialog.id ? "Station saved." : "Station added.",
          apply,
        );
      }
      case "register": {
        const body = { name: dialog.name, deviceLabel: dialog.deviceLabel.trim() || null };
        return run(
          () => (dialog.id ? updateRegisterAction(o, dialog.id, body) : createRegisterAction(o, body)),
          dialog.id ? "Register saved." : "Register added.",
          apply,
        );
      }
      case "archive": {
        const act = {
          area: archiveAreaAction,
          table: archiveTableAction,
          station: archiveStationAction,
          register: archiveRegisterAction,
        }[dialog.what];
        return run(() => act(o, dialog.id), `${dialog.name} archived.`, apply);
      }
    }
  };

  const valid = (() => {
    if (!dialog) return false;
    if (dialog.kind === "archive") return true;
    if (dialog.kind === "table")
      return (
        !!dialog.areaId &&
        dialog.label.trim().length > 0 &&
        Number.isInteger(Number(dialog.seats)) &&
        Number(dialog.seats) >= 1 &&
        Number(dialog.seats) <= 100
      );
    return dialog.name.trim().length > 0;
  })();

  return (
    <PosShell
      board="PosSetup"
      title="Venue setup"
      subtitle="Set up your floor, stations and registers. You can use any screen at any time."
      outlet={outlet}
      outlets={outlets}
      outletId={outlet.id}
      switchHref="/pos/setup"
      can={can}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl shrink-0 flex-col gap-4 px-4 pb-6 md:px-6">
          <Progress setup={setup} />

          <section id="floor" aria-label="Dining areas and tables" className="scroll-mt-4">
            <Panel
              title="Dining areas and tables"
              note="Group tables into areas. A table with guests seated cannot be archived."
              action={
                <Button size="sm" variant="secondary" onPress={() => setDialog({ kind: "area", name: "" })}>
                  <Plus className="size-4" /> Add area
                </Button>
              }
            >
              {venue.areas.length === 0 ? (
                <Empty text="No dining areas yet. Add the first one, such as Main hall or Terrace." />
              ) : (
                <div className="flex flex-col gap-3">
                  {venue.areas.map((a) => {
                    const tables = venue.tables.filter((t) => t.areaId === a.id);
                    return (
                      <div key={a.id} className="rounded-xl border border-separator p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[14px] font-semibold">{a.name}</h3>
                          <span className="text-[12px] text-muted">
                            {tables.length} {tables.length === 1 ? "table" : "tables"} ·{" "}
                            {tables.reduce((n, t) => n + t.seats, 0)} seats
                          </span>
                          <span className="flex-1" />
                          <Button
                            size="sm"
                            variant="ghost"
                            onPress={() => setDialog({ kind: "table", areaId: a.id, label: "", seats: "4" })}
                          >
                            <Plus className="size-4" /> Table
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            aria-label={`Rename ${a.name}`}
                            onPress={() => setDialog({ kind: "area", id: a.id, name: a.name })}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            aria-label={`Archive ${a.name}`}
                            onPress={() => setDialog({ kind: "archive", what: "area", id: a.id, name: a.name })}
                          >
                            <Archive className="size-4" />
                          </Button>
                        </div>
                        {tables.length === 0 ? (
                          <p className="pt-2 text-[13px] text-muted">No tables in this area yet.</p>
                        ) : (
                          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                            {tables.map((t) => (
                              <li key={t.id}>
                                <button
                                  type="button"
                                  className="flex w-full flex-col gap-1 rounded-lg border border-separator bg-surface-secondary p-2.5 text-left hover:border-accent"
                                  onClick={() =>
                                    setDialog({
                                      kind: "table",
                                      id: t.id,
                                      areaId: t.areaId,
                                      label: t.label,
                                      seats: String(t.seats),
                                    })
                                  }
                                  aria-label={`Edit table ${t.label}`}
                                >
                                  <span className="flex items-center justify-between gap-2">
                                    <span className="truncate text-[14px] font-medium">{t.label}</span>
                                    {t.status !== "available" ? (
                                      <StatusChip color={TABLE_COLOR[t.status as TableStatus]}>
                                        {t.status.replace("_", " ")}
                                      </StatusChip>
                                    ) : null}
                                  </span>
                                  <span className="text-[12px] text-muted">{t.seats} seats</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </section>

          <section id="stations" aria-label="Kitchen and bar stations" className="scroll-mt-4">
            <Panel
              title="Kitchen and bar stations"
              note="A station is where tickets go. The printer is simulated: no device is contacted."
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => setDialog({ kind: "station", name: "", stationKind: "kitchen", printerName: "" })}
                >
                  <Plus className="size-4" /> Add station
                </Button>
              }
            >
              {venue.stations.length === 0 ? (
                <Empty text="No stations yet. Add a Kitchen and a Bar so orders can be sent for preparation." />
              ) : (
                <ul className="flex flex-col divide-y divide-separator">
                  {venue.stations.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[14px] font-medium">{s.name}</span>
                        <span className="text-[12px] text-muted">
                          {s.routedItems} {s.routedItems === 1 ? "item" : "items"} prepared here
                          {s.printerName ? ` · printer ${s.printerName}` : ""}
                          {s.openTickets
                            ? ` · ${s.openTickets} open ${s.openTickets === 1 ? "ticket" : "tickets"}`
                            : ""}
                        </span>
                      </div>
                      <StatusChip color={s.kind === "bar" ? "accent" : "warning"}>
                        {s.kind === "bar" ? "Bar" : "Kitchen"}
                      </StatusChip>
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        aria-label={`Edit ${s.name}`}
                        onPress={() =>
                          setDialog({
                            kind: "station",
                            id: s.id,
                            name: s.name,
                            stationKind: s.kind,
                            printerName: s.printerName ?? "",
                          })
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        aria-label={`Archive ${s.name}`}
                        onPress={() => setDialog({ kind: "archive", what: "station", id: s.id, name: s.name })}
                      >
                        <Archive className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>

          <section id="registers" aria-label="Registers" className="scroll-mt-4">
            <Panel
              title="Registers"
              note="A cashier opens a shift on a register to take payments."
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => setDialog({ kind: "register", name: "", deviceLabel: "" })}
                >
                  <Plus className="size-4" /> Add register
                </Button>
              }
            >
              {venue.registers.length === 0 ? (
                <Empty text="No registers yet. Add one so a cashier can open a shift." />
              ) : (
                <ul className="flex flex-col divide-y divide-separator">
                  {venue.registers.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[14px] font-medium">{r.name}</span>
                        <span className="text-[12px] text-muted">{r.deviceLabel ?? "No device label"}</span>
                      </div>
                      {r.hasOpenShift ? <StatusChip color="success">Shift open</StatusChip> : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        aria-label={`Edit ${r.name}`}
                        onPress={() =>
                          setDialog({ kind: "register", id: r.id, name: r.name, deviceLabel: r.deviceLabel ?? "" })
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        isIconOnly
                        aria-label={`Archive ${r.name}`}
                        onPress={() => setDialog({ kind: "archive", what: "register", id: r.id, name: r.name })}
                      >
                        <Archive className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </section>

          <section id="routing" aria-label="Item routing" className="scroll-mt-4">
            <Panel
              title="Where each item is prepared"
              note={
                unrouted
                  ? `${unrouted} of ${venue.routing.length} items send no ticket (right for a bottle handed over the counter).`
                  : "Every item sends a ticket to a station."
              }
            >
              {venue.routing.length === 0 ? (
                <Empty text="No menu items yet. Add products on the Menu screen, then route them here." />
              ) : (
                <div className="flex flex-col gap-3">
                  <TextField value={query} onChange={setQuery} aria-label="Search items" fullWidth>
                    <Input placeholder="Search items or sections" />
                  </TextField>
                  <div className="max-h-[420px] overflow-y-auto rounded-xl border border-separator">
                    <ul className="divide-y divide-separator">
                      {routing.map((r) => (
                        <li key={r.serviceItemId} className="flex flex-wrap items-center gap-3 px-3 py-2">
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-[14px]">{r.name}</span>
                            <span className="text-[12px] text-muted">{r.categoryName ?? "No section"}</span>
                          </div>
                          <select
                            aria-label={`Station for ${r.name}`}
                            className={`${selectClass} max-w-[220px]`}
                            value={r.stationId ?? NO_TICKET}
                            disabled={pending}
                            onChange={(e) =>
                              run(
                                () => setRouteAction(o, r.serviceItemId, e.target.value || null),
                                e.target.value
                                  ? `${r.name} goes to ${stationName.get(e.target.value)}.`
                                  : `${r.name} sends no ticket.`,
                                setVenue,
                              )
                            }
                          >
                            <option value={NO_TICKET}>No ticket</option>
                            {venue.stations.map((s: PosVenueStation) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </li>
                      ))}
                      {routing.length === 0 ? (
                        <li className="px-3 py-4 text-[13px] text-muted">No item matches "{query}".</li>
                      ) : null}
                    </ul>
                  </div>
                </div>
              )}
            </Panel>
          </section>

          <section id="settings" aria-label="Receipts and payments" className="scroll-mt-4">
            <SettingsPanel key={outlet.id} outlet={outlet} />
          </section>

          <Card className="flex flex-col gap-1 p-4">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              <CircleInfo className="size-4 text-muted" /> Not available in the app yet
            </div>
            <p className="text-[13px] text-muted">
              Editing your business details, adding more branches, and your logo have no working screen yet, so they are
              not offered here rather than sending you somewhere that does not open. Product photos are not available
              either: the menu has nowhere to store them. Your team is managed in{" "}
              <Link className="text-accent underline-offset-2 hover:underline" href="/settings/team">
                team settings
              </Link>
              .
            </p>
          </Card>
        </div>
      </div>

      <PosDialog
        key={dialogKey}
        isOpen={dialog !== null}
        onOpenChange={(open) => !open && close()}
        title={dialogName}
        onEnter={dialog && dialog.kind !== "archive" && valid && !pending ? submit : undefined}
        footer={
          <>
            <Button variant="ghost" onPress={close}>
              Cancel
            </Button>
            <Button
              variant={dialog?.kind === "archive" ? "danger" : "primary"}
              isDisabled={!valid || pending}
              onPress={submit}
            >
              {dialog?.kind === "archive" ? "Archive" : "Save"}
            </Button>
          </>
        }
      >
        {dialog?.kind === "area" ? (
          <TextField
            value={dialog.name}
            onChange={(v) => setDialog({ ...dialog, name: v })}
            fullWidth
            isRequired
            autoFocus
          >
            <Label>Area name</Label>
            <Input placeholder="Main hall" maxLength={60} />
          </TextField>
        ) : null}
        {dialog?.kind === "table" ? (
          <>
            <TextField
              value={dialog.label}
              onChange={(v) => setDialog({ ...dialog, label: v })}
              fullWidth
              isRequired
              autoFocus
            >
              <Label>Table label</Label>
              <Input placeholder="T1" maxLength={30} />
            </TextField>
            <TextField
              value={dialog.seats}
              onChange={(v) => setDialog({ ...dialog, seats: v.replace(/[^\d]/g, "") })}
              fullWidth
              isRequired
            >
              <Label>Seats</Label>
              <Input inputMode="numeric" className="tabular" />
            </TextField>
            <label className="flex flex-col gap-1 text-[13px] font-medium">
              Area
              <select
                className={selectClass}
                value={dialog.areaId}
                onChange={(e) => setDialog({ ...dialog, areaId: e.target.value })}
              >
                {venue.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        {dialog?.kind === "station" ? (
          <>
            <TextField
              value={dialog.name}
              onChange={(v) => setDialog({ ...dialog, name: v })}
              fullWidth
              isRequired
              autoFocus
            >
              <Label>Station name</Label>
              <Input placeholder="Main kitchen" maxLength={60} />
            </TextField>
            <label className="flex flex-col gap-1 text-[13px] font-medium">
              Kind
              <select
                className={selectClass}
                value={dialog.stationKind}
                onChange={(e) => setDialog({ ...dialog, stationKind: e.target.value as StationKind })}
              >
                <option value="kitchen">Kitchen (food)</option>
                <option value="bar">Bar (drinks)</option>
              </select>
            </label>
            <TextField value={dialog.printerName} onChange={(v) => setDialog({ ...dialog, printerName: v })} fullWidth>
              <Label>Printer name (simulated)</Label>
              <Input placeholder="Optional" maxLength={60} />
            </TextField>
          </>
        ) : null}
        {dialog?.kind === "register" ? (
          <>
            <TextField
              value={dialog.name}
              onChange={(v) => setDialog({ ...dialog, name: v })}
              fullWidth
              isRequired
              autoFocus
            >
              <Label>Register name</Label>
              <Input placeholder="Till 1" maxLength={60} />
            </TextField>
            <TextField value={dialog.deviceLabel} onChange={(v) => setDialog({ ...dialog, deviceLabel: v })} fullWidth>
              <Label>Device label</Label>
              <Input placeholder="Optional, such as Tablet 2" maxLength={60} />
            </TextField>
          </>
        ) : null}
        {dialog?.kind === "archive" ? (
          <p className="text-[14px] text-muted">
            <span className="font-medium text-foreground">{dialog.name}</span> will be hidden from the floor and the
            menu. Its history is kept. If it is in use, Injishi will say why and nothing changes.
          </p>
        ) : null}
      </PosDialog>
    </PosShell>
  );
}

function dialogTitle(d: Dialog | null): string {
  if (!d) return "";
  if (d.kind === "archive") return `Archive ${d.what}?`;
  const noun = { area: "dining area", table: "table", station: "station", register: "register" }[d.kind];
  return `${d.id ? "Edit" : "Add"} ${noun}`;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-separator p-4 text-[13px] text-muted">{text}</p>;
}

/** The checklist: what is set up, what is not, and where to do it. Informational only. */
function Progress({ setup }: { setup: PosSetup }) {
  const pct = Math.round((setup.doneCount / Math.max(setup.total, 1)) * 100);
  return (
    <Card className="gap-3 p-4" aria-label="Setup progress">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold">
            {setup.doneCount === setup.total
              ? "Your venue is fully set up"
              : `${setup.doneCount} of ${setup.total} steps done`}
          </h2>
          <p className="text-[12px] text-muted">
            Counted from what you have created. Nothing here blocks the till, the kitchen or the reports.
          </p>
        </div>
        <span className="text-[20px] font-semibold tabular">{pct}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-default"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Setup progress"
      >
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {setup.steps.map((s) => {
          const meta = STEPS[s.key];
          const to = meta.href ?? `#${meta.anchor}`;
          return (
            <li key={s.key} className="flex items-start gap-2.5 py-1.5">
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  s.done ? "border-success bg-success text-success-foreground" : "border-separator text-transparent"
                }`}
                aria-hidden="true"
              >
                <Check className="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={to} className="text-[14px] font-medium hover:text-accent">
                  {meta.label}
                  <span className="sr-only">{s.done ? " (done)" : " (not done yet)"}</span>
                </Link>
                <p className="text-[12px] text-muted">{s.done ? `${s.count} set up` : meta.hint}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Tax mode, receipt text, the payment methods offered and the largest discount a till may give alone. */
function SettingsPanel({ outlet }: { outlet: PosOutlet }) {
  const s = outlet.settings;
  const [taxMode, setTaxMode] = useState(s.taxMode);
  const [header, setHeader] = useState(s.receiptHeader);
  const [footer, setFooter] = useState(s.receiptFooter);
  const [limit, setLimit] = useState(String(s.discountLimitBps / 100));
  const [methods, setMethods] = useState<PaymentMethod[]>(s.enabledMethods);
  const { run, pending } = usePosAction();
  const pct = Number(limit);
  const valid = methods.length > 0 && Number.isFinite(pct) && pct >= 0 && pct <= 100;
  const toggle = (m: PaymentMethod) =>
    setMethods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  return (
    <Panel title="Receipts and payments" note="Applies to this outlet. Money is always in Rwandan francs (RWF).">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-[13px] font-medium">
          Prices on the menu
          <select
            className={selectClass}
            value={taxMode}
            onChange={(e) => setTaxMode(e.target.value as typeof taxMode)}
          >
            <option value="exclusive">Tax is added on top of these prices</option>
            <option value="inclusive">These prices already include tax</option>
          </select>
        </label>
        <TextField value={limit} onChange={(v) => setLimit(v.replace(/[^\d.]/g, ""))} fullWidth>
          <Label>Largest discount a cashier gives alone (%)</Label>
          <Input inputMode="decimal" className="tabular" />
        </TextField>
        <TextField value={header} onChange={setHeader} fullWidth>
          <Label>Receipt header</Label>
          <Input placeholder="Your business name and address" maxLength={200} />
        </TextField>
        <TextField value={footer} onChange={setFooter} fullWidth>
          <Label>Receipt footer</Label>
          <Input placeholder="Thank you, come again" maxLength={200} />
        </TextField>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[13px] font-medium">Payment methods offered</legend>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => {
            const on = methods.includes(m);
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(m)}
                className={`min-h-9 rounded-full border px-3 text-[13px] font-medium ${
                  on
                    ? "border-accent bg-accent-soft text-accent-soft-foreground"
                    : "border-separator text-muted hover:bg-default"
                }`}
              >
                {METHOD_NAME[m]}
              </button>
            );
          })}
        </div>
        <p className="text-[12px] text-muted">
          Mobile money and card payments are simulated until a payment provider is connected.
        </p>
      </fieldset>
      <div className="flex justify-end">
        <Button
          variant="primary"
          isDisabled={!valid || pending}
          onPress={() =>
            run(
              () =>
                updateSettingsAction(outlet.id, {
                  taxMode,
                  receiptHeader: header.trim(),
                  receiptFooter: footer.trim(),
                  discountLimitBps: Math.round(pct * 100),
                  enabledMethods: methods,
                }),
              "Receipt and payment settings saved.",
            )
          }
        >
          Save settings
        </Button>
      </div>
    </Panel>
  );
}
