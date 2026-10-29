"use client";

import { Calendar as CalendarIcon, Clock, PersonsLock, ShieldExclamation } from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Calendar,
  Card,
  Chip,
  Description,
  Label,
  Popover,
  Separator,
  Table,
  TextArea,
  TextField,
} from "@heroui/react";
import { Timeline } from "@heroui-pro/react";
import type { Persona, RatesInventoryPendingChange, RatesInventoryRatePlan, Tone } from "@injishi/product-pms";
import { usePmsActions } from "@injishi/product-pms/web";
import { GateChip, KeyValueList, toneColor } from "@injishi/ui";
import { parseDate } from "@internationalized/date";
import { useOptimistic, useState, useTransition } from "react";
import { ratesInventoryDate } from "./RatesInventoryTabs";

interface Draft {
  note: string;
  from: string;
  to: string | null;
}

/** Row status: a scheduled change shows until it takes effect (or the owner approves it). */
function planStatus(plan: RatesInventoryRatePlan): { label: string; tone: Tone } {
  if (plan.pendingChange) {
    return { label: plan.needsOwnerApproval ? "Change awaiting owner" : "Change scheduled", tone: "warning" };
  }
  return { label: plan.status, tone: plan.statusTone };
}

/** "10:52" in hotel time (Kigali). */
function hotelTime(): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Africa/Kigali",
  }).format(new Date());
}

/** Date trigger (artifact: select trigger with a calendar indicator) opening a HeroUI Calendar. */
function RatesInventoryDateField({
  id,
  label,
  value,
  minValue,
  allowOpenEnded,
  isDisabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  minValue?: string;
  allowOpenEnded?: boolean;
  isDisabled?: boolean;
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const pick = (next: string | null) => {
    onChange(next);
    setOpen(false);
  };
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label id={`${id}-label`}>{label}</Label>
      <Popover isOpen={open} onOpenChange={setOpen}>
        <Button
          variant="tertiary"
          fullWidth
          isDisabled={isDisabled}
          aria-labelledby={`${id}-label ${id}-value`}
          className="justify-between px-3.5 font-normal"
        >
          <span id={`${id}-value`} className="tabular">
            {value ? ratesInventoryDate(value) : "Open"}
          </span>
          <CalendarIcon className="size-4 text-muted" aria-hidden="true" />
        </Button>
        <Popover.Content placement="bottom start" className="p-3">
          <Popover.Dialog aria-label={label} className="flex flex-col gap-2">
            <Calendar
              aria-label={label}
              value={value ? parseDate(value) : null}
              defaultFocusedValue={parseDate(value ?? minValue ?? "2026-10-12")}
              minValue={minValue ? parseDate(minValue) : undefined}
              onChange={(date) => pick(date.toString())}
            >
              <Calendar.Header>
                <Calendar.Heading />
                <Calendar.NavButton slot="previous" />
                <Calendar.NavButton slot="next" />
              </Calendar.Header>
              <Calendar.Grid>
                <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
                <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
              </Calendar.Grid>
            </Calendar>
            {allowOpenEnded ? (
              <Button size="sm" variant="ghost" className="self-start" onPress={() => pick(null)}>
                No end date (open)
              </Button>
            ) : null}
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  );
}

/** Rate plans tab: the plan table and the effective-dated editor of the selected plan. */
export function RatesInventoryRatePlans({
  persona,
  plans,
  owner,
}: {
  persona: Persona;
  plans: RatesInventoryRatePlan[];
  /** Who approves negotiated rate changes, by name. */
  owner: string;
}) {
  const { discardRatesInventoryChange, scheduleRatesInventoryChange } = usePmsActions();
  const [selectedId, setSelectedId] = useState(plans.find((p) => p.id === "corp")?.id ?? plans[0]?.id ?? "");
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(plans.map((p) => [p.id, { note: p.draftNote, from: p.draftFrom, to: p.draftTo }])),
  );
  const [isPending, startTransition] = useTransition();
  const [shown, setOptimistic] = useOptimistic(
    plans,
    (state, change: { id: string; pendingChange: RatesInventoryPendingChange | null }) =>
      state.map((p) => (p.id === change.id ? { ...p, pendingChange: change.pendingChange } : p)),
  );

  const plan = shown.find((p) => p.id === selectedId) ?? shown[0];
  if (!plan) return null;
  const draft = drafts[plan.id] ?? { note: plan.draftNote, from: plan.draftFrom, to: plan.draftTo };
  const setDraft = (patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [plan.id]: { ...draft, ...patch } }));
  const status = planStatus(plan);
  const saved = plan.pendingChange;
  const hasNote = draft.note.trim().length > 0;
  const canSave = hasNote && !saved && !isPending;
  const saveLabel = plan.needsOwnerApproval ? "Send for approval" : "Schedule change";

  const save = () => {
    const id = plan.id;
    const next = { ...draft };
    startTransition(async () => {
      setOptimistic({
        id,
        pendingChange: { note: next.note.trim(), from: next.from, to: next.to, by: persona.name, at: hotelTime() },
      });
      await scheduleRatesInventoryChange(id, next);
    });
  };

  const discard = () => {
    const id = plan.id;
    setDraft({ note: "" });
    startTransition(async () => {
      setOptimistic({ id, pendingChange: null });
      await discardRatesInventoryChange(id);
    });
  };

  return (
    <div className="flex flex-wrap items-start gap-[16px]">
      <div className="flex min-w-0 flex-[1_1_560px] flex-col gap-3">
        <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Rate plans"
              selectionMode="single"
              selectionBehavior="replace"
              disallowEmptySelection
              selectedKeys={new Set([plan.id])}
              onSelectionChange={(keys) => {
                if (keys === "all") return;
                const [key] = [...keys];
                if (key !== undefined) setSelectedId(String(key));
              }}
            >
              <Table.Header>
                <Table.Column isRowHeader>Rate plan</Table.Column>
                <Table.Column>Price basis</Table.Column>
                <Table.Column>Effective</Table.Column>
                <Table.Column>Stay</Table.Column>
                <Table.Column>Meal plan</Table.Column>
                <Table.Column>Status</Table.Column>
              </Table.Header>
              <Table.Body>
                {shown.map((p) => {
                  const st = planStatus(p);
                  return (
                    <Table.Row key={p.id} id={p.id} className="cursor-pointer">
                      <Table.Cell>
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-[12px] leading-4 text-muted tabular">
                            {p.code} · {p.version}
                          </span>
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-sm">{p.basis}</Table.Cell>
                      <Table.Cell className="text-sm tabular">{p.effective}</Table.Cell>
                      <Table.Cell className="text-sm tabular">{p.stay}</Table.Cell>
                      <Table.Cell className="text-sm">{p.mealPlan}</Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={toneColor(st.tone)}>
                          {st.label}
                        </Chip>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        <p className="text-[12px] leading-4 text-muted">
          Prices in RWF per room per night. Derived plans follow BAR automatically. Group contract rates live on each
          group block.
        </p>
      </div>

      <Card role="complementary" aria-labelledby="ed-h" className="min-w-0 flex-[1_1_400px] gap-0 p-0">
        <Card.Header className="flex flex-row items-start gap-3 border-b border-separator px-5 pt-5 pb-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[12px] leading-4 text-muted">Edit rate plan</span>
            <h2 id="ed-h" className="text-[17px] leading-6 font-semibold">
              {plan.name}
            </h2>
          </div>
          <Chip size="sm" variant="soft" color={toneColor(status.tone)}>
            {status.label}
          </Chip>
        </Card.Header>

        <Card.Content className="flex flex-col gap-4 px-5 pt-4 pb-5">
          <KeyValueList
            items={[
              { label: "Currency", value: "RWF" },
              { label: "Effective", value: <span className="tabular">{plan.effective}</span> },
              { label: "Stay rules", value: <span className="tabular">{plan.stay}</span> },
              { label: "Closed days", value: plan.closedDays },
              { label: "Meal plan", value: plan.mealPlan },
              { label: "Cancellation", value: plan.cancellation },
              {
                label: "Tax classification",
                value: (
                  <span className="flex flex-col items-start gap-1">
                    <span className="tabular">{plan.taxClassification}</span>
                    <GateChip icon={<ShieldExclamation className="size-3" aria-hidden="true" />}>
                      Tax rule v2 · awaiting sign-off
                    </GateChip>
                  </span>
                ),
              },
              {
                label: "Channels",
                value: (
                  <span className="flex flex-wrap gap-1">
                    {plan.channels.map((c) => (
                      <Chip key={c} size="sm" variant="soft">
                        {c}
                      </Chip>
                    ))}
                  </span>
                ),
              },
            ]}
          />

          <Separator />

          <section className="flex flex-col gap-[10px]" aria-labelledby="sched-h">
            <div className="flex items-center justify-between gap-2">
              <h3 id="sched-h" className="text-[15px] leading-[22px] font-semibold">
                Scheduled change
              </h3>
              <Chip size="sm" variant="soft" color="accent">
                Draft {plan.draftVersion}
              </Chip>
            </div>
            <div className="grid grid-cols-2 gap-[10px]">
              <RatesInventoryDateField
                key={`${plan.id}-from`}
                id="eff-from"
                label="Effective from"
                value={draft.from}
                isDisabled={!!saved}
                onChange={(from) => from && setDraft({ from, to: draft.to && draft.to < from ? from : draft.to })}
              />
              <RatesInventoryDateField
                key={`${plan.id}-to`}
                id="eff-to"
                label="Effective to"
                value={draft.to}
                minValue={draft.from}
                allowOpenEnded
                isDisabled={!!saved}
                onChange={(to) => setDraft({ to })}
              />
            </div>
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label={`${plan.name}: now and from ${ratesInventoryDate(draft.from)}`}>
                  <Table.Header>
                    <Table.Column isRowHeader>{plan.lineHead}</Table.Column>
                    <Table.Column className="text-right">Now</Table.Column>
                    <Table.Column className="text-right">From {ratesInventoryDate(draft.from)}</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {plan.lines.map((l) => (
                      <Table.Row key={l.label} id={l.label}>
                        <Table.Cell className="text-sm">{l.label}</Table.Cell>
                        <Table.Cell className="text-right text-sm tabular">{l.current}</Table.Cell>
                        <Table.Cell className="text-right text-sm font-semibold tabular">{l.next}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            <TextField
              value={draft.note}
              onChange={(note) => setDraft({ note })}
              isReadOnly={!!saved}
              className="flex flex-col gap-1"
            >
              <Label>Audit note (required)</Label>
              <TextArea
                rows={3}
                fullWidth
                placeholder="Why is this changing? Include the contract or decision reference."
              />
              <Description>
                Saved with your name and time. Confirmed bookings keep the rate in their terms snapshot.
              </Description>
            </TextField>
            {plan.needsOwnerApproval ? (
              <Alert>
                <Alert.Indicator>
                  <PersonsLock />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Contract rates need owner approval</Alert.Title>
                  <Alert.Description>
                    {owner} approves negotiated rate changes before they take effect.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            {saved ? (
              <Alert status="accent" role="status">
                <Alert.Indicator>
                  <Clock />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>
                    {plan.needsOwnerApproval
                      ? `${plan.draftVersion} sent to ${owner} for approval`
                      : `${plan.draftVersion} scheduled from ${ratesInventoryDate(saved.from)}`}
                  </Alert.Title>
                  <Alert.Description>
                    {plan.needsOwnerApproval
                      ? `Requested by ${saved.by} at ${saved.at}. Current rates stay in force until he approves.`
                      : `Recorded by ${saved.by} at ${saved.at} with your audit note. Channels update on the effective date.`}
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
          </section>

          <Separator />

          <section className="flex flex-col gap-2" aria-labelledby="hist-h">
            <h3 id="hist-h" className="text-[15px] leading-[22px] font-semibold">
              Version history
            </h3>
            <Timeline size="sm" density="compact">
              {plan.history.map((h) => (
                <Timeline.Item key={h.title} status={h.status}>
                  <Timeline.Rail>
                    <Timeline.Marker />
                    <Timeline.Connector />
                  </Timeline.Rail>
                  <Timeline.Content className="flex flex-col pb-0.5">
                    <span className="text-sm font-medium">{h.title}</span>
                    <span className="text-[12px] leading-4 text-muted">{h.detail}</span>
                  </Timeline.Content>
                </Timeline.Item>
              ))}
            </Timeline>
          </section>
        </Card.Content>

        <Card.Footer className="flex flex-wrap items-center justify-end gap-2 border-t border-separator px-5 pt-3 pb-5">
          {!hasNote ? (
            <span className="mr-auto text-[12px] leading-4 text-muted">Add an audit note to continue</span>
          ) : null}
          <Button variant="ghost" onPress={discard} isDisabled={isPending}>
            Discard
          </Button>
          <Button onPress={save} isDisabled={!canSave}>
            {saveLabel}
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}
