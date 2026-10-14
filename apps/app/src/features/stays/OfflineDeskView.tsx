"use client";

import { ArrowsRotateRight, Check, Clock, CloudCheck, CloudSlash } from "@gravity-ui/icons";
import { Alert, Button, Card, Description, Input, Label, Separator, Table, TextField } from "@heroui/react";
import { ListView, RadioButtonGroup, Segment } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  CashGuest,
  ConflictChoice,
  OfflineAction,
  OfflineArrival,
  PaymentRail,
  SyncConflict,
  Tone,
} from "@injishi/data/fixtures/stays";
import { LinkButton, PageContent, PageHeader, StatusDot } from "@injishi/ui";
import { useState } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";
import { CardHeading, IconTile, InfoRow, parseAmount, rwf, ToneChip } from "./parts";

export interface OfflineDeskData {
  arrivals: OfflineArrival[];
  queue: OfflineAction[];
  rails: PaymentRail[];
  cashGuests: CashGuest[];
  conflict: SyncConflict;
  choices: ConflictChoice[];
}

interface CashEntry {
  amount: number;
  name: string;
  folio: string;
}

export function OfflineDeskView({
  data,
  initialOffline,
}: {
  persona: Persona;
  data: OfflineDeskData;
  initialOffline: boolean;
}) {
  const [reconnected, setReconnected] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [cash, setCash] = useState<CashEntry[]>([]);
  const [cashAmt, setCashAmt] = useState("");
  const [cashGuest, setCashGuest] = useState(data.cashGuests[0]?.id ?? "");
  const [choice, setChoice] = useState<ConflictChoice["id"]>("keep");
  const [resolved, setResolved] = useState(false);

  const offline = initialOffline && !reconnected;
  const online = !offline;
  const keepPierre = choice === "keep";
  const conflictOpen = online && !resolved;

  const queued: OfflineAction[] = [
    ...data.queue,
    ...data.arrivals
      .filter((a) => !a.queued && checked[a.id])
      .map((a) => ({
        id: `c-${a.id}`,
        icon: "ArrowRightToSquare",
        title: `Check in ${a.name} → room ${a.room}`,
        detail: "10:52 · passport checked · key card encoded",
        kind: "checkin" as const,
        conflict: false,
      })),
    ...cash.map((c, i) => ({
      id: `mx${i}`,
      icon: "Wallet",
      title: `Cash ${rwf(c.amount)} · ${c.name} · folio ${c.folio}`,
      detail: `10:5${3 + i} · Till 1`,
      kind: "cash" as const,
      conflict: false,
    })),
  ];
  const queue = queued.map((q) => {
    let state: { label: string; tone: Tone };
    if (offline)
      state =
        q.kind === "cash"
          ? { label: "Recorded offline — not verified", tone: "warning" }
          : { label: "Will sync", tone: "default" };
    else if (q.conflict && !resolved) state = { label: "Conflict · needs you", tone: "danger" };
    else if (q.kind === "cash") state = { label: "Synced · unverified until shift count", tone: "warning" };
    else if (q.conflict) state = { label: keepPierre ? "Synced · kept 207" : "Synced · moved to 209", tone: "success" };
    else state = { label: "Synced 10:53", tone: "success" };
    return { ...q, state };
  });
  const total = queue.length;

  const arrivals = data.arrivals.map((a) => {
    const isQueued = a.queued || !!checked[a.id];
    let room = a.room;
    if (a.noRoom) room = offline ? "Unassigned" : resolved && keepPierre ? "209" : a.room;
    if (a.conflict && online && resolved && !keepPierre) room = "209";
    const noRoom = offline && a.noRoom;
    const dirty = offline && a.dirty;
    const blocked = !isQueued && (noRoom || dirty);
    let state: { label: string; tone: Tone } | null = null;
    if (isQueued)
      state = offline
        ? { label: "Will sync", tone: "default" }
        : a.conflict && !resolved
          ? { label: "Conflict", tone: "danger" }
          : { label: "Checked in", tone: "success" };
    else if (online) state = { label: "Ready", tone: "default" };
    return {
      ...a,
      room,
      status: offline ? a.statusOffline : a.statusOnline,
      tone: offline ? a.toneOffline : ("success" as Tone),
      canCheckIn: !isQueued && !blocked && offline,
      blocked,
      why: noRoom
        ? "Room assignment needs the live room rack."
        : "Room was dirty when cached. Check in once housekeeping confirms it online.",
      state,
    };
  });

  const rails = data.rails.filter((r) => r.mode === (offline ? "offline" : "online"));
  const amount = parseAmount(cashAmt);
  const addCash = () => {
    if (!amount) return;
    const g = data.cashGuests.find((x) => x.id === cashGuest);
    if (!g) return;
    setCash([...cash, { amount, name: g.name, folio: g.folio }]);
    setCashAmt("");
  };

  return (
    <PageContent>
      <TopbarStatus
        kind="chip"
        tone={offline || conflictOpen ? "warning" : "success"}
        icon={offline ? "CloudSlash" : "CloudCheck"}
        label={offline ? `Offline · ${total} queued` : conflictOpen ? "Online · 1 conflict" : "Online · all synced"}
      />
      <PageHeader
        eyebrow="Desk 1 · Isangano Lakeside Hotel · Monday 12 October"
        title="Offline Desk"
        description="Keep arrivals moving when the connection drops. Nothing financial is confirmed until it syncs."
        actions={
          <>
            {offline ? (
              <Button variant="secondary" onPress={() => setReconnected(true)}>
                <ArrowsRotateRight className="size-4" />
                Try to reconnect
              </Button>
            ) : null}
            <LinkButton href={screenHref("FrontDeskToday")} variant="ghost">
              Back to Today
            </LinkButton>
          </>
        }
      />

      {offline ? (
        <Alert status="warning" role="status">
          <Alert.Indicator>
            <CloudSlash />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title className="text-[15px]">You are offline · last synced 10:42:18</Alert.Title>
            <Alert.Description>
              {total} actions are saved on this computer and sync in order when the connection returns. Other desks and
              the guest app cannot see them yet. Retrying every 30 seconds · last try 10:52.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : (
        <Alert status={conflictOpen ? "accent" : "success"} role="status">
          <Alert.Indicator>{conflictOpen ? <ArrowsRotateRight /> : <CloudCheck />}</Alert.Indicator>
          <Alert.Content>
            <Alert.Title className="text-[15px]">
              {conflictOpen
                ? `Back online at 10:53 · ${total - 1} of ${total} actions synced`
                : `All ${total} actions synced at 10:54`}
            </Alert.Title>
            <Alert.Description>
              {conflictOpen
                ? "One check-in clashes with a change made on Desk 2 while you were offline. Nothing was overwritten; choose below."
                : "Other desks, housekeeping and the guest app now see your changes. Cash noted offline stays unverified until the shift count."}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_580px] flex-col gap-4">
          <Card aria-labelledby="ar-h" className="gap-3 p-[18px]">
            <CardHeading
              id="ar-h"
              title="Arrivals Today"
              sub={
                offline
                  ? "Read-only copy saved at 10:42. Room status may have changed since."
                  : "Live from the room rack"
              }
              action={
                <ToneChip
                  size="sm"
                  tone={offline ? "warning" : "success"}
                  icon={offline ? <Clock className="size-3" /> : <Check className="size-3" />}
                >
                  {offline ? "Cached 10:42" : "Live"}
                </ToneChip>
              }
            />
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Arrivals today">
                  <Table.Header>
                    <Table.Column isRowHeader>Guest</Table.Column>
                    <Table.Column>Room</Table.Column>
                    <Table.Column>ETA</Table.Column>
                    <Table.Column>Room status</Table.Column>
                    <Table.Column>Check-in</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {arrivals.map((a) => (
                      <Table.Row key={a.id} id={a.id}>
                        <Table.Cell>
                          <span className="flex flex-col">
                            <span className="font-medium">{a.name}</span>
                            <span className="text-[12px] text-muted tabular">
                              {a.booking} · {a.roomType}
                            </span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="tabular">{a.room}</Table.Cell>
                        <Table.Cell className="tabular">{a.eta}</Table.Cell>
                        <Table.Cell>
                          <span className="flex items-center gap-1.5 text-[13px]">
                            <StatusDot tone={a.tone} />
                            {a.status}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          {a.canCheckIn ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => setChecked({ ...checked, [a.id]: true })}
                            >
                              Check in offline
                            </Button>
                          ) : null}
                          {a.state ? (
                            <ToneChip size="sm" tone={a.state.tone}>
                              {a.state.label}
                            </ToneChip>
                          ) : null}
                          {a.blocked ? (
                            <span className="block max-w-[220px] text-[12px] leading-4 text-muted">{a.why}</span>
                          ) : null}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card>

          <Card aria-labelledby="q-h" className="gap-2.5 p-[18px]">
            <CardHeading
              id="q-h"
              title="Queued on This Computer"
              className="items-center"
              action={<span className="text-[12px] text-muted tabular">{total} actions · oldest 10:44</span>}
            />
            <ListView aria-label="Queued actions" variant="secondary" items={queue}>
              {(q) => (
                <ListView.Item id={q.id} textValue={q.title} className="items-start">
                  <ListView.ItemContent className="items-start">
                    <IconTile name={q.icon} />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <ListView.Title className="whitespace-normal">{q.title}</ListView.Title>
                      <ListView.Description className="whitespace-normal tabular">{q.detail}</ListView.Description>
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction>
                    <ToneChip tone={q.state.tone}>{q.state.label}</ToneChip>
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
          </Card>
        </div>

        <div className="flex min-w-0 max-w-[440px] flex-[1_1_340px] flex-col gap-4">
          {online ? (
            <Card aria-labelledby="cf-h" className="gap-3 p-[18px]">
              <CardHeading
                id="cf-h"
                title={`Room ${data.conflict.room} Was Assigned Twice`}
                sub={`Found during sync at ${data.conflict.foundAt}. Choose who keeps the room.`}
                action={
                  <ToneChip size="sm" tone={resolved ? "success" : "danger"}>
                    {resolved ? "Resolved" : "Needs your choice"}
                  </ToneChip>
                }
              />
              {resolved ? (
                <p className="text-[13px] leading-[18px]">
                  {keepPierre ? data.conflict.resolved.keep : data.conflict.resolved.swap}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {data.conflict.sides.map((side) => (
                      <Card key={side.source} variant="secondary" className="gap-0.5 px-3 py-2.5">
                        <span className="text-[12px] text-muted">{side.source}</span>
                        <span className="font-semibold">{side.guest}</span>
                        <span className="text-[12px] leading-4 text-muted tabular">{side.detail}</span>
                      </Card>
                    ))}
                  </div>
                  <RadioButtonGroup
                    aria-label="Resolution"
                    value={choice}
                    onChange={(v) => setChoice(v as ConflictChoice["id"])}
                    className="flex-col gap-2"
                  >
                    {data.choices.map((c) => (
                      <RadioButtonGroup.Item key={c.id} value={c.id} className="px-3.5 py-2.5">
                        <RadioButtonGroup.ItemContent className="gap-0.5">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[13px] font-medium">{c.label}</span>
                            {c.suggested ? (
                              <ToneChip size="sm" tone="accent">
                                Suggested
                              </ToneChip>
                            ) : null}
                          </span>
                          <span className="text-[12px] leading-4 text-muted">{c.hint}</span>
                        </RadioButtonGroup.ItemContent>
                      </RadioButtonGroup.Item>
                    ))}
                  </RadioButtonGroup>
                  <Button className="self-start" onPress={() => setResolved(true)}>
                    Apply and tell Aline
                  </Button>
                </>
              )}
            </Card>
          ) : null}

          <Card aria-labelledby="pm-h" className="gap-3 p-[18px]">
            <CardHeading
              id="pm-h"
              title="Payments and Folios"
              sub={offline ? "What works while offline" : "Connection restored"}
            />
            {rails.map((r) => (
              <InfoRow
                key={r.id}
                icon={r.icon}
                title={r.label}
                detail={r.why}
                trailing={
                  <ToneChip size="sm" tone={r.tone}>
                    {r.state}
                  </ToneChip>
                }
              />
            ))}
            {offline ? (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  <span id="cg-l" className="text-sm font-medium">
                    Record cash received
                  </span>
                  <Segment
                    aria-labelledby="cg-l"
                    selectedKey={cashGuest}
                    onSelectionChange={(k) => setCashGuest(String(k))}
                    className="w-full"
                  >
                    {data.cashGuests.map((g) => (
                      <Segment.Item key={g.id} id={g.id} className="flex-1">
                        {g.label}
                      </Segment.Item>
                    ))}
                  </Segment>
                  <div className="flex items-end gap-2">
                    <TextField value={cashAmt} onChange={setCashAmt} className="flex-1">
                      <Label>Amount (RWF)</Label>
                      <Input variant="secondary" inputMode="numeric" placeholder="e.g. 20,000" className="tabular" />
                    </TextField>
                    <Button variant="secondary" isDisabled={!amount} onPress={addCash}>
                      Record offline
                    </Button>
                  </div>
                  <Description>
                    Saved as “Recorded offline — not verified”. Put the cash in Till 1; it is counted at shift close.
                  </Description>
                </div>
              </>
            ) : null}
          </Card>
        </div>
      </div>
    </PageContent>
  );
}
