"use client";

import { Calendar, CircleCheck, Clock, Lock, Passport, ShieldCheck, Xmark } from "@gravity-ui/icons";
import { Alert, Button, Checkbox, Chip, Drawer, Input, Label, Separator, TextField, toast } from "@heroui/react";
import { ActionBar, NativeSelect } from "@heroui-pro/react";
import { LinkButton } from "@injishi/ui";
import { type ReactNode, useState, useTransition } from "react";
import type { PayRunException } from "../../model/payroll.ts";
import { useBoardHref, useHrActions } from "../mount.tsx";
import { Person, Tip } from "../people/parts";
import { EmployerNumberForm } from "./employer-number";

const GROUPS: { id: string; title: string; icon: ReactNode; codes: string[] }[] = [
  {
    id: "employer",
    title: "RSSB employer number",
    icon: <ShieldCheck className="size-4" />,
    codes: ["missing_rssb_employer_number"],
  },
  { id: "rssb", title: "RSSB numbers", icon: <ShieldCheck className="size-4" />, codes: ["missing_rssb_number"] },
  { id: "id", title: "ID documents", icon: <Passport className="size-4" />, codes: ["missing_id"] },
  {
    id: "time",
    title: "Clock records",
    icon: <Clock className="size-4" />,
    codes: ["open_attendance", "unvalidated_attendance", "overtime_day_unknown"],
  },
];

/** One person's missing RSSB number, typed and saved here. */
function RssbFix({ x, runId }: { x: PayRunException; runId: string | null }) {
  const { fixBlocker } = useHrActions();
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const save = () =>
    start(async () => {
      const r = await fixBlocker(x.employeeId ?? "", { rssbNumber: value.trim() }, runId);
      if (r.ok) {
        setDone(true);
        toast.success(`${x.who ?? "RSSB number"} saved`);
      } else toast.danger(r.error);
    });
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-secondary p-3">
      <Person name={x.who ?? ""} className="min-w-[160px] flex-1" />
      {done ? (
        <Chip size="sm" variant="soft" color="success">
          <CircleCheck className="size-3" />
          <Chip.Label>Saved</Chip.Label>
        </Chip>
      ) : (
        <>
          <TextField value={value} onChange={setValue} className="w-[150px]" aria-label={`RSSB number of ${x.who}`}>
            <Input placeholder="RSSB number" className="tabular" />
          </TextField>
          <Button size="sm" isPending={pending} isDisabled={value.trim().length < 3} onPress={save}>
            Save
          </Button>
        </>
      )}
    </div>
  );
}

/** One person's missing ID: the kind and the number. */
function IdFix({ x, runId }: { x: PayRunException; runId: string | null }) {
  const { fixBlocker } = useHrActions();
  const [kind, setKind] = useState<"national_id" | "passport">("national_id");
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const save = () =>
    start(async () => {
      const r = await fixBlocker(x.employeeId ?? "", { idDocumentType: kind, idDocumentNumber: value.trim() }, runId);
      if (r.ok) {
        setDone(true);
        toast.success(`${x.who ?? "ID"} saved`);
      } else toast.danger(r.error);
    });
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-secondary p-3">
      <Person name={x.who ?? ""} className="min-w-[160px] flex-1" />
      {done ? (
        <Chip size="sm" variant="soft" color="success">
          <CircleCheck className="size-3" />
          <Chip.Label>Saved</Chip.Label>
        </Chip>
      ) : (
        <>
          <NativeSelect className="w-[130px]">
            <NativeSelect.Trigger
              aria-label={`ID type of ${x.who}`}
              value={kind}
              onChange={(e) => setKind(e.target.value === "passport" ? "passport" : "national_id")}
            >
              <NativeSelect.Option value="national_id">National ID</NativeSelect.Option>
              <NativeSelect.Option value="passport">Passport</NativeSelect.Option>
              <NativeSelect.Indicator />
            </NativeSelect.Trigger>
          </NativeSelect>
          <TextField value={value} onChange={setValue} className="w-[170px]" aria-label={`ID number of ${x.who}`}>
            <Input placeholder={kind === "passport" ? "PC1234567" : "1 1990 8 0012345 1 23"} className="tabular" />
          </TextField>
          <Button size="sm" isPending={pending} isDisabled={value.trim().length < 3} onPress={save}>
            Save
          </Button>
        </>
      )}
    </div>
  );
}

type Rec = NonNullable<PayRunException["record"]>;

const KIGALI = "Africa/Kigali";
/** "07:00" in Kigali for an ISO instant. */
const hm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: KIGALI }).format(
    new Date(iso),
  );
/** "Thu 22 Oct" in Kigali for an ISO instant. */
const dayOf = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: KIGALI }).format(
    new Date(iso),
  );
/** The end a forgotten clock-out most likely had: eight hours, a standard shift. */
const shiftEnd = (iso: string) => hm(new Date(Date.parse(iso) + 8 * 3_600_000).toISOString());

/** A clock record that stops the month: clock the person out on that day, or mark it checked. */
function ClockFix({
  x,
  runId,
  hold,
  isSelected,
  onSelect,
}: {
  x: PayRunException;
  runId: string | null;
  hold: ReactNode;
  isSelected: boolean;
  onSelect: (on: boolean) => void;
}) {
  const { settleClockRecord } = useHrActions();
  const rec = x.record;
  const [time, setTime] = useState(() => (rec ? shiftEnd(rec.clockInAt) : ""));
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const settle = (kind: "out" | "validate") =>
    start(async () => {
      if (!rec) return;
      const r = await settleClockRecord(
        kind === "out" ? { kind, recordId: rec.id, clockInAt: rec.clockInAt, time } : { kind, recordId: rec.id },
        runId,
      );
      if (r.ok) {
        setDone(true);
        toast.success(`${x.who ?? "Record"} ${kind === "out" ? `clocked out at ${time}` : "checked"}`);
      } else toast.danger(r.error);
    });
  const open = x.code === "open_attendance";
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
        isSelected ? "bg-accent-soft" : "bg-surface-secondary"
      }`}
    >
      {!done ? (
        <Checkbox isSelected={isSelected} onChange={onSelect} aria-label={`Select ${x.who ?? "this record"}`}>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Content>
        </Checkbox>
      ) : null}
      <span className="flex min-w-[150px] flex-1 flex-col gap-1">
        <Person name={x.who ?? ""} sub={rec ? `In ${dayOf(rec.clockInAt)}, ${hm(rec.clockInAt)}` : x.detail} />
      </span>
      {done ? (
        <Chip size="sm" variant="soft" color="success">
          <CircleCheck className="size-3" />
          <Chip.Label>{open ? "Clocked out" : "Checked"}</Chip.Label>
        </Chip>
      ) : rec && open ? (
        <>
          <TextField value={time} onChange={setTime} className="w-[132px]" aria-label={`Clock-out time of ${x.who}`}>
            <Input type="time" className="tabular" />
          </TextField>
          <Button size="sm" isPending={pending} isDisabled={!/^\d{2}:\d{2}$/.test(time)} onPress={() => settle("out")}>
            Clock out
          </Button>
          {hold}
        </>
      ) : rec && x.code === "unvalidated_attendance" ? (
        <>
          <Button size="sm" isPending={pending} onPress={() => settle("validate")}>
            <CircleCheck className="size-4" />
            Mark checked
          </Button>
          {hold}
        </>
      ) : (
        hold
      )}
    </div>
  );
}

/**
 * Everything that stops the month, grouped by what fixes it. A missing RSSB number or ID is typed
 * and saved right here, and the month is computed again; a clock record opens Attendance; anything
 * else opens the file, or the person is paid next month.
 */
export function BlockerFixDrawer({
  isOpen,
  onOpenChange,
  blockers,
  runId,
  onHold,
  holding,
  canSetEmployerNumber,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  blockers: PayRunException[];
  runId: string | null;
  onHold: (x: PayRunException) => void;
  holding: boolean;
  /** The person may record the business's RSSB employer number (`payroll.run`). */
  canSetEmployerNumber: boolean;
}) {
  const { holdPayslip, recomputePayRun, settleClockRecord } = useHrActions();
  const screenHref = useBoardHref();
  const grouped = GROUPS.map((g) => ({ ...g, items: blockers.filter((x) => g.codes.includes(x.code ?? "")) }));
  const known = new Set(GROUPS.flatMap((g) => g.codes));
  const others = blockers.filter((x) => !known.has(x.code ?? ""));

  // The clock records ticked for one action at once.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const time = grouped.find((g) => g.id === "time")?.items ?? [];
  const chosen = time.filter((x) => picked.has(x.id));
  const pick = (id: string, on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  // The ticked open records clocked out at their likely shift end, the month computed once at the end.
  const [bulkPending, startBulk] = useTransition();
  const clockOutAll = (items: PayRunException[]) =>
    startBulk(async () => {
      // A shift whose likely end has not come yet is still running: left as it is, and the person told.
      const open = items.filter((x) => x.code === "open_attendance" && x.record);
      const ended = open.filter((x) => Date.parse((x.record as Rec).clockInAt) + 8 * 3_600_000 <= Date.now());
      const running = open.length - ended.length;
      if (running) {
        toast.warning(
          ended.length ? `${running} still on shift, left as they are.` : "Still on shift. Nobody was clocked out.",
        );
      }
      let done = 0;
      for (const x of ended) {
        const rec = x.record as Rec;
        const r = await settleClockRecord(
          { kind: "out", recordId: rec.id, clockInAt: rec.clockInAt, time: shiftEnd(rec.clockInAt) },
          null,
        );
        if (r.ok) done++;
        else toast.danger(`${x.who}: ${r.error}`);
      }
      // Computed once, after the last record, whichever of them went through.
      if (done && runId) {
        const r = await recomputePayRun(runId);
        if (!r.ok) toast.danger(r.error);
      }
      if (done) toast.success(`${done} clocked out at shift end`);
      setPicked(new Set());
    });
  // The ticked people paid next month instead, one after another. A person can have two records ticked.
  const holdAll = (items: PayRunException[]) =>
    startBulk(async () => {
      if (!runId) return;
      const people = new Map(items.filter((i) => i.canHold && i.employeeId).map((i) => [i.employeeId as string, i]));
      let done = 0;
      for (const [employeeId, x] of people) {
        const r = await holdPayslip(runId, employeeId, `Paid next month: ${x.detail}`.slice(0, 500));
        if (r.ok) done++;
        else toast.danger(`${x.who}: ${r.error}`);
      }
      if (done) toast.success(`${done} paid next month`);
      setPicked(new Set());
    });

  const holdButton = (x: PayRunException) =>
    x.canHold ? (
      <Button size="sm" variant="ghost" isPending={holding} onPress={() => onHold(x)}>
        Pay next month
      </Button>
    ) : null;
  const holdIcon = (x: PayRunException) =>
    x.canHold ? (
      <Tip tip="Pay next month">
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={`Pay ${x.who ?? "them"} next month`}
          isPending={holding}
          onPress={() => onHold(x)}
        >
          <Calendar className="size-4" />
        </Button>
      </Tip>
    ) : null;

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog aria-labelledby="fix-h" className="w-full max-w-[560px]">
          <Drawer.CloseTrigger aria-label="Close" />
          <Drawer.Header className="flex flex-col gap-1">
            <Drawer.Heading id="fix-h" className="flex items-center gap-2 text-[18px] leading-6 font-semibold">
              Fix before submitting
              <Chip size="sm" variant="soft" color={blockers.length ? "warning" : "success"}>
                {blockers.length ? `${blockers.length} left` : "All clear"}
              </Chip>
            </Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body className="flex flex-col gap-5 pb-20 [&>*]:shrink-0">
            {blockers.length === 0 ? (
              <Alert status="success">
                <Alert.Indicator>
                  <CircleCheck aria-hidden="true" />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Nothing stops this month.</Alert.Title>
                </Alert.Content>
              </Alert>
            ) : null}
            {grouped
              .filter((g) => g.items.length)
              .map((g) => (
                <section key={g.id} className="flex flex-col gap-2" aria-label={g.title}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-warning-soft text-warning-soft-foreground">
                      {g.icon}
                    </span>
                    {g.title}
                    <Chip size="sm" variant="soft">
                      {g.items.length}
                    </Chip>
                    {g.id === "time" ? (
                      <span className="ml-auto flex items-center gap-1">
                        <Checkbox
                          isSelected={picked.size > 0 && picked.size === g.items.length}
                          isIndeterminate={picked.size > 0 && picked.size < g.items.length}
                          onChange={(on) => setPicked(on ? new Set(g.items.map((x) => x.id)) : new Set())}
                          className="mr-1"
                        >
                          <Checkbox.Content className="flex items-center gap-1.5 text-xs font-medium">
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                            All
                          </Checkbox.Content>
                        </Checkbox>
                        <LinkButton href={screenHref("Attendance")} size="sm" variant="ghost">
                          Attendance
                        </LinkButton>
                      </span>
                    ) : null}
                  </h3>
                  {g.items.map((x) =>
                    g.id === "employer" ? (
                      <div key={x.id} className="flex flex-col gap-2 rounded-xl bg-surface-secondary p-3">
                        <span className="text-xs text-muted">
                          On payslips and declarations. No month can be confirmed without it.
                        </span>
                        {canSetEmployerNumber ? (
                          <EmployerNumberForm />
                        ) : (
                          <span className="text-[13px] font-medium">Only the owner can add it.</span>
                        )}
                      </div>
                    ) : g.id === "rssb" ? (
                      <RssbFix key={x.id} x={x} runId={runId} />
                    ) : g.id === "id" ? (
                      <IdFix key={x.id} x={x} runId={runId} />
                    ) : (
                      <ClockFix
                        key={x.id}
                        x={x}
                        runId={runId}
                        hold={holdIcon(x)}
                        isSelected={picked.has(x.id)}
                        onSelect={(on) => pick(x.id, on)}
                      />
                    ),
                  )}
                </section>
              ))}
            {others.length ? (
              <section className="flex flex-col gap-2" aria-label="Other">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-warning-soft text-warning-soft-foreground">
                    <Lock className="size-4" />
                  </span>
                  Other
                  <Chip size="sm" variant="soft">
                    {others.length}
                  </Chip>
                </h3>
                {others.map((x) => (
                  <div key={x.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-secondary p-3">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[13px] font-semibold">{x.who || "The whole run"}</span>
                      <span className="text-xs text-muted">{x.detail}</span>
                    </span>
                    {x.employeeId ? (
                      <LinkButton
                        href={`${screenHref("Employees")}?employee=${encodeURIComponent(x.employeeId)}`}
                        size="sm"
                        variant="secondary"
                      >
                        Open file
                      </LinkButton>
                    ) : null}
                    {holdButton(x)}
                  </div>
                ))}
              </section>
            ) : null}
          </Drawer.Body>
          {/* A transform makes this box the action bar's frame, so it floats over the drawer, not the page. */}
          <div className="pointer-events-none absolute inset-0 bottom-16 [transform:translateZ(0)]">
            <ActionBar aria-label="Act on the ticked records" isOpen={chosen.length > 0}>
              <ActionBar.Prefix>
                <Chip size="sm" variant="soft" color="accent">
                  {chosen.length} ticked
                </Chip>
              </ActionBar.Prefix>
              <Separator orientation="vertical" />
              <ActionBar.Content>
                {chosen.some((x) => x.code === "open_attendance" && x.record) ? (
                  <Button size="sm" isPending={bulkPending} onPress={() => clockOutAll(chosen)}>
                    <Clock className="size-4" />
                    Clock out at shift end
                  </Button>
                ) : null}
                {runId && chosen.some((x) => x.canHold) ? (
                  <Button size="sm" variant="ghost" isPending={bulkPending} onPress={() => holdAll(chosen)}>
                    <Calendar className="size-4" />
                    Pay next month
                  </Button>
                ) : null}
              </ActionBar.Content>
              <Separator orientation="vertical" />
              <ActionBar.Suffix>
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  aria-label="Clear the ticks"
                  onPress={() => setPicked(new Set())}
                >
                  <Xmark className="size-4" />
                </Button>
              </ActionBar.Suffix>
            </ActionBar>
          </div>
          <Drawer.Footer className="border-t border-separator">
            <Label className="me-auto text-xs font-normal text-muted">Each save computes the month again.</Label>
            <Button variant="ghost" onPress={() => onOpenChange(false)}>
              Done
            </Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
