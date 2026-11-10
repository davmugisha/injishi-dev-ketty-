"use client";

import { CircleCheckFill, CircleStop, PersonPlus, PersonXmark, Xmark } from "@gravity-ui/icons";
import { Button, Checkbox, Chip, Description, Drawer, Input, Label, Separator, TextField, toast } from "@heroui/react";
import { ActionBar, NativeSelect, RadioButtonGroup } from "@heroui-pro/react";
import { useState, useTransition } from "react";
import type { RosterStaff, Rotation, RotationMember, RotationPerson } from "../../model/people.ts";
import { useHrActions } from "../mount.tsx";
import { firstName, Person, Tip } from "./parts";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "16 Oct" for "2026-10-16". */
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
const laterDay = (a: string, b: string) => (a > b ? a : b);

/** How the steps move: "One step a day", "Moves each Monday", "Moves on day 1 of the month". */
function ruleText(m: RotationMember): string {
  if (m.rule === "weekly") return `Moves each ${WEEKDAYS[m.ruleValue] ?? "week"}`;
  if (m.rule === "monthly") return `Moves on day ${m.ruleValue} of the month`;
  return m.ruleValue === 1 ? "One step a day" : `One step every ${m.ruleValue} days`;
}

/** The roster's own shift colours: morning accent, evening chart 4, night dark, off dashed. */
function stepTone(name: string): string {
  if (/^off$/i.test(name)) return "border border-dashed border-muted/50 text-muted";
  if (/night/i.test(name)) return "bg-foreground text-background";
  if (/even|turndown/i.test(name)) return "bg-[var(--chart-4)] text-[var(--eclipse)]";
  return "bg-accent text-accent-foreground";
}

/** A cycle's steps as coloured tiles: a letter for the shift, a dash for a day off. */
function Steps({ m, small = false }: { m: RotationMember; small?: boolean }) {
  return (
    <span className={`flex flex-wrap ${small ? "gap-[3px]" : "gap-1.5"}`}>
      {m.steps.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a step is its position in the cycle.
        <Tip key={`${m.id}-${i}`} tip={`Step ${i + 1} · ${s}`}>
          <span
            className={`flex items-center justify-center rounded-md font-bold ${
              small ? "h-5 w-5 text-[9px]" : "h-9 w-9 rounded-lg text-xs"
            } ${stepTone(s)}`}
          >
            {/^off$/i.test(s) ? "–" : s.charAt(0).toUpperCase()}
          </span>
        </Tip>
      ))}
    </span>
  );
}

/** The step a newcomer starts on so they keep in step with the first person already on the pattern. */
function inStep(m: RotationMember, ref: RotationPerson | undefined, startsOn: string): number {
  if (!ref || m.rule !== "every_n_days" || m.ruleValue < 1) return 0;
  const days = Math.round((Date.parse(startsOn) - Date.parse(ref.startsOn)) / 86_400_000);
  const n = m.steps.length;
  return (((ref.startStep + Math.floor(days / m.ruleValue)) % n) + n) % n;
}

/**
 * One rotation, opened from the roster: its steps, the people on it, who joins it, and stopping it.
 */
export function RotationDrawer({
  rotation,
  rotations,
  staff,
  today,
  onOpenChange,
}: {
  rotation: Rotation | null;
  rotations: Rotation[];
  staff: RosterStaff[];
  today: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { addToRotation, stopRotation, takeOffRotation } = useHrActions();
  const [pending, start] = useTransition();
  const [gone, setGone] = useState<Record<string, boolean>>({});
  const [who, setWho] = useState("");
  const [patternId, setPatternId] = useState("");
  const [from, setFrom] = useState(today);
  const [confirmStop, setConfirmStop] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // The step a newcomer starts on, where the pattern moves by the calendar and no step can be worked out.
  const [startAt, setStartAt] = useState(0);

  const members = rotation?.members ?? [];
  const people = (rotation?.people ?? []).filter((p) => !gone[p.assignmentId]);
  const member = members.find((m) => m.id === patternId) ?? members[0];

  // Everyone's running assignment, to move a person who is on another rotation.
  const current = new Map(
    rotations.flatMap((r) => (r.people ?? []).map((p) => [p.employeeId, { ...p, rotation: r.code }] as const)),
  );
  const onThis = new Set(people.map((p) => p.employeeId));
  const free = staff.filter((s) => !onThis.has(s.id) && !current.has(s.id));
  const elsewhere = staff.filter((s) => !onThis.has(s.id) && current.has(s.id));
  const ref = member ? people.find((p) => p.patternId === member.id) : undefined;
  const countsDays = member?.rule === "every_n_days";
  const step = member ? (countsDays ? inStep(member, ref, from) : Math.min(startAt, member.steps.length - 1)) : 0;

  const add = () =>
    start(async () => {
      if (!member || !who) return;
      const moving = current.get(who);
      const r = await addToRotation({
        employeeId: who,
        patternId: member.id,
        startsOn: from,
        startStep: step,
        moveFrom: moving ? { assignmentId: moving.assignmentId, startsOn: moving.startsOn } : undefined,
      });
      const name = staff.find((s) => s.id === who)?.name ?? "They";
      if (r.ok) {
        toast.success(`${name} is on ${member.code} from ${shortDate(from)}`);
        setWho("");
      } else toast.danger(r.error);
    });

  const takeOff = (p: RotationPerson) =>
    start(async () => {
      const r = await takeOffRotation(p.assignmentId, laterDay(p.startsOn, today));
      if (r.ok) {
        setGone((g) => ({ ...g, [p.assignmentId]: true }));
        toast.success(`${p.name} is off ${rotation?.code} after ${shortDate(laterDay(p.startsOn, today))}`);
      } else toast.danger(r.error);
    });

  // Everyone ticked comes off after today, one after another.
  const takeOffPicked = () =>
    start(async () => {
      const list = people.filter((p) => picked.has(p.assignmentId));
      let done = 0;
      for (const p of list) {
        const r = await takeOffRotation(p.assignmentId, laterDay(p.startsOn, today));
        if (r.ok) {
          done++;
          setGone((g) => ({ ...g, [p.assignmentId]: true }));
        } else toast.danger(`${p.name}: ${r.error}`);
      }
      if (done) toast.success(`${done} off ${rotation?.code} after ${shortDate(today)}`);
      setPicked(new Set());
    });

  const stop = () =>
    start(async () => {
      if (!rotation) return;
      const r = await stopRotation(
        members.map((m) => m.id),
        people.map((p) => ({ assignmentId: p.assignmentId, startsOn: p.startsOn })),
        today,
      );
      if (r.ok) {
        toast.success(`Rotation ${rotation.code} stopped`);
        setConfirmStop(false);
        onOpenChange(false);
      } else toast.danger(r.error);
    });

  const close = (open: boolean) => {
    if (!open) {
      setConfirmStop(false);
      setWho("");
      setPicked(new Set());
    }
    onOpenChange(open);
  };

  return (
    <Drawer.Backdrop isOpen={rotation !== null} onOpenChange={close}>
      <Drawer.Content placement="right">
        <Drawer.Dialog aria-labelledby="rot-drawer-h" className="w-full max-w-[520px]">
          <Drawer.CloseTrigger aria-label="Close" />
          {rotation ? (
            <>
              <Drawer.Header className="flex flex-row items-start gap-3 pr-12">
                <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl bg-accent px-2 text-sm font-bold text-accent-foreground">
                  {rotation.code}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <Drawer.Heading id="rot-drawer-h" className="text-[17px] leading-[22px] font-semibold">
                    {rotation.name}
                  </Drawer.Heading>
                  <span className="flex items-center gap-1.5">
                    <Chip size="sm" variant="soft" color="success">
                      Active
                    </Chip>
                    <Chip size="sm" variant="soft">
                      {people.length} on it
                    </Chip>
                  </span>
                </span>
              </Drawer.Header>

              <Drawer.Body className="flex flex-col gap-5 pb-20 [&>*]:shrink-0">
                <section className="flex flex-col gap-2.5" aria-label="Steps">
                  {members.map((m) => (
                    <div key={m.id} className="flex flex-col gap-2 rounded-xl bg-surface-secondary p-3">
                      <span className="flex items-center justify-between gap-2 text-xs text-muted">
                        <span className="font-semibold text-foreground">
                          {members.length > 1 ? `${m.code} · ${m.description}` : `${m.steps.length}-step cycle`}
                        </span>
                        {ruleText(m)}
                      </span>
                      <Steps m={m} />
                    </div>
                  ))}
                </section>

                <section className="flex flex-col gap-2" aria-label="On this rotation">
                  <h3 className="flex items-center justify-between gap-2 text-sm font-semibold">
                    On this rotation
                    {people.length > 1 ? (
                      <Checkbox
                        isSelected={picked.size === people.length}
                        isIndeterminate={picked.size > 0 && picked.size < people.length}
                        onChange={(on) => setPicked(on ? new Set(people.map((p) => p.assignmentId)) : new Set())}
                      >
                        <Checkbox.Content className="flex items-center gap-1.5 text-xs font-medium">
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          All
                        </Checkbox.Content>
                      </Checkbox>
                    ) : null}
                  </h3>
                  {people.length === 0 ? (
                    <p className="rounded-xl bg-surface-secondary p-3 text-sm text-muted">Nobody yet.</p>
                  ) : (
                    people.map((p) => (
                      <div
                        key={p.assignmentId}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${
                          picked.has(p.assignmentId) ? "bg-accent-soft" : "bg-surface-secondary"
                        }`}
                      >
                        <Checkbox
                          isSelected={picked.has(p.assignmentId)}
                          onChange={(on) =>
                            setPicked((cur) => {
                              const next = new Set(cur);
                              if (on) next.add(p.assignmentId);
                              else next.delete(p.assignmentId);
                              return next;
                            })
                          }
                          aria-label={`Select ${p.name}`}
                        >
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Content>
                        </Checkbox>
                        <span className="min-w-0 flex-1">
                          <Person
                            name={p.name}
                            sub={[p.title, `since ${shortDate(p.startsOn)}`].filter(Boolean).join(" · ")}
                          />
                        </span>
                        {members.length > 1 ? (
                          <Chip size="sm" variant="soft">
                            {p.code}
                          </Chip>
                        ) : null}
                        <Tip tip="Take off after today">
                          <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            isPending={pending}
                            onPress={() => takeOff(p)}
                            aria-label={`Take ${p.name} off ${rotation.code}`}
                          >
                            <PersonXmark className="size-4" />
                          </Button>
                        </Tip>
                      </div>
                    ))
                  )}
                </section>

                <section className="flex flex-col gap-3 rounded-xl border border-separator p-3" aria-label="Add">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <PersonPlus className="size-4 text-accent" />
                    Add someone
                  </h3>
                  <NativeSelect fullWidth className="flex flex-col gap-1">
                    <Label htmlFor="rot-who">Person</Label>
                    <NativeSelect.Trigger id="rot-who" value={who} onChange={(e) => setWho(e.target.value)}>
                      <NativeSelect.Option value="">Choose a person</NativeSelect.Option>
                      {[
                        { label: "Not on a rotation", list: free },
                        { label: "On another rotation (moves them)", list: elsewhere },
                      ]
                        .filter((g) => g.list.length)
                        .map((g) => (
                          <optgroup key={g.label} label={g.label}>
                            {g.list.map((s) => (
                              <NativeSelect.Option key={s.id} value={s.id}>
                                {current.has(s.id) ? `${s.name} · on ${current.get(s.id)?.rotation}` : s.name}
                              </NativeSelect.Option>
                            ))}
                          </optgroup>
                        ))}
                      <NativeSelect.Indicator />
                    </NativeSelect.Trigger>
                  </NativeSelect>
                  {members.length > 1 ? (
                    <RadioButtonGroup
                      aria-label="Pattern"
                      value={member?.id ?? ""}
                      onChange={(v) => v && setPatternId(v)}
                      layout="grid"
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      {members.map((m) => (
                        <RadioButtonGroup.Item key={m.id} value={m.id} className="px-3 py-2.5">
                          <RadioButtonGroup.Indicator>
                            <CircleCheckFill />
                          </RadioButtonGroup.Indicator>
                          <RadioButtonGroup.ItemContent className="flex flex-col gap-1.5 pr-6">
                            <Label className="text-[13px] font-semibold">
                              {m.code} · {m.description}
                            </Label>
                            <Steps m={m} small />
                            <Description className="text-[11px]">
                              {people.filter((p) => p.patternId === m.id).length} on it
                            </Description>
                          </RadioButtonGroup.ItemContent>
                        </RadioButtonGroup.Item>
                      ))}
                    </RadioButtonGroup>
                  ) : null}
                  <div className="grid gap-3">
                    <TextField value={from} onChange={setFrom} className="flex min-w-0 flex-col gap-1">
                      <Label>Starts on</Label>
                      <Input type="date" min={today} fullWidth />
                    </TextField>
                    {member && !countsDays ? (
                      <NativeSelect fullWidth className="flex flex-col gap-1">
                        <Label htmlFor="rot-step">Starts on step</Label>
                        <NativeSelect.Trigger
                          id="rot-step"
                          value={String(step)}
                          onChange={(e) => setStartAt(Number(e.target.value))}
                        >
                          {member.steps.map((s, i) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: a step is its place in the cycle.
                            <NativeSelect.Option key={i} value={String(i)}>
                              {i + 1}. {s}
                            </NativeSelect.Option>
                          ))}
                          <NativeSelect.Indicator />
                        </NativeSelect.Trigger>
                      </NativeSelect>
                    ) : null}
                  </div>
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted">
                      {member
                        ? `Step ${step + 1}, ${member.steps[step] ?? ""}${ref && countsDays ? `, in step with ${firstName(ref.name)}` : ""}`
                        : ""}
                    </span>
                    <Button size="sm" isPending={pending} isDisabled={!who || !from} onPress={add}>
                      <PersonPlus className="size-4" />
                      Add
                    </Button>
                  </span>
                </section>
              </Drawer.Body>

              {/* A transform makes this box the action bar's frame, so it floats over the drawer, not the page. */}
              <div className="pointer-events-none absolute inset-0 bottom-16 [transform:translateZ(0)]">
                <ActionBar aria-label="Act on the ticked people" isOpen={picked.size > 0}>
                  <ActionBar.Prefix>
                    <Chip size="sm" variant="soft" color="accent">
                      {picked.size} ticked
                    </Chip>
                  </ActionBar.Prefix>
                  <Separator orientation="vertical" />
                  <ActionBar.Content>
                    <Button size="sm" variant="danger-soft" isPending={pending} onPress={takeOffPicked}>
                      <PersonXmark className="size-4" />
                      Take off after today
                    </Button>
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
              <Drawer.Footer className="flex items-center justify-between gap-2 border-t border-separator">
                {confirmStop ? (
                  <>
                    <span className="min-w-0 flex-1 text-sm">
                      Stop {rotation.code}?{" "}
                      <span className="text-muted">
                        {people.length
                          ? `${people.length} come off after ${shortDate(today)}; their later drafts are cancelled.`
                          : "Nobody is on it."}
                      </span>
                    </span>
                    <Button size="sm" variant="ghost" onPress={() => setConfirmStop(false)}>
                      Keep
                    </Button>
                    <Button size="sm" variant="danger" isPending={pending} onPress={stop}>
                      Stop
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" className="text-danger" onPress={() => setConfirmStop(true)}>
                      <CircleStop className="size-4" />
                      Stop rotation
                    </Button>
                    <Button size="sm" variant="secondary" onPress={() => close(false)}>
                      Done
                    </Button>
                  </>
                )}
              </Drawer.Footer>
            </>
          ) : null}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
