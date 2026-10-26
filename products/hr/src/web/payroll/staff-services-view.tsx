"use client";

import { CircleCheck, EyeSlash, Lock, PaperPlane, TriangleExclamation } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Label, Switch, Table, Tag, TagGroup, TextArea, TextField } from "@heroui/react";
import { ChatMessage, ItemCard, ItemCardGroup, ListView } from "@heroui-pro/react";
import { Icon, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { useState } from "react";
import type { HelpdeskTicket, HrAutomation, HrReport, StaffAsset, TicketMessage } from "../../model/payroll.ts";
import type { Persona } from "../../model/shared.ts";
import { useBoardHref } from "../mount.tsx";
import { PressableItemCard } from "./parts.tsx";

interface StaffServicesData {
  tickets: HelpdeskTicket[];
  assets: StaffAsset[];
  reports: HrReport[];
  automations: HrAutomation[];
}

type AssetFilter = "all" | "due" | "leaver" | "risk";
type ReturnCondition = "good" | "damaged" | "lost";

const RETURNED: Record<ReturnCondition, { status: string; tone: "success" | "warning" | "danger" }> = {
  good: { status: "Returned · good", tone: "success" },
  damaged: { status: "Returned · damaged", tone: "warning" },
  lost: { status: "Reported lost", tone: "danger" },
};

function Message({ message }: { message: TicketMessage }) {
  if (message.from === "me") {
    return (
      <ChatMessage.User className="gap-0.5">
        <ChatMessage.Bubble className="max-w-[85%] rounded-[14px] bg-accent-soft px-3 py-2">
          <ChatMessage.Content className="text-[13px] leading-[18px]">{message.text}</ChatMessage.Content>
        </ChatMessage.Bubble>
        <span className="text-[11px] text-muted">{message.meta}</span>
      </ChatMessage.User>
    );
  }
  return (
    <ChatMessage.Assistant className="py-0">
      <ChatMessage.Body className="items-start gap-0.5 pe-0">
        <ChatMessage.Bubble
          className={
            message.from === "system"
              ? "max-w-[85%] rounded-[14px] border border-separator bg-transparent px-3 py-2"
              : "max-w-[85%] rounded-[14px] bg-surface-secondary px-3 py-2"
          }
        >
          <ChatMessage.Content className="text-[13px] leading-[18px]">{message.text}</ChatMessage.Content>
        </ChatMessage.Bubble>
        <span className="text-[11px] text-muted">{message.meta}</span>
      </ChatMessage.Body>
    </ChatMessage.Assistant>
  );
}

export function StaffServicesView({ persona, data }: { persona: Persona; data: StaffServicesData }) {
  const screenHref = useBoardHref();
  const [selectedId, setSelectedId] = useState(() => data.tickets.find((t) => !t.resolved)?.id ?? "");
  const [resolved, setResolved] = useState<Record<string, boolean>>({});
  const [replies, setReplies] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [returns, setReturns] = useState<Record<string, ReturnCondition>>({});
  const [choosing, setChoosing] = useState<string | null>(null);
  const [ran, setRan] = useState<Record<string, boolean>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.automations.map((a) => [a.id, a.enabled])),
  );

  const tickets = data.tickets.map((t) => {
    const isResolved = t.resolved || !!resolved[t.id];
    return {
      ...t,
      isResolved,
      state: isResolved ? "Resolved" : t.state,
      stateTone: isResolved ? ("success" as const) : t.stateTone,
    };
  });
  const openCount = tickets.filter((t) => !t.isResolved).length;
  const cur = tickets.find((t) => t.id === selectedId) ?? tickets[0];
  const firstName = cur?.who.split(" ")[0] ?? "";
  const thread: (TicketMessage & { key: string })[] = cur
    ? [
        ...cur.thread.map((m, n) => ({ ...m, key: `${cur.id}-${n}` })),
        ...(replies[cur.id] ?? []).map((text, n) => ({
          key: `${cur.id}-reply-${n}`,
          from: "me" as const,
          text,
          meta: `${persona.name} · just now`,
        })),
      ]
    : [];

  const send = () => {
    const text = draft.trim();
    if (!cur || !text) return;
    setReplies((r) => ({ ...r, [cur.id]: [...(r[cur.id] ?? []), text] }));
    setDraft("");
  };

  const assets = data.assets.map((a) => {
    const cond = returns[a.id];
    if (!cond) return a;
    return {
      ...a,
      status: RETURNED[cond].status,
      statusTone: RETURNED[cond].tone,
      returnDue: false,
      note: cond === "lost" ? "Lock change requested" : `Signed by ${persona.name}`,
      custody: `Return recorded today by ${persona.name}`,
    };
  });
  const matches = (a: StaffAsset, f: AssetFilter) =>
    f === "all" ||
    (f === "leaver" && a.kind === "leaver") ||
    (f === "due" && a.returnDue) ||
    (f === "risk" && a.highRisk);
  const filters: { id: AssetFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "due", label: "Due back" },
    { id: "leaver", label: "Leavers" },
    { id: "risk", label: "High risk" },
  ];
  const shownAssets = assets.filter((a) => matches(a, filter));
  const anyLost = Object.values(returns).includes("lost");
  const recordReturn = (id: string, cond: ReturnCondition) => {
    setReturns((r) => ({ ...r, [id]: cond }));
    setChoosing(null);
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow="People › Staff services · requests come from the staff app and the kiosk"
        title="Staff Services"
        description="Helpdesk, equipment on loan, HR reports and automations. Pay and health questions stay between the employee and HR."
      />

      <div className="flex flex-wrap items-start gap-[16px]">
        <ItemCardGroup layout="list" aria-labelledby="hd-h" className="min-w-0 flex-[999_1_560px] overflow-hidden">
          <ItemCardGroup.Header>
            <ItemCardGroup.Title id="hd-h">Helpdesk</ItemCardGroup.Title>
            <ItemCardGroup.Description>{openCount} open · answered within 3 working days</ItemCardGroup.Description>
          </ItemCardGroup.Header>
          {tickets.map((t) => (
            <PressableItemCard
              key={t.id}
              isSelected={t.id === cur?.id}
              onPress={() => {
                if (t.id !== cur?.id) setDraft("");
                setSelectedId(t.id);
              }}
              className="items-center"
            >
              <ItemCard.Icon>
                <Icon name={t.icon} />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title className="whitespace-normal">{t.title}</ItemCard.Title>
                <ItemCard.Description>
                  {t.id} · {t.who} · {t.topic} · {t.age}
                </ItemCard.Description>
              </ItemCard.Content>
              <ItemCard.Action className="flex items-center gap-1.5">
                {t.hrOnly ? (
                  <Chip size="sm" variant="soft">
                    <Lock className="size-3" aria-hidden="true" />
                    <Chip.Label>HR only</Chip.Label>
                  </Chip>
                ) : null}
                <Chip size="sm" variant="soft" color={toneColor(t.stateTone)}>
                  {t.state}
                </Chip>
              </ItemCard.Action>
            </PressableItemCard>
          ))}
        </ItemCardGroup>

        {cur ? (
          <Card aria-labelledby="tk-h" className="min-w-0 flex-[1_1_400px] gap-[12px] p-[18px]">
            <div className="flex flex-col gap-1">
              <h2 id="tk-h" className="text-base leading-[22px] font-semibold">
                {cur.title}
              </h2>
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted">
                  {cur.id} · {cur.who} · {cur.topic}
                </span>
                <Chip size="sm" variant="soft" color={toneColor(cur.stateTone)}>
                  {cur.state}
                </Chip>
              </span>
            </div>
            <div className="flex flex-col gap-[10px]" aria-label={`Conversation with ${cur.who}`} role="log">
              {thread.map((m) => (
                <Message key={m.key} message={m} />
              ))}
            </div>
            {cur.isResolved ? (
              <Alert status="success">
                <Alert.Indicator>
                  <CircleCheck aria-hidden="true" />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Resolved</Alert.Title>
                  <Alert.Description>{firstName} can reopen it from the staff app within 7 days.</Alert.Description>
                </Alert.Content>
              </Alert>
            ) : (
              <>
                <TextField fullWidth value={draft} onChange={setDraft}>
                  <Label>Reply to {firstName}</Label>
                  <TextArea variant="secondary" rows={2} placeholder={`Visible to ${firstName} in the staff app`} />
                </TextField>
                <div className="flex flex-wrap items-center gap-2">
                  {cur.link ? (
                    <LinkButton href={screenHref(cur.link.board)} size="sm" variant="ghost">
                      {cur.link.label}
                    </LinkButton>
                  ) : null}
                  <span className="flex-1" />
                  <Button variant="secondary" onPress={() => setResolved((r) => ({ ...r, [cur.id]: true }))}>
                    Resolve
                  </Button>
                  <Button onPress={send}>
                    <PaperPlane className="size-4" aria-hidden="true" />
                    Send
                  </Button>
                </div>
              </>
            )}
          </Card>
        ) : null}
      </div>

      <section className="flex flex-col gap-[10px]" aria-labelledby="as-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <h2 id="as-h" className="text-[15px] leading-[22px] font-semibold">
              Assets Lent to Staff
            </h2>
            <span className="text-xs text-muted">
              Every hand-over is signed in the staff app or at the kiosk. Master keys are signed out and back daily.
            </span>
          </div>
          <TagGroup
            aria-label="Filter assets"
            size="sm"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([filter])}
            onSelectionChange={(keys) => {
              const [first] = keys;
              if (first !== undefined) setFilter(String(first) as AssetFilter);
            }}
          >
            <TagGroup.List>
              {filters.map((f) => (
                <Tag key={f.id} id={f.id}>
                  {f.label} · {assets.filter((a) => matches(a, f.id)).length}
                </Tag>
              ))}
            </TagGroup.List>
          </TagGroup>
        </div>
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Assets lent to staff">
              <Table.Header>
                <Table.Column isRowHeader>Asset</Table.Column>
                <Table.Column>Held by</Table.Column>
                <Table.Column>Custody</Table.Column>
                <Table.Column>Condition</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column className="text-right">Action</Table.Column>
              </Table.Header>
              <Table.Body>
                {shownAssets.map((a) => (
                  <Table.Row key={a.id} id={a.id}>
                    <Table.Cell>
                      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <Icon name={a.icon} className="size-4 shrink-0 text-muted" />
                        <span className="flex min-w-0 flex-col">
                          <span className="font-medium">{a.name}</span>
                          <span className="text-xs text-muted">{a.tag}</span>
                        </span>
                        {a.highRisk ? (
                          <Chip size="sm" variant="soft" color="danger">
                            High risk
                          </Chip>
                        ) : null}
                      </span>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col">
                        <span>{a.holder}</span>
                        <span className="text-xs text-muted">{a.dept}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-[13px]">{a.custody}</Table.Cell>
                    <Table.Cell>{a.condition}</Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={toneColor(a.statusTone)}>
                        {a.status}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {a.returnDue && choosing === a.id ? (
                        <span className="flex justify-end gap-1">
                          <Button size="sm" onPress={() => recordReturn(a.id, "good")}>
                            Good
                          </Button>
                          <Button size="sm" variant="secondary" onPress={() => recordReturn(a.id, "damaged")}>
                            Damaged
                          </Button>
                          <Button size="sm" variant="danger-soft" onPress={() => recordReturn(a.id, "lost")}>
                            Lost
                          </Button>
                        </span>
                      ) : a.returnDue ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => setChoosing(a.id)}
                          aria-label={`Record return of ${a.name}`}
                        >
                          Record return
                        </Button>
                      ) : (
                        <span className="text-xs text-muted">{a.note}</span>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        {anyLost ? (
          <Alert status="warning">
            <Alert.Indicator>
              <TriangleExclamation aria-hidden="true" />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Lost key recorded · lock change requested from Maintenance</Alert.Title>
              <Alert.Description>
                Any pay deduction for a lost item needs the owner’s approval and the employee’s written acknowledgement.
                Nothing is deducted automatically.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}
      </section>

      <div className="grid items-start gap-[16px] [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
        <Card aria-labelledby="rp-h" className="gap-[10px] p-[18px]">
          <Card.Header>
            <Card.Title id="rp-h" className="text-[15px] font-semibold">
              HR Reports
            </Card.Title>
            <Card.Description>
              Aggregates by default · groups under 5 people are combined so no one can be singled out
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <ListView
              aria-label="HR reports"
              variant="secondary"
              items={data.reports.map((r) => ({ ...r, ran: !!ran[r.id] }))}
            >
              {(r) => (
                <ListView.Item id={r.id} textValue={r.title}>
                  <ListView.ItemContent>
                    <Icon name={r.icon} className="size-4 shrink-0 text-muted" />
                    <div className="flex min-w-0 flex-col">
                      <ListView.Title>{r.title}</ListView.Title>
                      <ListView.Description>{r.detail}</ListView.Description>
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction>
                    {r.ownerOnly ? (
                      <Chip size="sm" variant="soft">
                        <Lock className="size-3" aria-hidden="true" />
                        <Chip.Label>Owner only</Chip.Label>
                      </Chip>
                    ) : r.ran ? (
                      <Chip size="sm" variant="soft" color="success">
                        Ready · export logged
                      </Chip>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Run ${r.title}`}
                        onPress={() => setRan((x) => ({ ...x, [r.id]: true }))}
                      >
                        Run
                      </Button>
                    )}
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
          </Card.Content>
        </Card>

        <Card aria-labelledby="au-h" className="gap-[10px] p-[18px]">
          <Card.Header>
            <Card.Title id="au-h" className="text-[15px] font-semibold">
              HR Automations
            </Card.Title>
            <Card.Description>
              Never include salary, health or family details · sent only to the people listed
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-[10px]">
            {data.automations.map((u) => {
              const on = !!enabled[u.id];
              return (
                <div key={u.id} className="flex items-start gap-[12px] border-t border-separator pt-2.5">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[13px] font-medium">{u.title}</span>
                    <span className="text-xs leading-4 text-muted">{u.detail}</span>
                    <span className="flex items-center gap-1 text-xs leading-4">
                      <EyeSlash className="size-3 shrink-0 text-muted" aria-hidden="true" />
                      {u.privacy}
                    </span>
                    <span className="text-[11px] text-muted">
                      {on ? (u.lastRun ?? "On · runs daily at 06:00") : "Off · nothing is sent"}
                    </span>
                  </div>
                  <Switch
                    aria-label={u.title}
                    isSelected={on}
                    onChange={(v) => setEnabled((e) => ({ ...e, [u.id]: v }))}
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>
                </div>
              );
            })}
          </Card.Content>
        </Card>
      </div>
    </PageContent>
  );
}
