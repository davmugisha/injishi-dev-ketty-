"use client";

import {
  Archive,
  Check,
  ChevronRight,
  CircleInfo,
  Display,
  House,
  LayoutCellsLarge,
  LayoutHeaderCells,
  ListUl,
  Persons,
  Receipt,
  Shapes4,
  ShieldKeyhole,
} from "@gravity-ui/icons";
import { Button, Card, Input, Label, TextField } from "@heroui/react";
import Link from "next/link";
import { type ComponentType, useCallback, useEffect, useState } from "react";
import type { TeamRolesData } from "@/features/owner/TeamRolesModel";
import type { PosOutlet, PosSetup, PosVenue, SetupStepKey, StationKind } from "@/server/pos";
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
  reorderAction,
  updateRegisterAction,
  updateStationAction,
  updateTableAction,
} from "./actions";
import { PosShell } from "./pos-shell";
import { ArchivedStep } from "./setup-archived";
import { BulkTablesDialog, FloorStep, type Open, RegistersStep, StationsStep } from "./setup-floor";
import { type SetupStep, stepState, visibleSteps } from "./setup-logic";
import { RoutingStep } from "./setup-routing";
import { ReceiptsStep, selectClass, VenueDetailsStep } from "./setup-settings";
import { TeamStep } from "./setup-team";
import { TemplatesCard } from "./setup-templates";
import { PosDialog, useDialogKey, usePosAction, useStickyTitle } from "./shared";

const ICON: Record<SetupStep, ComponentType<{ className?: string }>> = {
  overview: LayoutHeaderCells,
  floor: LayoutCellsLarge,
  stations: Shapes4,
  registers: Display,
  routing: ListUl,
  venue: House,
  receipts: Receipt,
  team: Persons,
  roles: ShieldKeyhole,
  archived: Archive,
};

/** The checklist rows, and the step (or screen) where each is done. */
const CHECKLIST: Record<SetupStepKey, { label: string; hint: string; step?: SetupStep; href?: string }> = {
  areas: { label: "Dining areas", hint: "Group your tables: Terrace, Main hall, Bar counter.", step: "floor" },
  tables: { label: "Tables", hint: "Add each table with the seats it has.", step: "floor" },
  stations: { label: "Kitchen and bar stations", hint: "Where tickets go to be prepared.", step: "stations" },
  registers: { label: "Registers", hint: "A till for each place a cashier takes payment.", step: "registers" },
  categories: { label: "Menu sections", hint: "Beer, Grill, Desserts…", href: "/pos/menu" },
  products: { label: "Menu products", hint: "Add what you sell, with its price.", href: "/pos/menu" },
  routing: { label: "Item routing", hint: "Send each dish to the kitchen and each drink to the bar.", step: "routing" },
  receipts: { label: "Receipt text", hint: "The line printed at the top of every bill.", step: "receipts" },
  team: { label: "Your team", hint: "Invite waiters, cashiers, kitchen and bar staff.", step: "team" },
};

/** What archiving does to each kind of thing, said plainly. */
const ARCHIVE_EFFECT: Record<"area" | "table" | "station" | "register", string> = {
  area: "will be hidden from the floor. An area that still has tables cannot be archived: move or archive them first.",
  table:
    "will be hidden from the floor and can no longer be seated. A table with guests or an unfinished bill cannot be archived.",
  station:
    "will stop receiving tickets and leave the kitchen and bar display. A station with routed items or open tickets cannot be archived.",
  register: "can no longer be used to open a shift. A register with a shift open cannot be archived.",
};

/**
 * Venue setup, one step at a time from a side rail grouped as Business (venue details, receipts), Operations (stations,
 * registers, routing), Floor (areas and tables) and Team (members, roles and permissions), then what was archived. The
 * team steps draw the business's own team manager (the one Settings → Team draws), so the owner manages staff without
 * leaving Setup; they are shown only to someone who may manage the team. Nothing here is required before the rest of the POS opens: the rail only shows what is still
 * empty. The step is in the address (`?step=routing`), so a reload or a shared link opens the same place, and a step
 * with unsaved changes asks before it is left. The API owns every rule (unique names, nothing in use is removed) and
 * answers a refusal with its reason, which shows as a toast.
 */
export function PosSetupView({
  outlets,
  outlet,
  venue: initialVenue,
  setup,
  can,
  initialStep,
  team,
}: {
  outlets: PosOutlet[];
  outlet: PosOutlet;
  venue: PosVenue;
  setup: PosSetup;
  can: string[];
  initialStep: SetupStep;
  /** The team manager's data, read only for someone who may manage the team (else null and no team steps). */
  team: TeamRolesData | null;
}) {
  const [venue, setVenue] = useState(initialVenue);
  useEffect(() => setVenue(initialVenue), [initialVenue]);
  const steps = visibleSteps(can);
  const [step, setStep] = useState<SetupStep>(steps.some((s) => s.key === initialStep) ? initialStep : "overview");
  const [dirty, setDirty] = useState(false);
  const [leaveTo, setLeaveTo] = useState<SetupStep | null>(null);
  const [dialog, setDialog] = useState<Open | null>(null);
  const [bulkArea, setBulkArea] = useState<string | null>(null);
  const { run, pending } = usePosAction();
  const dialogName = useStickyTitle(dialogTitle(dialog));
  const dialogKey = useDialogKey(dialog ? `${dialog.kind}:${dialog.id ?? "new"}` : null);
  const bulkKey = useDialogKey(bulkArea);
  const o = outlet.id;
  const close = () => setDialog(null);
  const apply = (v: PosVenue) => {
    setVenue(v);
    close();
  };
  const onDirty = useCallback((d: boolean) => setDirty(d), []);

  // On a phone the rail is a row of chips: keep the open step's chip in view.
  useEffect(() => {
    document
      .querySelector(`[data-ui=setup-rail] [data-step="${step}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [step]);

  // Unsaved settings survive neither a reload nor closing the tab without a warning.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const show = (next: SetupStep) => {
    setStep(next);
    setDirty(false);
    setLeaveTo(null);
    const url = new URL(window.location.href);
    url.searchParams.set("outlet", o);
    url.searchParams.set("step", next);
    window.history.replaceState(window.history.state, "", url);
    document.getElementById("setup-content")?.scrollTo({ top: 0 });
  };
  const go = (next: SetupStep) => {
    if (next === step) return;
    if (dirty) setLeaveTo(next);
    else show(next);
  };

  const reorder = (kind: "areas" | "tables" | "stations", ids: string[]) =>
    run(() => reorderAction(o, kind, ids), null, setVenue);

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
        const body = { areaId: dialog.areaId, label: dialog.label, seats: Number(dialog.seats) };
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
        return run(() => act(o, dialog.id), `${dialog.name} archived. You can restore it from Archived.`, apply);
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

  const states = Object.fromEntries(steps.map((s) => [s.key, stepState(s.key, venue, setup, outlet)])) as Record<
    SetupStep,
    ReturnType<typeof stepState>
  >;
  const work = steps.filter((s) => states[s.key] !== "info");
  const done = work.filter((s) => states[s.key] === "done").length;
  const current = steps.find((s) => s.key === step) ?? steps[0];
  const index = steps.findIndex((s) => s.key === step);
  const next = steps[index + 1];
  const teamVisible = steps.some((s) => s.key === "team");

  return (
    <PosShell
      board="PosSetup"
      title="Venue setup"
      subtitle="Set up your business, operations, floor and team in one place. You can use any screen at any time."
      outlet={outlet}
      outlets={outlets}
      outletId={outlet.id}
      switchHref="/pos/setup"
      can={can}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 md:flex-row md:px-6 md:pb-6">
        <nav
          aria-label="Setup steps"
          data-ui="setup-rail"
          className="shrink-0 md:w-[248px] md:overflow-y-auto md:rounded-[18px] md:border md:border-separator md:bg-surface md:p-3"
        >
          <p className="hidden px-2 pb-2 text-[12px] text-muted md:block" data-ui="rail-progress">
            {done} of {work.length} steps done
          </p>
          <ol className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
            {steps.map((s, i) => {
              const Icon = ICON[s.key];
              const on = s.key === step;
              const state = states[s.key];
              const heading = s.group && s.group !== steps[i - 1]?.group ? s.group : null;
              return (
                <li key={s.key} className="shrink-0">
                  {heading ? (
                    <p
                      data-ui="rail-group"
                      className="hidden px-2.5 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase md:block"
                    >
                      {heading}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    data-step={s.key}
                    aria-current={on ? "step" : undefined}
                    onClick={() => go(s.key)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left whitespace-nowrap md:whitespace-normal ${
                      on
                        ? "bg-[#0b8442] text-white"
                        : "border border-separator bg-surface hover:bg-default md:border-transparent md:bg-transparent"
                    }`}
                  >
                    <Icon className={`size-4 shrink-0 ${on ? "text-white" : "text-muted"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">{s.label}</span>
                      <span className={`hidden text-[11px] md:block ${on ? "text-white/80" : "text-muted"}`}>
                        {s.hint}
                      </span>
                    </span>
                    {state === "info" ? null : (
                      <span
                        data-state={state}
                        className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border ${
                          state === "done"
                            ? on
                              ? "border-white bg-white text-[#0b8442]"
                              : "border-success bg-success text-success-foreground"
                            : on
                              ? "border-white/70"
                              : "border-separator"
                        }`}
                      >
                        {state === "done" ? <Check className="size-3" aria-hidden="true" /> : null}
                        <span className="sr-only">{state === "done" ? " (done)" : " (not done yet)"}</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 hidden border-t border-separator pt-3 md:block">
            <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">Elsewhere</p>
            <Link
              className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[13px] hover:bg-default"
              href="/pos/menu"
            >
              Menu <ChevronRight className="ml-auto size-3.5 text-muted" />
            </Link>
          </div>
        </nav>

        <div
          id="setup-content"
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto"
          data-ui="setup-content"
        >
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[12px] text-muted">
                {current?.group ? `${current.group} · ` : ""}Step {index + 1} of {steps.length}
              </p>
              <h2 className="text-[20px] leading-7 font-semibold tracking-[-0.01em]" data-ui="step-title">
                {current?.label}
              </h2>
            </div>
            {next ? (
              <Button size="sm" variant="ghost" onPress={() => go(next.key)} data-ui="next-step">
                Next: {next.label} <ChevronRight className="size-4" />
              </Button>
            ) : null}
          </div>

          {step === "overview" ? (
            <>
              <Progress setup={setup} onStep={go} teamVisible={teamVisible} />
              <TemplatesCard outletId={o} venue={venue} onVenue={setVenue} />
              <Card className="flex flex-col gap-1 p-4">
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  <CircleInfo className="size-4 text-muted" /> Not available in the app yet
                </div>
                <p className="text-[13px] text-muted">
                  Adding more branches and your logo have no working screen yet, so they are not offered here rather
                  than sending you somewhere that does not open.
                </p>
              </Card>
            </>
          ) : null}
          {step === "floor" ? (
            <FloorStep venue={venue} onOpen={setDialog} onBulk={setBulkArea} onReorder={reorder} pending={pending} />
          ) : null}
          {step === "stations" ? (
            <StationsStep venue={venue} onOpen={setDialog} onReorder={reorder} pending={pending} />
          ) : null}
          {step === "registers" ? <RegistersStep venue={venue} onOpen={setDialog} /> : null}
          {step === "routing" ? <RoutingStep outletId={o} venue={venue} onVenue={setVenue} /> : null}
          {step === "venue" ? <VenueDetailsStep key={o} outlet={outlet} onDirty={onDirty} /> : null}
          {step === "receipts" ? <ReceiptsStep key={o} outlet={outlet} onDirty={onDirty} /> : null}
          {step === "team" || step === "roles" ? (
            <TeamStep
              data={team}
              tab={step === "team" ? "members" : "presets"}
              onTab={(t) => go(t === "members" ? "team" : "roles")}
            />
          ) : null}
          {step === "archived" ? <ArchivedStep outletId={o} venue={venue} onVenue={setVenue} /> : null}
        </div>
      </div>

      <PosDialog
        isOpen={leaveTo !== null}
        onOpenChange={(open) => !open && setLeaveTo(null)}
        title="Leave without saving?"
        footer={
          <>
            <Button variant="ghost" onPress={() => setLeaveTo(null)} data-ui="stay">
              Keep editing
            </Button>
            <Button variant="danger" onPress={() => leaveTo && show(leaveTo)} data-ui="discard">
              Discard changes
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-muted">
          {current?.label} has changes that are not saved. Leaving this step discards them.
        </p>
      </PosDialog>

      <BulkTablesDialog
        key={bulkKey}
        outletId={o}
        venue={venue}
        areaId={bulkArea}
        onClose={() => setBulkArea(null)}
        onVenue={setVenue}
      />

      <PosDialog
        key={dialogKey}
        isOpen={dialog !== null}
        onOpenChange={(open) => !open && close()}
        title={dialogName}
        onEnter={dialog && dialog.kind !== "archive" && valid && !pending ? submit : undefined}
        footer={
          <>
            {dialog?.kind === "table" && dialog.id ? (
              <Button
                variant="ghost"
                className="mr-auto text-danger"
                data-ui="archive-table"
                onPress={() =>
                  dialog.id &&
                  setDialog({ kind: "archive", what: "table", id: dialog.id, name: dialog.label || "This table" })
                }
              >
                Archive table
              </Button>
            ) : null}
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
            <span className="font-medium text-foreground">{dialog.name}</span> {ARCHIVE_EFFECT[dialog.what]} Its history
            is kept, and you can restore it from Archived. If it is in use, Injishi says why and nothing changes.
          </p>
        ) : null}
      </PosDialog>
    </PosShell>
  );
}

function dialogTitle(d: Open | null): string {
  if (!d) return "";
  if (d.kind === "archive") return `Archive ${d.what}?`;
  const noun = { area: "dining area", table: "table", station: "station", register: "register" }[d.kind];
  return `${d.id ? "Edit" : "Add"} ${noun}`;
}

/** The checklist: what is set up, what is not, and where to do it. Informational only. */
function Progress({
  setup,
  onStep,
  teamVisible,
}: {
  setup: PosSetup;
  onStep: (s: SetupStep) => void;
  /** Whether this person may open the team steps (else the team row is information only). */
  teamVisible: boolean;
}) {
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
          const meta = CHECKLIST[s.key];
          const label = (
            <>
              {meta.label}
              <span className="sr-only">{s.done ? " (done)" : " (not done yet)"}</span>
            </>
          );
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
                {meta.step && (teamVisible || meta.step !== "team") ? (
                  <button
                    type="button"
                    className="text-left text-[14px] font-medium hover:text-accent-soft-foreground"
                    onClick={() => meta.step && onStep(meta.step)}
                  >
                    {label}
                  </button>
                ) : meta.href ? (
                  <Link href={meta.href} className="text-[14px] font-medium hover:text-accent-soft-foreground">
                    {label}
                  </Link>
                ) : (
                  <span className="text-[14px] font-medium">{label}</span>
                )}
                <p className="text-[12px] text-muted">{s.done ? `${s.count} set up` : meta.hint}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
