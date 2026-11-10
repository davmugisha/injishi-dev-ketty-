"use client";

import {
  ArrowRotateLeft,
  ChevronRight,
  CircleCheck,
  Comment,
  Ellipsis,
  Key,
  Lock,
  Megaphone,
  PaperPlane,
  Plus,
  TriangleExclamation,
  Xmark,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  Drawer,
  Dropdown,
  Input,
  Label,
  Pagination,
  Table,
  Tabs,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { ChatMessage, EmptyState, ItemCard, ItemCardGroup, KPIGroup, NativeSelect, Segment } from "@heroui-pro/react";
import { KPI } from "@heroui-pro/react/kpi";
import { Icon, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { Fragment, type ReactNode, useState, useTransition } from "react";
import type { AnnouncementAudience, AnnouncementFor, HrAnnouncement } from "../../model/announcements.ts";
import type { HelpdeskTicket, StaffAsset, TicketMessage } from "../../model/payroll.ts";
import { useBoardHref, useHrActions, useHrFeature } from "../mount.tsx";
import { avatarColor, Hint, initials, PanelCard, Person, TAB_CLASS, Tip } from "../people/parts";
import { PressableItemCard } from "./parts";

export interface StaffServicesData {
  tickets: HelpdeskTicket[];
  assets: StaffAsset[];
  announcements: HrAnnouncement[];
  audience: AnnouncementAudience;
}

type Part = "desk" | "lent" | "news" | "reports";
type AssetFilter = "all" | "due" | "leaver" | "risk" | "back";
type ReturnCondition = "good" | "damaged" | "lost";

/** Rows per page: a list fits a screen, the detail opens beside it. */
const PAGE = 12;

const NOTHING_SHOWN: Record<AssetFilter, string> = {
  all: "Nothing is out.",
  due: "Nothing is due back.",
  leaver: "No leaver is holding anything.",
  risk: "No high risk item is out.",
  back: "Nothing returned yet.",
};

const ANNOUNCEMENT_STATE: Record<HrAnnouncement["status"], { label: string; tone: "success" | "default" }> = {
  showing: { label: "Showing", tone: "success" },
  ended: { label: "Ended", tone: "default" },
  down: { label: "Taken down", tone: "default" },
};

const NO_POST = { title: "", body: "", who: "all" as AnnouncementFor, targetId: "", expiresOn: "" };

/** HR's reports, each opening the HR report at its own part. */
const REPORTS: { id: string; icon: string; title: string; detail: string; tab: string }[] = [
  {
    id: "headcount",
    icon: "Persons",
    title: "Headcount and leavers",
    detail: "Who joined and who left.",
    tab: "staff",
  },
  {
    id: "absence",
    icon: "Clock",
    title: "Absence and lateness",
    detail: "Who was late or absent, and when.",
    tab: "attendance",
  },
  {
    id: "leave",
    icon: "Calendar",
    title: "Leave owed",
    detail: "Sick, annual and other leave taken.",
    tab: "leave",
  },
  {
    id: "overtime",
    icon: "Clock",
    title: "Overtime hours",
    detail: "Hours over the shift, waiting or approved.",
    tab: "attendance",
  },
  {
    id: "cost",
    icon: "Sack",
    title: "Payroll cost",
    detail: "Gross, PAYE, RSSB and net by month.",
    tab: "pay",
  },
];

const KINDS = [
  { id: "key", label: "Key" },
  { id: "uniform", label: "Uniform" },
  { id: "phone", label: "Phone" },
  { id: "laptop", label: "Laptop" },
  { id: "tool", label: "Tool" },
  { id: "other", label: "Other" },
] as const;

const KPI_CLASS = "min-w-[min(140px,100%)] flex-[1_1_140px]";

function Message({ message }: { message: TicketMessage }) {
  if (message.from === "me") {
    return (
      <ChatMessage.User className="gap-0.5">
        <ChatMessage.Bubble className="max-w-[85%] rounded-[14px] bg-accent-soft px-3 py-2">
          <ChatMessage.Content className="text-[13px] leading-[18px]">{message.text}</ChatMessage.Content>
        </ChatMessage.Bubble>
        <span className="text-xs text-muted">{message.meta}</span>
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
        <span className="text-xs text-muted">{message.meta}</span>
      </ChatMessage.Body>
    </ChatMessage.Assistant>
  );
}

/** A list's page numbers, once it no longer fits one page. */
function Pager({ at, total, onPage }: { at: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.ceil(total / PAGE);
  if (pages < 2) return null;
  return (
    <Pagination size="sm" className="flex flex-wrap items-center justify-between gap-2">
      <Pagination.Summary className="text-xs text-muted tabular">
        {(at - 1) * PAGE + 1}–{Math.min(at * PAGE, total)} of {total}
      </Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous aria-label="Previous page" isDisabled={at === 1} onPress={() => onPage(at - 1)}>
            <Pagination.PreviousIcon />
          </Pagination.Previous>
        </Pagination.Item>
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <Pagination.Item key={n}>
            <Pagination.Link
              isActive={n === at}
              aria-label={`Page ${n}`}
              aria-current={n === at ? "page" : undefined}
              onPress={() => onPage(n)}
            >
              {n}
            </Pagination.Link>
          </Pagination.Item>
        ))}
        <Pagination.Item>
          <Pagination.Next aria-label="Next page" isDisabled={at === pages} onPress={() => onPage(at + 1)}>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

/** The current page of a list, kept in range when the list gets shorter. */
function pageOf<T>(list: T[], page: number): { at: number; rows: T[] } {
  const at = Math.min(page, Math.max(1, Math.ceil(list.length / PAGE)));
  return { at, rows: list.slice((at - 1) * PAGE, at * PAGE) };
}

/**
 * Staff services: the help desk (questions staff asked from Me or the phone, answered and resolved
 * here), the things lent to staff from the day they go out to the day they come back, the
 * announcements HR posts to staff, and HR's reports opening the screens that hold their figures.
 */
export function StaffServicesView({
  data,
  people,
  today,
}: {
  data: StaffServicesData;
  /** Who can be lent something, or be named on an announcement. */
  people: { id: string; name: string; title: string }[];
  today: string;
}) {
  const {
    answerHelpTicket,
    closeHelpTicket,
    lendItem,
    postAnnouncementAction,
    returnItem,
    setAnnouncementShownAction,
  } = useHrActions();
  const screenHref = useBoardHref();
  // Help desk, things lent and announcements are features Injishi may switch off: their tab and figures go.
  const deskOn = useHrFeature("helpDesk");
  const lentOn = useHrFeature("assets");
  const newsOn = useHrFeature("announcements");
  const [chosenPart, setPart] = useState<Part>("desk");
  const [selectedId, setSelectedId] = useState("");
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketPage, setTicketPage] = useState(1);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState<AssetFilter>("all");
  const [assetPage, setAssetPage] = useState(1);
  const [pending, start] = useTransition();
  const [lendOpen, setLendOpen] = useState(false);
  const [lend, setLend] = useState({ employeeId: "", kind: "key", name: "", tag: "", dueBackOn: "", note: "" });
  const [newsPage, setNewsPage] = useState(1);
  const [postOpen, setPostOpen] = useState(false);
  const [post, setPost] = useState(NO_POST);
  const [readId, setReadId] = useState("");
  const [readOpen, setReadOpen] = useState(false);

  const tickets = data.tickets.map((t) => ({ ...t, isResolved: t.resolved }));
  const openCount = tickets.filter((t) => !t.isResolved).length;
  const cur = tickets.find((t) => t.id === selectedId);
  const firstName = cur?.who.split(" ")[0] ?? "";
  const thread: (TicketMessage & { key: string })[] = cur
    ? cur.thread.map((m, n) => ({ ...m, key: `${cur.id}-${n}` }))
    : [];
  const ticketsShown = pageOf(tickets, ticketPage);

  const openTicket = (id: string) => {
    if (id !== selectedId) setDraft("");
    setSelectedId(id);
    setTicketOpen(true);
  };

  /** Answer the person; with `close`, the answer resolves the question. */
  const send = (close: boolean) =>
    start(async () => {
      if (!cur) return;
      const text = draft.trim();
      const r = text ? await answerHelpTicket(cur.id, text, close) : await closeHelpTicket(cur.id);
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      setDraft("");
      if (close) setTicketOpen(false);
      toast.success(close ? "Resolved." : `Sent to ${firstName}.`);
    });

  const assets = data.assets;
  const matches = (a: StaffAsset, f: AssetFilter) =>
    f === "all"
      ? a.returnDue
      : f === "back"
        ? !a.returnDue
        : // Due back counts a leaver's items too, as the figure above the list does.
          (f === "due" && (a.kind === "due" || a.kind === "leaver")) ||
          (f === "leaver" && a.kind === "leaver") ||
          (f === "risk" && a.highRisk && a.returnDue);
  const filters: { id: AssetFilter; label: string }[] = [
    { id: "all", label: "Out" },
    { id: "due", label: "Due back" },
    { id: "leaver", label: "Leavers" },
    { id: "risk", label: "High risk" },
    { id: "back", label: "Returned" },
  ];
  const shownAssets = assets.filter((a) => matches(a, filter));
  const assetsShown = pageOf(shownAssets, assetPage);
  const returned = filter === "back";
  const recordReturn = (a: StaffAsset, cond: ReturnCondition) =>
    start(async () => {
      const r = await returnItem(a.id, cond, today);
      if (!r.ok) toast.danger(r.error);
      else toast.success(cond === "lost" ? `${a.name} recorded lost.` : `${a.name} is back.`);
    });
  const saveLend = () =>
    start(async () => {
      const r = await lendItem({ ...lend, kind: lend.kind as (typeof KINDS)[number]["id"], issuedOn: today });
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      toast.success(`${lend.name.trim()} lent to ${people.find((p) => p.id === lend.employeeId)?.name ?? "them"}.`);
      setLend({ employeeId: "", kind: "key", name: "", tag: "", dueBackOn: "", note: "" });
      setLendOpen(false);
    });
  const matchesCount = (f: AssetFilter) => assets.filter((a) => matches(a, f)).length;
  const out = matchesCount("all");
  const dueBack = matchesCount("due");
  const resolvedCount = tickets.filter((t) => t.isResolved).length;

  const announcements = data.announcements;
  const showing = announcements.filter((a) => a.status === "showing").length;
  const newsShown = pageOf(announcements, newsPage);
  const reading = announcements.find((a) => a.id === readId);
  const targets =
    post.who === "department" ? data.audience.departments : post.who === "position" ? data.audience.positions : people;
  const savePost = () =>
    start(async () => {
      const r = await postAnnouncementAction(post);
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      toast.success(`${post.title.trim()} posted.`);
      setPost(NO_POST);
      setPostOpen(false);
    });
  const setShown = (a: HrAnnouncement, shown: boolean) =>
    start(async () => {
      const r = await setAnnouncementShownAction(a.id, shown);
      if (!r.ok) toast.danger(r.error);
      else toast.success(shown ? `${a.title} is back up.` : `${a.title} taken down.`);
    });

  const parts = (
    [
      ["desk", "Help desk", openCount, deskOn],
      ["lent", "Things lent", out, lentOn],
      ["news", "Announcements", showing, newsOn],
      ["reports", "HR reports", 0, true],
    ] as const
  ).filter(([, , , on]) => on);
  // A tab whose feature went off falls back to the first one left (HR reports is always there).
  const part: Part = parts.some(([id]) => id === chosenPart) ? chosenPart : (parts[0]?.[0] ?? "reports");

  const tiles: { id: string; title: string; value: number; warn: boolean; icon: ReactNode }[] = [
    ...(deskOn
      ? [{ id: "open", title: "Open tickets", value: openCount, warn: openCount > 0, icon: <Comment /> }]
      : []),
    ...(lentOn
      ? [
          { id: "out", title: "Assets out", value: out, warn: false, icon: <Key /> },
          { id: "due", title: "Due back", value: dueBack, warn: dueBack > 0, icon: <ArrowRotateLeft /> },
        ]
      : []),
    ...(deskOn
      ? [{ id: "resolved", title: "Resolved", value: resolvedCount, warn: false, icon: <CircleCheck /> }]
      : []),
  ];

  return (
    <PageContent>
      <PageHeader title="Staff services" />

      {tiles.length ? (
        <section aria-label="Staff services at a glance">
          <KPIGroup className="flex-wrap">
            {tiles.map((t, n) => (
              <Fragment key={t.id}>
                {n ? <KPIGroup.Separator /> : null}
                <KPI className={KPI_CLASS}>
                  <KPI.Header>
                    <KPI.Icon status={t.warn ? "warning" : "success"}>{t.icon}</KPI.Icon>
                    <KPI.Title>{t.title}</KPI.Title>
                  </KPI.Header>
                  <KPI.Content>
                    <KPI.Value value={t.value} className="tabular" />
                  </KPI.Content>
                </KPI>
              </Fragment>
            ))}
          </KPIGroup>
        </section>
      ) : null}

      <Tabs variant="secondary" selectedKey={part} onSelectionChange={(k) => setPart(String(k) as Part)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Staff services" className="justify-start gap-1">
            {parts.map(([id, label, n]) => (
              <Tabs.Tab key={id} id={id} className={TAB_CLASS}>
                {label}
                {n ? (
                  <Chip size="sm" variant="soft">
                    {n}
                  </Chip>
                ) : null}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        {deskOn ? (
          <Tabs.Panel id="desk" className="flex flex-col gap-3 pt-4">
            <ItemCardGroup layout="list" aria-labelledby="hd-h" className="min-w-0 overflow-hidden">
              <ItemCardGroup.Header className="flex flex-row items-center gap-2">
                <ItemCardGroup.Title id="hd-h">Help desk</ItemCardGroup.Title>
                <Chip size="sm" variant="soft" color={openCount ? "warning" : "success"}>
                  {openCount} open
                </Chip>
              </ItemCardGroup.Header>
              {tickets.length === 0 ? (
                <EmptyState size="sm" className="py-8">
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <Comment />
                    </EmptyState.Media>
                    <EmptyState.Title>No questions yet</EmptyState.Title>
                  </EmptyState.Header>
                </EmptyState>
              ) : null}
              {ticketsShown.rows.map((t) => (
                <PressableItemCard
                  key={t.id}
                  isSelected={ticketOpen && t.id === cur?.id}
                  onPress={() => openTicket(t.id)}
                  className="items-center"
                >
                  <ItemCard.Icon>
                    <Icon name={t.icon} />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title className="whitespace-normal">{t.title}</ItemCard.Title>
                    <ItemCard.Description className="flex items-center gap-1.5">
                      <Avatar size="sm" variant="soft" color={avatarColor(t.who)} className="size-5">
                        <Avatar.Fallback className="text-xs">{initials(t.who)}</Avatar.Fallback>
                      </Avatar>
                      {t.who.split(" ")[0]} · {t.age}
                    </ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action className="flex items-center gap-1.5">
                    {t.hrOnly ? (
                      <Tip tip="HR only">
                        <Lock className="size-3.5 text-muted" aria-label="HR only" />
                      </Tip>
                    ) : null}
                    <Chip size="sm" variant="soft">
                      {t.topic}
                    </Chip>
                    <Chip size="sm" variant="soft" color={toneColor(t.stateTone)}>
                      {t.state}
                    </Chip>
                  </ItemCard.Action>
                </PressableItemCard>
              ))}
            </ItemCardGroup>
            <Pager at={ticketsShown.at} total={tickets.length} onPage={setTicketPage} />
          </Tabs.Panel>
        ) : null}

        {lentOn ? (
          <Tabs.Panel id="lent" className="flex flex-col gap-3 pt-4">
            <section className="flex flex-col gap-2.5" aria-labelledby="as-h">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="as-h" className="flex items-center gap-2 text-[15px] leading-[22px] font-semibold">
                  Things lent to staff
                  <Button size="sm" variant="secondary" onPress={() => setLendOpen(true)}>
                    <Plus className="size-4" />
                    Lend an item
                  </Button>
                </h2>
                <Segment
                  aria-label="Filter assets"
                  size="sm"
                  selectedKey={filter}
                  onSelectionChange={(k) => {
                    setFilter(String(k) as AssetFilter);
                    setAssetPage(1);
                  }}
                >
                  {filters.map((f) => (
                    <Segment.Item key={f.id} id={f.id}>
                      {f.label}
                      <span className="ms-1 text-muted tabular">{matchesCount(f.id)}</span>
                    </Segment.Item>
                  ))}
                </Segment>
              </div>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Assets lent to staff" className="min-w-[640px]">
                    <Table.Header>
                      <Table.Column isRowHeader>Asset</Table.Column>
                      <Table.Column>Held by</Table.Column>
                      <Table.Column>Since</Table.Column>
                      <Table.Column>Status</Table.Column>
                      {returned ? null : (
                        <Table.Column className="w-[52px] text-right">
                          <span className="sr-only">Record return</span>
                        </Table.Column>
                      )}
                    </Table.Header>
                    <Table.Body>
                      {shownAssets.length === 0 ? (
                        <Table.Row id="none">
                          <Table.Cell colSpan={returned ? 4 : 5} className="py-6 text-center text-sm text-muted">
                            {NOTHING_SHOWN[filter]}
                          </Table.Cell>
                        </Table.Row>
                      ) : null}
                      {assetsShown.rows.map((a) => {
                        const [since, ...more] = a.custody.split(" · ");
                        return (
                          <Table.Row key={a.id} id={a.id}>
                            <Table.Cell className="py-2.5">
                              <span className="flex items-center gap-2.5">
                                <span
                                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${a.highRisk ? "bg-danger-soft text-danger-soft-foreground" : "bg-surface-secondary text-muted"}`}
                                >
                                  <Icon name={a.icon} className="size-4" />
                                </span>
                                <span className="flex min-w-0 flex-col">
                                  <span className="flex items-center gap-1.5 font-medium">
                                    {a.name}
                                    {a.highRisk ? (
                                      <Tip tip="High risk: opens or holds something valuable">
                                        <TriangleExclamation className="size-3.5 text-danger" aria-label="High risk" />
                                      </Tip>
                                    ) : null}
                                  </span>
                                  <span className="text-xs text-muted">{a.tag}</span>
                                </span>
                              </span>
                            </Table.Cell>
                            <Table.Cell className="py-2.5">
                              <Person name={a.holder} sub={a.dept} />
                            </Table.Cell>
                            <Table.Cell className="py-2.5 text-[13px]">
                              <span className="flex items-center gap-1">
                                {since}
                                {more.length ? <Hint label={`About ${a.name}`}>{more.join(" · ")}</Hint> : null}
                              </span>
                            </Table.Cell>
                            <Table.Cell className="py-2.5">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <Chip
                                  size="sm"
                                  variant="soft"
                                  color={toneColor(a.statusTone)}
                                  className="whitespace-nowrap"
                                >
                                  {a.status}
                                </Chip>
                                {a.condition === "Damaged" ? (
                                  <Chip size="sm" variant="soft" color="warning" className="whitespace-nowrap">
                                    Damaged
                                  </Chip>
                                ) : null}
                                {a.note && a.condition === "Good" ? (
                                  <Hint label={`Note on ${a.name}`}>{a.note}</Hint>
                                ) : null}
                              </span>
                            </Table.Cell>
                            {returned ? null : (
                              <Table.Cell className="py-2.5 text-right">
                                {a.returnDue ? (
                                  <Dropdown>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      isIconOnly
                                      aria-label={`Record return of ${a.name}`}
                                    >
                                      <Ellipsis className="size-4" aria-hidden="true" />
                                    </Button>
                                    <Dropdown.Popover placement="bottom end" className="min-w-[180px]">
                                      <Dropdown.Menu
                                        aria-label={`Return of ${a.name}`}
                                        onAction={(k) => recordReturn(a, String(k) as ReturnCondition)}
                                      >
                                        <Dropdown.Item id="good" textValue="Back in good condition">
                                          <CircleCheck className="size-4 text-success" />
                                          <Label>Back, good condition</Label>
                                        </Dropdown.Item>
                                        <Dropdown.Item id="damaged" textValue="Back damaged">
                                          <TriangleExclamation className="size-4 text-warning" />
                                          <Label>Back, damaged</Label>
                                        </Dropdown.Item>
                                        <Dropdown.Item id="lost" textValue="Lost">
                                          <Xmark className="size-4 text-danger" />
                                          <Label>Lost</Label>
                                        </Dropdown.Item>
                                      </Dropdown.Menu>
                                    </Dropdown.Popover>
                                  </Dropdown>
                                ) : null}
                              </Table.Cell>
                            )}
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
              <Pager at={assetsShown.at} total={shownAssets.length} onPage={setAssetPage} />
            </section>
          </Tabs.Panel>
        ) : null}

        {newsOn ? (
          <Tabs.Panel id="news" className="flex flex-col gap-3 pt-4">
            <section className="flex flex-col gap-2.5" aria-labelledby="an-h">
              <h2 id="an-h" className="flex items-center gap-2 text-[15px] leading-[22px] font-semibold">
                Announcements
                <Button size="sm" variant="secondary" onPress={() => setPostOpen(true)}>
                  <Plus className="size-4" />
                  Post
                </Button>
              </h2>
              {announcements.length === 0 ? (
                <Card className="p-4">
                  <EmptyState size="sm" className="py-6">
                    <EmptyState.Header>
                      <EmptyState.Media variant="icon">
                        <Megaphone />
                      </EmptyState.Media>
                      <EmptyState.Title>Nothing posted yet</EmptyState.Title>
                    </EmptyState.Header>
                  </EmptyState>
                </Card>
              ) : (
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content aria-label="Announcements" className="min-w-[560px]">
                      <Table.Header>
                        <Table.Column isRowHeader>Title</Table.Column>
                        <Table.Column>For</Table.Column>
                        <Table.Column>Posted</Table.Column>
                        <Table.Column>Status</Table.Column>
                        <Table.Column className="w-[52px] text-right">
                          <span className="sr-only">Actions</span>
                        </Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {newsShown.rows.map((a) => (
                          <Table.Row key={a.id} id={a.id}>
                            <Table.Cell className="py-2.5 font-medium">{a.title}</Table.Cell>
                            <Table.Cell className="max-w-[240px] truncate py-2.5 text-[13px]">{a.audience}</Table.Cell>
                            <Table.Cell className="py-2.5 text-[13px] whitespace-nowrap">
                              {a.posted}
                              {a.until ? <span className="text-muted"> to {a.until}</span> : null}
                            </Table.Cell>
                            <Table.Cell className="py-2.5">
                              <Chip size="sm" variant="soft" color={ANNOUNCEMENT_STATE[a.status].tone}>
                                {ANNOUNCEMENT_STATE[a.status].label}
                              </Chip>
                            </Table.Cell>
                            <Table.Cell className="py-2.5 text-right">
                              <Dropdown>
                                <Button size="sm" variant="ghost" isIconOnly aria-label={`Actions for ${a.title}`}>
                                  <Ellipsis className="size-4" aria-hidden="true" />
                                </Button>
                                <Dropdown.Popover placement="bottom end" className="min-w-[160px]">
                                  <Dropdown.Menu
                                    aria-label={`Actions for ${a.title}`}
                                    onAction={(k) => {
                                      if (k === "read") {
                                        setReadId(a.id);
                                        setReadOpen(true);
                                      } else setShown(a, k === "up");
                                    }}
                                  >
                                    <Dropdown.Item id="read" textValue="Read">
                                      <Label>Read</Label>
                                    </Dropdown.Item>
                                    {a.status === "down" ? (
                                      <Dropdown.Item id="up" textValue="Put back up">
                                        <Label>Put back up</Label>
                                      </Dropdown.Item>
                                    ) : (
                                      <Dropdown.Item id="down" textValue="Take down">
                                        <Label>Take down</Label>
                                      </Dropdown.Item>
                                    )}
                                  </Dropdown.Menu>
                                </Dropdown.Popover>
                              </Dropdown>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              )}
              <Pager at={newsShown.at} total={announcements.length} onPage={setNewsPage} />
            </section>
          </Tabs.Panel>
        ) : null}

        <Tabs.Panel id="reports" className="flex flex-col gap-3 pt-4">
          <PanelCard id="rp-h" title={<span className="flex items-center gap-1">HR reports</span>} className="gap-2">
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))]">
              {REPORTS.map((r) => (
                <Card key={r.id} variant="secondary" className="gap-2.5 p-3">
                  <span className="flex items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground">
                      <Icon name={r.icon} className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[13px] font-semibold">{r.title}</span>
                      <span className="text-xs text-muted">{r.detail}</span>
                    </span>
                  </span>
                  <LinkButton
                    href={`${screenHref("HrReport")}?tab=${r.tab}`}
                    size="sm"
                    variant="secondary"
                    className="self-start"
                  >
                    Open
                    <ChevronRight className="size-3.5" />
                  </LinkButton>
                </Card>
              ))}
            </div>
          </PanelCard>
        </Tabs.Panel>
      </Tabs>

      {/* The ticket */}
      <Drawer.Backdrop isOpen={ticketOpen && !!cur} onOpenChange={setTicketOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="tk-h" className="w-full max-w-[460px]">
            <Drawer.CloseTrigger aria-label="Close" />
            {cur ? (
              <>
                <Drawer.Header>
                  <div className="flex items-start gap-3 pe-8">
                    <Avatar variant="soft" color={avatarColor(cur.who)}>
                      <Avatar.Fallback>{initials(cur.who)}</Avatar.Fallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Drawer.Heading id="tk-h" className="text-base leading-[22px] font-semibold">
                        {cur.title}
                      </Drawer.Heading>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        {cur.who}
                        <Chip size="sm" variant="soft" color={toneColor(cur.stateTone)}>
                          {cur.state}
                        </Chip>
                      </span>
                    </div>
                  </div>
                </Drawer.Header>
                <Drawer.Body className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2.5" aria-label={`Conversation with ${cur.who}`} role="log">
                    {thread.map((m) => (
                      <Message key={m.key} message={m} />
                    ))}
                  </div>
                  {cur.isResolved ? (
                    <Alert status="success">
                      <Alert.Indicator>
                        <CircleCheck />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>Resolved</Alert.Title>
                        <Alert.Description>{firstName} reopens it by writing from Me.</Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : (
                    <TextField fullWidth value={draft} onChange={setDraft}>
                      <Label className="sr-only">Reply to {firstName}</Label>
                      <TextArea variant="secondary" rows={3} placeholder={`Reply to ${firstName}`} />
                    </TextField>
                  )}
                </Drawer.Body>
                {cur.isResolved ? null : (
                  <Drawer.Footer className="flex flex-wrap items-center gap-2 border-t border-separator">
                    {cur.link ? (
                      <LinkButton href={screenHref(cur.link.board)} size="sm" variant="ghost">
                        {cur.link.label}
                      </LinkButton>
                    ) : null}
                    <span className="flex-1" />
                    <Button variant="secondary" isPending={pending} onPress={() => send(true)}>
                      <CircleCheck className="size-4" aria-hidden="true" />
                      {draft.trim() ? "Send and resolve" : "Resolve"}
                    </Button>
                    <Button isPending={pending} onPress={() => send(false)} isDisabled={!draft.trim()}>
                      <PaperPlane className="size-4" aria-hidden="true" />
                      Send
                    </Button>
                  </Drawer.Footer>
                )}
              </>
            ) : null}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      <Drawer.Backdrop isOpen={lendOpen} onOpenChange={setLendOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="lend-h" className="w-full max-w-[460px]">
            <Drawer.CloseTrigger aria-label="Close" />
            <Drawer.Header>
              <Drawer.Heading id="lend-h" className="text-[18px] leading-6 font-semibold">
                Lend an item
              </Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-3">
              <NativeSelect fullWidth className="flex flex-col gap-1">
                <Label htmlFor="lend-who">To</Label>
                <NativeSelect.Trigger
                  id="lend-who"
                  value={lend.employeeId}
                  onChange={(e) => setLend((x) => ({ ...x, employeeId: e.target.value }))}
                >
                  <NativeSelect.Option value="">Choose a person</NativeSelect.Option>
                  {people.map((p) => (
                    <NativeSelect.Option key={p.id} value={p.id}>
                      {p.name} · {p.title}
                    </NativeSelect.Option>
                  ))}
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
              <div className="grid grid-cols-2 gap-3">
                <NativeSelect fullWidth className="flex flex-col gap-1">
                  <Label htmlFor="lend-kind">Kind</Label>
                  <NativeSelect.Trigger
                    id="lend-kind"
                    value={lend.kind}
                    onChange={(e) => setLend((x) => ({ ...x, kind: e.target.value }))}
                  >
                    {KINDS.map((k) => (
                      <NativeSelect.Option key={k.id} value={k.id}>
                        {k.label}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
                <TextField
                  value={lend.tag}
                  onChange={(v) => setLend((x) => ({ ...x, tag: v }))}
                  className="flex flex-col gap-1"
                >
                  <Label>Number or serial</Label>
                  <Input placeholder="K-207" />
                </TextField>
              </div>
              <TextField
                value={lend.name}
                onChange={(v) => setLend((x) => ({ ...x, name: v }))}
                className="flex flex-col gap-1"
              >
                <Label>Item</Label>
                <Input placeholder="Floor 2 master key card" />
              </TextField>
              <TextField
                value={lend.dueBackOn}
                onChange={(v) => setLend((x) => ({ ...x, dueBackOn: v }))}
                className="flex flex-col gap-1"
              >
                <Label>Back by (optional)</Label>
                <Input type="date" min={today} />
              </TextField>
              <TextField
                value={lend.note}
                onChange={(v) => setLend((x) => ({ ...x, note: v }))}
                className="flex flex-col gap-1"
              >
                <Label>Note (optional)</Label>
                <TextArea rows={2} />
              </TextField>
            </Drawer.Body>
            <Drawer.Footer className="border-t border-separator">
              <Button variant="ghost" onPress={() => setLendOpen(false)}>
                Cancel
              </Button>
              <Button
                isPending={pending}
                isDisabled={!lend.employeeId || lend.name.trim().length < 2}
                onPress={saveLend}
              >
                Lend it
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      {/* Post an announcement */}
      <Drawer.Backdrop isOpen={postOpen} onOpenChange={setPostOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="post-h" className="w-full max-w-[460px]">
            <Drawer.CloseTrigger aria-label="Close" />
            <Drawer.Header>
              <Drawer.Heading id="post-h" className="text-[18px] leading-6 font-semibold">
                Post an announcement
              </Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-3">
              <TextField
                value={post.title}
                onChange={(v) => setPost((x) => ({ ...x, title: v }))}
                className="flex flex-col gap-1"
              >
                <Label>Title</Label>
                <Input placeholder="Fire drill on Thursday at 10:00" />
              </TextField>
              <TextField
                value={post.body}
                onChange={(v) => setPost((x) => ({ ...x, body: v }))}
                className="flex flex-col gap-1"
              >
                <Label>Message</Label>
                <TextArea rows={5} />
              </TextField>
              <NativeSelect fullWidth className="flex flex-col gap-1">
                <Label htmlFor="post-who">For</Label>
                <NativeSelect.Trigger
                  id="post-who"
                  value={post.who}
                  onChange={(e) => setPost((x) => ({ ...x, who: e.target.value as AnnouncementFor, targetId: "" }))}
                >
                  <NativeSelect.Option value="all">Everyone</NativeSelect.Option>
                  {data.audience.departments.length ? (
                    <NativeSelect.Option value="department">One department</NativeSelect.Option>
                  ) : null}
                  {data.audience.positions.length ? (
                    <NativeSelect.Option value="position">One job</NativeSelect.Option>
                  ) : null}
                  {people.length ? <NativeSelect.Option value="person">One person</NativeSelect.Option> : null}
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
              {post.who === "all" ? null : (
                <NativeSelect fullWidth className="flex flex-col gap-1">
                  <Label htmlFor="post-target">
                    {post.who === "department" ? "Department" : post.who === "position" ? "Job" : "Person"}
                  </Label>
                  <NativeSelect.Trigger
                    id="post-target"
                    value={post.targetId}
                    onChange={(e) => setPost((x) => ({ ...x, targetId: e.target.value }))}
                  >
                    <NativeSelect.Option value="">Choose</NativeSelect.Option>
                    {targets.map((t) => (
                      <NativeSelect.Option key={t.id} value={t.id}>
                        {t.name}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              )}
              <TextField
                value={post.expiresOn}
                onChange={(v) => setPost((x) => ({ ...x, expiresOn: v }))}
                className="flex flex-col gap-1"
              >
                <Label>Show until (optional)</Label>
                <Input type="date" min={today} />
              </TextField>
            </Drawer.Body>
            <Drawer.Footer className="border-t border-separator">
              <Button variant="ghost" onPress={() => setPostOpen(false)}>
                Cancel
              </Button>
              <Button
                isPending={pending}
                isDisabled={post.title.trim().length < 2 || !post.body.trim() || (post.who !== "all" && !post.targetId)}
                onPress={savePost}
              >
                Post it
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      {/* Read an announcement */}
      <Drawer.Backdrop isOpen={readOpen && !!reading} onOpenChange={setReadOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="read-h" className="w-full max-w-[460px]">
            <Drawer.CloseTrigger aria-label="Close" />
            {reading ? (
              <>
                <Drawer.Header>
                  <Drawer.Heading id="read-h" className="pe-8 text-[18px] leading-6 font-semibold">
                    {reading.title}
                  </Drawer.Heading>
                  <span className="text-xs text-muted">
                    {reading.audience} · {reading.posted}
                    {reading.until ? ` to ${reading.until}` : ""}
                  </span>
                </Drawer.Header>
                <Drawer.Body>
                  <p className="text-sm leading-5 whitespace-pre-line">{reading.body}</p>
                </Drawer.Body>
              </>
            ) : null}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
