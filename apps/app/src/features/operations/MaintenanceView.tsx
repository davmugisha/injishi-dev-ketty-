"use client";

import { BroomMotion, ChartLine, Comment, Database, Picture, Plus } from "@gravity-ui/icons";
import { Button, Card, Checkbox, Chip, Input, Label, Table, TextArea, TextField, Toast } from "@heroui/react";
import { ListView, Segment } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  BlockState,
  ConditionSignal,
  Severity,
  SignalReview,
  Tone,
  WorkOrder,
} from "@injishi/data/fixtures/operations";
import { stock } from "@injishi/data/media";
import { GateChip, LinkButton, PageContent, PageHeader, Photo, SectionHeader, StatusDot, toneColor } from "@injishi/ui";
import { useState, useTransition } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import {
  actOnSignalAction,
  addWorkOrderNoteAction,
  assignWorkOrderAction,
  createWorkOrderAction,
  decideRoomBlockAction,
  dismissSignalAction,
  releaseRoomAction,
} from "./actions";
import {
  FieldLabel,
  FooterHint,
  FormDialog,
  firstKey,
  HistoryTimeline,
  kigaliClock,
  reported,
  SelectField,
  useKigaliNow,
} from "./shared";

export interface MaintenanceData {
  workOrders: WorkOrder[];
  signals: ConditionSignal[];
  reviews: SignalReview[];
}

const SEVERITY_TONE: Record<Severity, Tone> = {
  Critical: "danger",
  High: "warning",
  Normal: "default",
  Low: "default",
};
const BLOCK: Record<BlockState, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "danger" },
  requested: { label: "Needs your approval", tone: "warning" },
  declined: { label: "Declined", tone: "default" },
  na: { label: "Not a room", tone: "default" },
  none: { label: "No block", tone: "default" },
};
const DISMISS_REASONS = ["Already fixed", "Sensor fault", "Not worth it now", "Duplicate"];
const SEVERITIES: Severity[] = ["Critical", "High", "Normal", "Low"];
/** Response time per severity (an unassigned order shows it until someone owns it). */
const DUE_WITHIN: Record<Severity, string> = {
  Critical: "due within 1 hour",
  High: "due within 4 hours",
  Normal: "due within 3 days",
  Low: "at the next routine visit",
};

type SignalState = "open" | "dismissing" | "created" | "dismissed";

export function MaintenanceView({ persona, data }: { persona: Persona; data: MaintenanceData }) {
  const [selectedId, setSelectedId] = useState(data.workOrders[0]?.id ?? "");
  const [signalState, setSignalState] = useState<Record<string, SignalState>>({});
  const [signalReason, setSignalReason] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [pending, startTransition] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  const [newAsset, setNewAsset] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDetails, setNewDetails] = useState("");
  const [newSeverity, setNewSeverity] = useState<Severity>("Normal");
  const [newOwner, setNewOwner] = useState("none");
  const [newBlock, setNewBlock] = useState(false);
  const now = useKigaliNow();
  const ownerOptions = [
    ...new Set(data.workOrders.flatMap((w) => [w.owner, w.suggestedOwner]).filter((o): o is string => Boolean(o))),
  ];

  // Work orders are the business's record (GET /ops/work-orders): approving a block, assigning, a
  // note, a new order and acting on a signal are commands to the API, and the board re-reads after.
  const workOrders = data.workOrders.map((w) => ({
    ...w,
    // A decision or an assignment still awaited shows as the timeline's last line.
    timeline: w.pending ? [...w.timeline, w.pending] : w.timeline,
  }));
  const wo = workOrders.find((w) => w.id === selectedId) ?? workOrders[0];

  const open = workOrders.filter((w) => !/^Done/.test(w.status));
  const urgent = open.filter((w) => w.severity === "Critical" || w.severity === "High").length;
  const outOfService = workOrders.filter((w) => w.block === "active").length;
  const summary = `${open.length} open work orders, ${urgent} urgent. ${outOfService} ${outOfService === 1 ? "room" : "rooms"} out of service.`;

  const act = (run: () => Promise<{ ok: true } | { ok: false; error: string }>, then?: () => void) =>
    startTransition(async () => {
      if (reported(await run())) then?.();
    });

  const select = (id: string) => {
    setSelectedId(id);
    setNoteOpen(false);
    setNoteText("");
  };
  const saveNote = () => {
    const text = noteText.trim();
    if (!wo || !text) return;
    act(
      () => addWorkOrderNoteAction(wo.id, text),
      () => {
        setNoteText("");
        setNoteOpen(false);
      },
    );
  };
  const openNew = () => {
    setNewAsset("");
    setNewTitle("");
    setNewDetails("");
    setNewSeverity("Normal");
    setNewOwner("none");
    setNewBlock(false);
    setNewOpen(true);
  };
  const isRoom = /^room\s/i.test(newAsset.trim());
  const canCreate = newAsset.trim().length > 0 && newTitle.trim().length > 0 && !pending;
  const createWorkOrder = () => {
    if (!canCreate) return;
    startTransition(async () => {
      const result = await createWorkOrderAction({
        asset: newAsset.trim(),
        title: newTitle.trim(),
        details: newDetails.trim() || undefined,
        severity: newSeverity,
        owner: newOwner === "none" ? null : newOwner,
        requestBlock: isRoom && newBlock,
      });
      if (!reported(result)) return;
      setNewOpen(false);
      if (result.ok) select(result.value);
    });
  };
  const releaseNote = wo
    ? wo.releaseNote || (wo.block === "active" ? "" : "Release applies only to blocked rooms.")
    : "";
  return (
    <PageContent>
      <TopbarStatus
        kind="chip"
        tone="default"
        dot={outOfService ? "danger" : "success"}
        label={
          outOfService
            ? `${outOfService} ${outOfService === 1 ? "room" : "rooms"} out of service`
            : "No rooms out of service"
        }
      />
      <PageHeader
        eyebrow="Isangano Lakeside Hotel · Property"
        title="Maintenance"
        description={`${summary} Condition signals recommend; people decide.`}
        actions={
          <>
            <LinkButton href={screenHref("HousekeepingBoard")} variant="secondary">
              <BroomMotion className="size-4" />
              Room status
            </LinkButton>
            <Button onPress={openNew}>
              <Plus className="size-4" />
              New work order
            </Button>
          </>
        }
      />

      <section className="flex flex-col gap-2.5" aria-labelledby="wo-h">
        <SectionHeader
          id="wo-h"
          title="Work Orders"
          action={
            <span className="text-[12px] text-muted">
              Open first, by severity · median time to close in the last 30 days: 26 h
            </span>
          }
        />
        <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Work orders"
              selectionMode="single"
              selectionBehavior="replace"
              disallowEmptySelection
              selectedKeys={new Set([wo?.id ?? ""])}
              onSelectionChange={(keys) => {
                const k = firstKey(keys);
                if (k) select(k);
              }}
            >
              <Table.Header>
                <Table.Column isRowHeader>Work order</Table.Column>
                <Table.Column>Room or asset</Table.Column>
                <Table.Column>Issue</Table.Column>
                <Table.Column>Severity</Table.Column>
                <Table.Column>Owner</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column>Out-of-service block</Table.Column>
              </Table.Header>
              <Table.Body>
                {workOrders.map((w) => (
                  <Table.Row key={w.id} id={w.id} className="cursor-pointer">
                    <Table.Cell className="font-semibold whitespace-nowrap underline decoration-separator underline-offset-[3px] tabular">
                      {w.id}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col">
                        <span className="font-medium">{w.asset}</span>
                        {w.area ? <span className="text-[12px] text-muted">{w.area}</span> : null}
                      </span>
                    </Table.Cell>
                    <Table.Cell className="min-w-[min(240px,100%)] text-[13px] leading-[18px] whitespace-normal">
                      {w.issue}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={toneColor(SEVERITY_TONE[w.severity])}>
                        {w.severity}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="text-[13px]">
                      {w.owner ? w.owner : <GateChip>Unassigned</GateChip>}
                    </Table.Cell>
                    <Table.Cell className="text-[13px]">{w.status}</Table.Cell>
                    <Table.Cell className="text-[13px]">
                      <span className="flex items-center gap-1.5">
                        <StatusDot tone={BLOCK[w.block].tone} />
                        {w.blockText}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </section>

      <div className="grid grid-cols-1 items-start gap-[16px] xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,1fr)]">
        {wo ? (
          <Card aria-labelledby="det-h" className="gap-3.5 p-[18px]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="flex items-center gap-2 text-[13px] leading-[18px] font-medium text-muted">
                  <span className="tabular">{wo.id}</span>
                  <Chip size="sm" variant="soft" color={toneColor(SEVERITY_TONE[wo.severity])}>
                    {wo.severity}
                  </Chip>
                </p>
                <h2 id="det-h" className="text-[17px] leading-6 font-semibold">
                  {wo.asset} · {wo.title}
                </h2>
                <span className="text-[12px] text-muted">Reported by {wo.reported}</span>
              </div>
              <Chip variant="soft">{wo.status}</Chip>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {wo.photos.length ? (
                wo.photos.map((p) => (
                  <figure key={p.caption} className="m-0 flex min-w-0 flex-col gap-1">
                    <div className="relative h-[76px] overflow-hidden rounded-[14px] bg-surface-secondary">
                      <Photo
                        image={stock[p.image]}
                        alt={`Photo: ${p.caption}`}
                        fill
                        sizes="(min-width: 1280px) 220px, 33vw"
                      />
                    </div>
                    <figcaption className="truncate text-[12px] text-muted">{p.caption}</figcaption>
                  </figure>
                ))
              ) : (
                <div
                  role="img"
                  aria-label="Photo: No photo yet"
                  className="flex h-[76px] flex-col items-center justify-center gap-1 rounded-[14px] bg-surface-secondary text-[12px] text-muted"
                >
                  <Picture className="size-4" aria-hidden="true" />
                  <span>No photo yet</span>
                </div>
              )}
            </div>

            <Card variant="secondary" className="gap-1.5 px-3.5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <FieldLabel>Out-of-service block</FieldLabel>
                <Chip size="sm" variant="soft" color={toneColor(BLOCK[wo.block].tone)}>
                  {BLOCK[wo.block].label}
                </Chip>
              </div>
              <span className="text-[13px] font-medium tabular">{wo.blockText}</span>
              <span className="text-[12px] leading-4 text-muted">{wo.blockEffect}</span>
              {wo.block === "requested" && wo.decision ? (
                <div className="mt-1 flex gap-2">
                  <Button
                    size="sm"
                    isDisabled={pending}
                    onPress={() => act(() => decideRoomBlockAction(wo.id, "approve"))}
                  >
                    Approve block
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={pending}
                    onPress={() => act(() => decideRoomBlockAction(wo.id, "decline"))}
                  >
                    Decline
                  </Button>
                </div>
              ) : null}
            </Card>

            <div className="flex flex-col gap-1.5">
              <FieldLabel id="parts-l">Parts</FieldLabel>
              {wo.parts.length ? (
                <ListView
                  variant="secondary"
                  aria-labelledby="parts-l"
                  items={wo.parts.map((p) => ({ ...p, id: p.name }))}
                >
                  {(p) => (
                    <ListView.Item id={p.id} textValue={`${p.name} × ${p.qty}`}>
                      <ListView.ItemContent>
                        <div className="flex min-w-0 flex-col">
                          <ListView.Title className="text-[13px]">
                            {p.name} <span className="text-muted tabular">× {p.qty}</span>
                          </ListView.Title>
                          <ListView.Description>{p.source}</ListView.Description>
                        </div>
                      </ListView.ItemContent>
                      <ListView.ItemAction>
                        <Chip size="sm" variant="soft" color={toneColor(p.tone)}>
                          {p.state}
                        </Chip>
                      </ListView.ItemAction>
                    </ListView.Item>
                  )}
                </ListView>
              ) : (
                <span className="text-[13px] text-muted">No parts recorded yet.</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <FieldLabel>Timeline</FieldLabel>
              <HistoryTimeline events={wo.timeline} label={`${wo.id} timeline`} />
            </div>

            {noteOpen ? (
              <TextField fullWidth value={noteText} onChange={setNoteText} className="gap-1">
                <Label>Note for {wo.id}</Label>
                <TextArea rows={3} placeholder="What was done or found, for the next person on this job" />
              </TextField>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t border-separator pt-3">
              {!wo.owner && wo.suggestedOwner ? (
                <Button
                  isDisabled={pending}
                  onPress={() => act(() => assignWorkOrderAction(wo.id, wo.suggestedOwner as string))}
                >
                  Assign to {wo.suggestedOwner}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                isDisabled={wo.block !== "active" || pending}
                onPress={() => act(() => releaseRoomAction(wo.id))}
              >
                Release room
              </Button>
              {noteOpen ? (
                <>
                  <Button variant="secondary" isDisabled={!noteText.trim()} onPress={saveNote}>
                    Save note
                  </Button>
                  <Button variant="ghost" onPress={() => setNoteOpen(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="ghost" onPress={() => setNoteOpen(true)}>
                  <Comment className="size-4" />
                  Add note
                </Button>
              )}
              {releaseNote ? (
                <span className="min-w-0 flex-[1_1_200px] text-[12px] text-muted">{releaseNote}</span>
              ) : null}
            </div>
          </Card>
        ) : null}

        <Card aria-labelledby="sig-h" className="gap-3.5 p-[18px]">
          <Card.Header className="flex-row items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Card.Title id="sig-h" className="text-[15px] font-semibold">
                Predictive Indicators
              </Card.Title>
              <Card.Description>
                Explainable rules over room meters and ticket history. They never block a room or open a work order on
                their own.
              </Card.Description>
            </div>
            <Chip size="sm" variant="soft" className="shrink-0">
              Recommendations
            </Chip>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3.5">
            {data.signals.map((g) => {
              const st = signalState[g.id] ?? "open";
              return (
                <Card
                  key={g.id}
                  variant="secondary"
                  className="gap-2.5 p-3.5"
                  aria-label={`${g.asset}: ${g.headline}`}
                  role="article"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[12px] text-muted">{g.asset}</span>
                      <span className="font-semibold">{g.headline}</span>
                    </div>
                    <Chip size="sm" variant="soft" color={toneColor(g.tone)} className="shrink-0">
                      Confidence: {g.confidence}
                    </Chip>
                  </div>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] leading-[18px]">
                    {g.evidence.map((e) => (
                      <li key={e} className="flex items-start gap-2">
                        <ChartLine className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-start gap-2 text-[12px] leading-4">
                    <GateChip icon={<Database className="size-3" />} className="shrink-0">
                      Data quality
                    </GateChip>
                    <span className="text-muted">{g.dataQuality}</span>
                  </div>
                  <p className="text-[13px] leading-[18px]">
                    <span className="font-semibold">Suggested:</span> {g.recommendation}{" "}
                    <span className="text-muted">· {g.ruleText}</span>
                  </p>
                  {st === "open" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        isDisabled={!g.draft || pending}
                        onPress={() =>
                          startTransition(async () => {
                            const result = await actOnSignalAction(g.id);
                            if (!reported(result)) return;
                            setSignalState((s) => ({ ...s, [g.id]: "created" }));
                            if (result.ok && result.value) select(result.value);
                          })
                        }
                      >
                        Create work order
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => {
                          setSignalState((s) => ({ ...s, [g.id]: "dismissing" }));
                          setReason(null);
                        }}
                      >
                        Dismiss with reason
                      </Button>
                    </div>
                  ) : null}
                  {st === "dismissing" ? (
                    <div className="flex flex-col gap-2">
                      <FieldLabel id={`dr-${g.id}`}>Why dismiss? (required, kept in the audit log)</FieldLabel>
                      <Segment
                        size="sm"
                        aria-labelledby={`dr-${g.id}`}
                        selectedKey={reason}
                        onSelectionChange={(k) => setReason(String(k))}
                        className="flex-wrap"
                      >
                        {DISMISS_REASONS.map((r) => (
                          <Segment.Item key={r} id={r}>
                            {r}
                          </Segment.Item>
                        ))}
                      </Segment>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="danger-soft"
                          isDisabled={!reason || pending}
                          onPress={() => {
                            if (!reason) return;
                            act(
                              () => dismissSignalAction(g.id, reason),
                              () => {
                                setSignalReason((r) => ({ ...r, [g.id]: reason }));
                                setSignalState((s) => ({ ...s, [g.id]: "dismissed" }));
                              },
                            );
                          }}
                        >
                          Dismiss signal
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onPress={() => setSignalState((s) => ({ ...s, [g.id]: "open" }))}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {st === "created" || st === "dismissed" ? (
                    <div className="flex flex-wrap items-center gap-2 text-[12px]" role="status">
                      <Chip size="sm" variant="soft" color={st === "created" ? "accent" : "default"}>
                        {st === "created" ? `Work order ${g.draft?.id ?? ""} drafted` : "Dismissed"}
                      </Chip>
                      <span className="text-muted">
                        {persona.name} · {now ? kigaliClock(now) : ""} ·{" "}
                        {st === "created" ? "assign an owner in the table" : `reason: ${signalReason[g.id] ?? ""}`}
                      </span>
                    </div>
                  ) : null}
                </Card>
              );
            })}
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Reviewed this month</FieldLabel>
              {data.reviews.map((r) => (
                <div key={r.id} className="flex items-start gap-2 text-[12px] leading-4">
                  <Chip size="sm" variant="soft" color={toneColor(r.tone)} className="shrink-0">
                    {r.outcome}
                  </Chip>
                  <span>
                    <span className="font-medium">{r.what}</span> <span className="text-muted">· {r.note}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      </div>
      <FormDialog
        isOpen={newOpen}
        onOpenChange={setNewOpen}
        title="New work order"
        description="Record the fault and who owns it. Photos and parts are added by the technician from the staff app."
        footer={
          <>
            <FooterHint>
              {newOwner === "none"
                ? `Unassigned · ${newSeverity} severity is ${DUE_WITHIN[newSeverity]}`
                : `Assigned to ${newOwner} · no message is sent`}
            </FooterHint>
            <Button variant="secondary" onPress={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button isDisabled={!canCreate} onPress={createWorkOrder}>
              Create work order
            </Button>
          </>
        }
      >
        <TextField fullWidth value={newAsset} onChange={setNewAsset} isRequired className="gap-1">
          <Label>Room or asset</Label>
          <Input placeholder="e.g. Room 214, or Lake Bar fridge" />
        </TextField>
        <TextField fullWidth value={newTitle} onChange={setNewTitle} isRequired className="gap-1">
          <Label>Problem</Label>
          <Input placeholder="e.g. Shower mixer loose" />
        </TextField>
        <TextField fullWidth value={newDetails} onChange={setNewDetails} className="gap-1">
          <Label>Details</Label>
          <TextArea rows={3} placeholder="What was seen, where exactly, and since when" />
        </TextField>
        <div className="flex flex-col gap-1.5">
          <FieldLabel id="sev-l">Severity</FieldLabel>
          <Segment
            size="sm"
            aria-labelledby="sev-l"
            selectedKey={newSeverity}
            onSelectionChange={(k) => setNewSeverity(k as Severity)}
            className="self-start"
          >
            {SEVERITIES.map((sv) => (
              <Segment.Item key={sv} id={sv}>
                {sv}
              </Segment.Item>
            ))}
          </Segment>
        </div>
        <SelectField
          label="Owner"
          value={newOwner}
          options={[...ownerOptions, { id: "none", label: "Leave unassigned" }]}
          onChange={setNewOwner}
        />
        <Checkbox isSelected={isRoom && newBlock} isDisabled={!isRoom} onChange={setNewBlock}>
          <Checkbox.Content className="items-start">
            <Checkbox.Control className="mt-0.5">
              <Checkbox.Indicator />
            </Checkbox.Control>
            <span className="flex flex-col">
              <span className="text-[13px] font-medium">Request an out-of-service block</span>
              <span className="text-[12px] leading-4 font-normal text-muted">
                {isRoom
                  ? "The room stays on sale until you approve the block."
                  : "Only for rooms. Start the room or asset with “Room”."}
              </span>
            </span>
          </Checkbox.Content>
        </Checkbox>
      </FormDialog>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
