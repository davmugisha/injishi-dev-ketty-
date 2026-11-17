"use client";

import { Archive, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Pencil, Plus } from "@gravity-ui/icons";
import { Button, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";
import type { PosVenue, TableStatus } from "@/server/pos";
import { bulkTablesAction } from "./actions";
import { Panel } from "./back-office";
import { kindsOf, OUTLET_TYPE_LABEL, outletTypeOf } from "./outlet-type";
import { BULK_MAX, bulkLabels, labelClashes, moved, nextNumber } from "./setup-logic";
import { selectClass } from "./setup-settings";
import { PosDialog, StatusChip, TABLE_COLOR, usePosAction } from "./shared";

/** What a step asks the screen to open: the add/edit/archive dialogs live on the screen. */
export type Open =
  | { kind: "area"; id?: string; name: string }
  | { kind: "table"; id?: string; areaId: string; label: string; seats: string }
  | { kind: "station"; id?: string; name: string; stationKind: "kitchen" | "bar"; printerName: string }
  | { kind: "register"; id?: string; name: string; deviceLabel: string }
  | { kind: "archive"; what: "area" | "table" | "station" | "register"; id: string; name: string };

type Reorder = (kind: "areas" | "tables" | "stations", ids: string[]) => void;

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-separator p-4 text-[13px] text-muted">{text}</p>;
}

function MoveButtons({
  name,
  first,
  last,
  onMove,
  disabled,
  sideways,
}: {
  name: string;
  first: boolean;
  last: boolean;
  onMove: (by: -1 | 1) => void;
  disabled: boolean;
  sideways?: boolean;
}) {
  const Back = sideways ? ChevronLeft : ArrowUp;
  const Fwd = sideways ? ChevronRight : ArrowDown;
  return (
    <span className="flex items-center">
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={`Move ${name} ${sideways ? "earlier" : "up"}`}
        isDisabled={disabled || first}
        onPress={() => onMove(-1)}
      >
        <Back className="size-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={`Move ${name} ${sideways ? "later" : "down"}`}
        isDisabled={disabled || last}
        onPress={() => onMove(1)}
      >
        <Fwd className="size-4" />
      </Button>
    </span>
  );
}

/** Dining areas with their tables: add one table or many, rename, reorder, archive. */
export function FloorStep({
  venue,
  onOpen,
  onBulk,
  onReorder,
  pending,
}: {
  venue: PosVenue;
  onOpen: (o: Open) => void;
  onBulk: (areaId: string) => void;
  onReorder: Reorder;
  pending: boolean;
}) {
  const [arranging, setArranging] = useState(false);
  const areaIds = venue.areas.map((a) => a.id);
  return (
    <Panel
      title="Dining areas and tables"
      note="Group tables into areas, in the order the floor shows them. A table with guests seated cannot be archived."
      action={
        <span className="flex flex-wrap gap-2">
          {venue.areas.length ? (
            <Button
              size="sm"
              variant={arranging ? "primary" : "ghost"}
              aria-pressed={arranging}
              data-ui="arrange"
              onPress={() => setArranging((v) => !v)}
            >
              {arranging ? "Done arranging" : "Arrange"}
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onPress={() => onOpen({ kind: "area", name: "" })}>
            <Plus className="size-4" /> Add area
          </Button>
        </span>
      }
    >
      {venue.areas.length === 0 ? (
        <Empty text="No dining areas yet. Add the first one, such as Main hall or Terrace, or start from a template on the Overview." />
      ) : (
        <div className="flex flex-col gap-3">
          {venue.areas.map((a, ai) => {
            const tables = venue.tables.filter((t) => t.areaId === a.id);
            const tableIds = tables.map((t) => t.id);
            return (
              <div key={a.id} className="rounded-xl border border-separator p-3" data-ui="area">
                <div className="flex flex-wrap items-center gap-2">
                  {arranging ? (
                    <MoveButtons
                      name={a.name}
                      first={ai === 0}
                      last={ai === venue.areas.length - 1}
                      disabled={pending}
                      onMove={(by) => onReorder("areas", moved(areaIds, a.id, by))}
                    />
                  ) : null}
                  <h3 className="text-[14px] font-semibold">{a.name}</h3>
                  <span className="text-[12px] text-muted">
                    {tables.length} {tables.length === 1 ? "table" : "tables"} ·{" "}
                    {tables.reduce((n, t) => n + t.seats, 0)} seats
                  </span>
                  <span className="flex-1" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => onOpen({ kind: "table", areaId: a.id, label: "", seats: "4" })}
                  >
                    <Plus className="size-4" /> Table
                  </Button>
                  <Button size="sm" variant="ghost" data-ui="bulk-tables" onPress={() => onBulk(a.id)}>
                    <Plus className="size-4" /> Many tables
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    aria-label={`Rename ${a.name}`}
                    onPress={() => onOpen({ kind: "area", id: a.id, name: a.name })}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    aria-label={`Archive ${a.name}`}
                    onPress={() => onOpen({ kind: "archive", what: "area", id: a.id, name: a.name })}
                  >
                    <Archive className="size-4" />
                  </Button>
                </div>
                {tables.length === 0 ? (
                  <p className="pt-2 text-[13px] text-muted">No tables in this area yet.</p>
                ) : (
                  <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {tables.map((t, ti) => (
                      <li key={t.id} className="flex flex-col gap-1">
                        <button
                          type="button"
                          className="flex w-full flex-col gap-1 rounded-lg border border-separator bg-surface-secondary p-2.5 text-left hover:border-accent"
                          onClick={() =>
                            onOpen({
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
                                {t.status.replaceAll("_", " ")}
                              </StatusChip>
                            ) : null}
                          </span>
                          <span className="text-[12px] text-muted">{t.seats} seats</span>
                        </button>
                        {arranging ? (
                          <span className="flex justify-center">
                            <MoveButtons
                              sideways
                              name={t.label}
                              first={ti === 0}
                              last={ti === tables.length - 1}
                              disabled={pending}
                              onMove={(by) => onReorder("tables", moved(tableIds, t.id, by))}
                            />
                          </span>
                        ) : null}
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
  );
}

/** Kitchen and bar stations: where tickets go. Their kinds make the outlet a restaurant, a bar or both. */
export function StationsStep({
  venue,
  onOpen,
  onReorder,
  pending,
}: {
  venue: PosVenue;
  onOpen: (o: Open) => void;
  onReorder: Reorder;
  pending: boolean;
}) {
  const outletType = outletTypeOf(kindsOf(venue.stations));
  const ids = venue.stations.map((s) => s.id);
  return (
    <Panel
      title="Kitchen and bar stations"
      note={
        <>
          <span data-ui="outlet-type" className="font-medium text-foreground">
            Outlet type: {OUTLET_TYPE_LABEL[outletType]}
          </span>{" "}
          (kitchen only is a restaurant, bar only a bar, both a restaurant and bar). A station is where tickets go. The
          printer is simulated: no device is contacted.
        </>
      }
      action={
        <Button
          size="sm"
          variant="secondary"
          onPress={() => onOpen({ kind: "station", name: "", stationKind: "kitchen", printerName: "" })}
        >
          <Plus className="size-4" /> Add station
        </Button>
      }
    >
      {venue.stations.length === 0 ? (
        <Empty text="No stations yet. Add a Kitchen and a Bar so orders can be sent for preparation." />
      ) : (
        <ul className="flex flex-col divide-y divide-separator">
          {venue.stations.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
              {venue.stations.length > 1 ? (
                <MoveButtons
                  name={s.name}
                  first={i === 0}
                  last={i === venue.stations.length - 1}
                  disabled={pending}
                  onMove={(by) => onReorder("stations", moved(ids, s.id, by))}
                />
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[14px] font-medium">{s.name}</span>
                <span className="text-[12px] text-muted">
                  {s.routedItems} {s.routedItems === 1 ? "item" : "items"} prepared here
                  {s.printerName ? ` · printer ${s.printerName}` : ""}
                  {s.openTickets ? ` · ${s.openTickets} open ${s.openTickets === 1 ? "ticket" : "tickets"}` : ""}
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
                  onOpen({
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
                onPress={() => onOpen({ kind: "archive", what: "station", id: s.id, name: s.name })}
              >
                <Archive className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Registers: a cashier opens a shift on one to take payments. */
export function RegistersStep({ venue, onOpen }: { venue: PosVenue; onOpen: (o: Open) => void }) {
  return (
    <Panel
      title="Registers"
      note="A cashier opens a shift on a register to take payments. Give each till its own register."
      action={
        <Button size="sm" variant="secondary" onPress={() => onOpen({ kind: "register", name: "", deviceLabel: "" })}>
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
                onPress={() => onOpen({ kind: "register", id: r.id, name: r.name, deviceLabel: r.deviceLabel ?? "" })}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                isIconOnly
                aria-label={`Archive ${r.name}`}
                onPress={() => onOpen({ kind: "archive", what: "register", id: r.id, name: r.name })}
              >
                <Archive className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * Many tables at once: a prefix and numbers (T 1 x 10 is T1 to T10). The preview names every label and flags those
 * already used here, and the API creates all or none, so a half-made batch cannot happen.
 */
export function BulkTablesDialog({
  outletId,
  venue,
  areaId,
  onClose,
  onVenue,
}: {
  outletId: string;
  venue: PosVenue;
  areaId: string | null;
  onClose: () => void;
  onVenue: (v: PosVenue) => void;
}) {
  const existing = venue.tables.map((t) => t.label);
  const [area, setArea] = useState(areaId ?? venue.areas[0]?.id ?? "");
  const [prefix, setPrefix] = useState("T");
  const [start, setStart] = useState(String(nextNumber("T", existing)));
  const [count, setCount] = useState("10");
  const [seats, setSeats] = useState("4");
  const { run, pending } = usePosAction();
  const n = Number(count);
  const s = Number(seats);
  const st = Number(start);
  const labels = bulkLabels(prefix, st, n);
  const clashes = labelClashes(labels, existing);
  const valid =
    !!area &&
    Number.isInteger(n) &&
    n >= 1 &&
    n <= BULK_MAX &&
    Number.isInteger(s) &&
    s >= 1 &&
    s <= 100 &&
    Number.isInteger(st) &&
    st >= 0 &&
    clashes.length === 0 &&
    (labels.at(-1)?.length ?? 0) <= 30;
  const areaName = venue.areas.find((a) => a.id === area)?.name ?? "";
  const submit = () =>
    run(
      () => bulkTablesAction(outletId, { areaId: area, prefix, start: st, count: n, seats: s }),
      `${labels.length} tables added to ${areaName}.`,
      (v) => {
        onVenue(v);
        onClose();
      },
    );

  return (
    <PosDialog
      isOpen={areaId !== null}
      onOpenChange={(o) => !o && onClose()}
      title="Add many tables"
      subtitle="All are added together, or none if a label is already used."
      onEnter={valid && !pending ? submit : undefined}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button variant="primary" data-ui="bulk-save" isDisabled={!valid || pending} onPress={submit}>
            Add {valid ? labels.length : ""} tables
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1 text-[13px] font-medium">
        Area
        <select className={selectClass} value={area} onChange={(e) => setArea(e.target.value)}>
          {venue.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          value={prefix}
          onChange={(v) => {
            setPrefix(v);
            setStart(String(nextNumber(v, existing)));
          }}
          fullWidth
        >
          <Label>Label prefix</Label>
          <Input placeholder="T" maxLength={20} />
        </TextField>
        <TextField value={start} onChange={(v) => setStart(v.replace(/\D/g, ""))} fullWidth>
          <Label>First number</Label>
          <Input inputMode="numeric" className="tabular" />
        </TextField>
        <TextField value={count} onChange={(v) => setCount(v.replace(/\D/g, ""))} fullWidth>
          <Label>How many (up to {BULK_MAX})</Label>
          <Input inputMode="numeric" className="tabular" />
        </TextField>
        <TextField value={seats} onChange={(v) => setSeats(v.replace(/\D/g, ""))} fullWidth>
          <Label>Seats at each</Label>
          <Input inputMode="numeric" className="tabular" />
        </TextField>
      </div>
      <div className="rounded-xl bg-surface-secondary p-3 text-[13px]" data-ui="bulk-preview">
        {labels.length ? (
          <>
            <p className="font-medium">
              {labels.length} tables: {labels[0]}
              {labels.length > 1 ? ` to ${labels.at(-1)}` : ""}, {s || 0} seats each
            </p>
            <p className="mt-1 break-words text-[12px] text-muted">{labels.join(", ")}</p>
          </>
        ) : (
          <p className="text-muted">Enter how many tables to add.</p>
        )}
        {clashes.length ? (
          <p className="mt-1 text-[12px] text-danger" data-ui="bulk-clash">
            Already used here: {clashes.join(", ")}. Change the prefix or the first number.
          </p>
        ) : null}
        {n > BULK_MAX ? <p className="mt-1 text-[12px] text-danger">Add at most {BULK_MAX} at a time.</p> : null}
      </div>
    </PosDialog>
  );
}
