"use client";

import { ArrowsRotateRight, Check, Clock, CloudSlash, Eye } from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Description,
  FieldError,
  Input,
  Label,
  Separator,
  Table,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
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
import { CardHeading, IconTile, InfoRow, readFrancs, ToneChip } from "./parts";

export interface OfflineDeskData {
  arrivals: OfflineArrival[];
  queue: OfflineAction[];
  rails: PaymentRail[];
  cashGuests: CashGuest[];
  conflict: SyncConflict;
  choices: ConflictChoice[];
}

/**
 * The offline desk is a preview. Working without a connection needs a cached copy of the day and an outbox
 * replayed on reconnect (with check-in and walk-in idempotent, which they are not yet), and none of that
 * exists: this browser stores nothing and sends nothing later. The screen shows the prototype's sample day
 * so the design can be read, and every action on it says plainly that it is not available.
 */
export function OfflineDeskView({
  data,
  initialOffline,
}: {
  persona: Persona;
  data: OfflineDeskData;
  initialOffline: boolean;
}) {
  const [cashAmt, setCashAmt] = useState("");
  const [cashGuest, setCashGuest] = useState(data.cashGuests[0]?.id ?? "");
  const [choice, setChoice] = useState<ConflictChoice["id"]>("keep");

  const offline = initialOffline;
  const online = !offline;
  const unavailable = (what: string) =>
    toast.warning(
      `${what} is not available yet: the offline desk is a preview, and nothing is saved on this computer.`,
    );

  const queue = data.queue.map((q) => ({ ...q, state: { label: "Sample · not saved", tone: "default" as Tone } }));
  const total = queue.length;

  const arrivals = data.arrivals.map((a) => {
    const noRoom = offline && a.noRoom;
    const dirty = offline && a.dirty;
    const blocked = !a.queued && (noRoom || dirty);
    return {
      ...a,
      room: a.noRoom && offline ? "Unassigned" : a.room,
      status: offline ? a.statusOffline : a.statusOnline,
      tone: offline ? a.toneOffline : ("success" as Tone),
      canCheckIn: !a.queued && !blocked && offline,
      blocked,
      why: noRoom
        ? "Room assignment needs the live room rack."
        : "Room was dirty in the sample copy. Check in once housekeeping confirms it online.",
      state: a.queued ? { label: "Sample · not checked in", tone: "default" as Tone } : null,
    };
  });

  const rails = data.rails.filter((r) => r.mode === (offline ? "offline" : "online"));
  const { amount, error: amountError } = readFrancs(cashAmt);

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <TopbarStatus
        kind="chip"
        tone="warning"
        icon={offline ? "CloudSlash" : "CloudCheck"}
        label={offline ? "Offline preview · nothing queued" : "Offline desk preview"}
      />
      <PageHeader
        eyebrow="Desk 1 · sample day"
        title="Offline Desk"
        description="A preview of keeping arrivals moving when the connection drops. Nothing on this page is saved or sent."
        actions={
          <>
            {offline ? (
              <Button variant="secondary" onPress={() => unavailable("Reconnecting the offline desk")}>
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

      <Alert status="warning" role="status">
        <Alert.Indicator>{offline ? <CloudSlash /> : <Eye />}</Alert.Indicator>
        <Alert.Content>
          <Alert.Title className="text-[15px]">Preview · working offline is not available yet</Alert.Title>
          <Alert.Description>
            The arrivals, queue and conflict below are the prototype's sample day. This computer keeps no copy of the
            day and no queue of actions: check in, take payments and resolve rooms on Today while you are connected.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_580px] flex-col gap-4">
          <Card aria-labelledby="ar-h" className="gap-3 p-[18px]">
            <CardHeading
              id="ar-h"
              title="Arrivals Today"
              sub={offline ? "Sample copy: not today's arrivals" : "Sample: today's arrivals are on Today"}
              action={
                <ToneChip
                  size="sm"
                  tone="warning"
                  icon={offline ? <Clock className="size-3" /> : <Check className="size-3" />}
                >
                  Sample
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
                            <Button size="sm" variant="secondary" onPress={() => unavailable("Checking in offline")}>
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
              action={<span className="text-[12px] text-muted tabular">{total} sample actions · none saved</span>}
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
                sub={`Sample conflict, as a sync would raise it at ${data.conflict.foundAt}.`}
                action={
                  <ToneChip size="sm" tone="default">
                    Sample
                  </ToneChip>
                }
              />
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
              <Button className="self-start" onPress={() => unavailable("Resolving a sync conflict")}>
                Apply and tell the duty manager
              </Button>
            </Card>
          ) : null}

          <Card aria-labelledby="pm-h" className="gap-3 p-[18px]">
            <CardHeading
              id="pm-h"
              title="Payments and Folios"
              sub={offline ? "What would work while offline" : "Connection restored"}
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
                    <TextField value={cashAmt} onChange={setCashAmt} isInvalid={!!amountError} className="flex-1">
                      <Label>Amount (RWF)</Label>
                      <Input variant="secondary" inputMode="numeric" placeholder="e.g. 20,000" className="tabular" />
                      <FieldError>{amountError}</FieldError>
                    </TextField>
                    <Button
                      variant="secondary"
                      isDisabled={!amount}
                      onPress={() => unavailable("Recording cash offline")}
                    >
                      Record offline
                    </Button>
                  </div>
                  <Description>
                    Not available offline. Record cash on the guest's bill (Stay and folio) while you are connected.
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
