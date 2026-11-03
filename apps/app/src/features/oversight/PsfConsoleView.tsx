"use client";

import {
  ArrowDownToLine,
  CircleCheck,
  CircleCheckFill,
  CircleInfo,
  CircleXmark,
  Envelope,
  Eye,
  FileText,
  Medal,
  PaperPlane,
  Tray,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Description,
  Input,
  Label,
  ListBox,
  SearchField,
  Select,
  Tabs,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { EmptyState, ItemCard, ListView, RadioButtonGroup, Timeline } from "@heroui-pro/react";
import type { Persona } from "@injishi/data";
import type {
  ApplicationStatus,
  ChamberMember,
  EventStatus,
  FeeState,
  MembershipApplication,
  Tone,
} from "@injishi/data/fixtures/oversight";
import { KeyValueList, PageContent, PageHeader } from "@injishi/ui";
import { type Key, useState } from "react";
import { CardHeading, firstKey, InlineTitle, LINE_LIST, LINE_TAB, TabCount, ToneChip } from "./shared";

const STATUS: Record<ApplicationStatus, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "default" },
  review: { label: "Under review", tone: "accent" },
  info: { label: "Information requested", tone: "warning" },
  approved: { label: "Approved by Chamber", tone: "success" },
  rejected: { label: "Rejected by Chamber", tone: "danger" },
};

const FEE: Record<FeeState, { label: string; tone: Tone }> = {
  verified: { label: "Verified", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  unknown: { label: "Unknown", tone: "warning" },
  none: { label: "Not linked", tone: "default" },
};

const TABS: { id: string; label: string; match: (s: ApplicationStatus) => boolean }[] = [
  { id: "open", label: "Open", match: (s) => s === "new" || s === "review" || s === "info" },
  { id: "new", label: "New", match: (s) => s === "new" },
  { id: "review", label: "Under review", match: (s) => s === "review" },
  { id: "info", label: "Information requested", match: (s) => s === "info" },
  { id: "decided", label: "Decided", match: (s) => s === "approved" || s === "rejected" },
];

const REASONS = [
  "Does not meet the category criteria",
  "Documents are incomplete or not readable",
  "Not eligible for this membership category",
];

type Choice = "approve" | "info" | "reject";

function statusOf(app: MembershipApplication, over: Record<string, ApplicationStatus>): ApplicationStatus {
  return over[app.id] ?? app.status;
}

function documentsOf(a: MembershipApplication) {
  const tourism = a.licenceExempt
    ? {
        name: "Tourism licence",
        meta: a.category.startsWith("Residence")
          ? "Not required for the residence category"
          : "Tour operator licence uploaded instead",
        state: "Not required",
        tone: "default" as const,
        viewable: false,
      }
    : a.missingLicence
      ? {
          name: "Tourism licences",
          meta: `1 of 2 establishments · missing: ${a.missingLicence}`,
          state: "Incomplete",
          tone: "warning" as const,
          viewable: true,
        }
      : {
          name: "Tourism licence",
          meta: "PDF · 2 pages",
          state: "Received",
          tone: "default" as const,
          viewable: true,
        };
  return [
    {
      name: "RDB registration certificate",
      meta: `PDF · 2 pages · uploaded ${a.submitted}`,
      state: "Received",
      tone: "default" as const,
      viewable: true,
    },
    {
      name: "TIN certificate",
      meta: `PDF · 1 page · TIN ${a.tin}`,
      state: "Received",
      tone: "default" as const,
      viewable: true,
    },
    tourism,
    {
      name: "Signed application form",
      meta: `Signed in Injishi by ${a.contact}`,
      state: "Received",
      tone: "default" as const,
      viewable: true,
    },
  ];
}

function infoAsk(a: MembershipApplication) {
  return a.missingLicence
    ? `Please upload the ${a.missingLicence.toLowerCase()}, which is listed on your application.`
    : "Please upload a current photo of the establishment entrance showing its name, and confirm the number of rooms.";
}

/** Membership applications for the Chamber of Tourism, decided here and sent to the business. */
export function PsfConsoleView({
  persona,
  applications,
  members,
}: {
  persona: Persona;
  applications: MembershipApplication[];
  members: ChamberMember[];
}) {
  const [tab, setTab] = useState("open");
  const [sel, setSel] = useState(applications[0]?.id ?? "");
  const [choice, setChoice] = useState<Choice>("approve");
  const [over, setOver] = useState<Record<string, ApplicationStatus>>({});
  const [query, setQuery] = useState("Gisenyi");
  const [memberNo, setMemberNo] = useState(applications[0]?.memberNo ?? "");
  const [validUntil, setValidUntil] = useState("31 December 2027");
  const [ask, setAsk] = useState(applications[0] ? infoAsk(applications[0]) : "");
  const [rejectReason, setRejectReason] = useState(REASONS[0]);
  const [rejectNote, setRejectNote] = useState("");

  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  const rows = applications.filter((a) => current.match(statusOf(a, over)));
  const app = applications.find((a) => a.id === sel) ?? applications[0];

  const pick = (id: string) => {
    const next = applications.find((a) => a.id === id);
    setSel(id);
    setChoice("approve");
    if (next) {
      setMemberNo(next.memberNo);
      setValidUntil("31 December 2027");
      setAsk(infoAsk(next));
      setRejectNote("");
    }
  };

  const selectTab = (id: string) => {
    const def = TABS.find((t) => t.id === id) ?? TABS[0];
    const inTab = applications.filter((a) => def.match(statusOf(a, over)));
    const keep = inTab.some((a) => a.id === sel);
    setTab(id);
    if (!keep && inTab[0]) pick(inTab[0].id);
    else setChoice("approve");
  };

  const q = query.toLowerCase().replace(/\s/g, "");
  const lookup = (q ? members.filter((m) => (m.name + m.tin).toLowerCase().replace(/\s/g, "").includes(q)) : members)
    .slice(0, q ? 3 : 2)
    .map((m) => {
      if (m.application === "APP-0318") {
        const linked = applications.find((a) => a.id === m.application);
        if (linked)
          return { ...m, status: STATUS[statusOf(linked, over)].label, tone: STATUS[statusOf(linked, over)].tone };
      }
      return m;
    });

  return (
    <PageContent className="text-[14px] leading-5">
      <PageHeader
        eyebrow="Private Sector Federation · Chamber of Tourism"
        title="Membership Applications"
        actions={
          <Button
            variant="secondary"
            onPress={() =>
              toast.success(
                `CSV of ${applications.length} applications prepared · statuses and fee states only, no documents`,
                { indicator: <PaperPlane className="size-4" /> },
              )
            }
          >
            <ArrowDownToLine className="size-4" />
            Export list
          </Button>
        }
      />

      <Alert>
        <Alert.Indicator>
          <CircleInfo />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>Injishi does not approve memberships</Alert.Title>
          <Alert.Description>
            Each decision here is the Chamber’s. The business sees “Decided by Chamber of Tourism” with the date, and
            can tell submitted, under review and decided apart.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => selectTab(String(k))}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Application status" className={LINE_LIST}>
            {TABS.map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className={LINE_TAB}>
                {t.label}
                <TabCount>{applications.filter((a) => t.match(statusOf(a, over))).length}</TabCount>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {TABS.map((t) => (
          <Tabs.Panel key={t.id} id={t.id} className="pt-4">
            {t.id === tab && app ? (
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
                  {rows.length ? (
                    <ListView
                      aria-label="Applications"
                      items={rows}
                      selectionMode="single"
                      selectionBehavior="replace"
                      selectedKeys={rows.some((r) => r.id === sel) ? new Set([sel]) : new Set()}
                      onSelectionChange={(keys) => {
                        const id = firstKey(keys as "all" | Set<Key>);
                        if (id) pick(id);
                      }}
                    >
                      {(r) => {
                        const s = STATUS[statusOf(r, over)];
                        const fee = FEE[r.fee];
                        return (
                          <ListView.Item
                            id={r.id}
                            textValue={r.business}
                            className="data-[selected=true]:bg-default data-[selected=true]:shadow-[inset_3px_0_0_var(--accent)]"
                          >
                            <ListView.ItemContent>
                              <Avatar size="sm" variant="soft" color="accent" className="shrink-0">
                                <Avatar.Fallback>{r.initials}</Avatar.Fallback>
                              </Avatar>
                              <div className="flex min-w-0 flex-col">
                                <ListView.Title className="whitespace-normal">{r.business}</ListView.Title>
                                <ListView.Description className="whitespace-normal">
                                  {r.id} · {r.category} · {r.submitted}
                                </ListView.Description>
                              </div>
                            </ListView.ItemContent>
                            <ListView.ItemAction>
                              <span className="flex flex-col items-end gap-1">
                                <ToneChip tone={s.tone}>{s.label}</ToneChip>
                                <span className="text-[11px] leading-4 text-muted">Fee · {fee.label}</span>
                              </span>
                            </ListView.ItemAction>
                          </ListView.Item>
                        );
                      }}
                    </ListView>
                  ) : (
                    <Card variant="secondary" className="p-6">
                      <EmptyState size="sm">
                        <EmptyState.Header>
                          <EmptyState.Media variant="icon">
                            <Tray />
                          </EmptyState.Media>
                          <EmptyState.Title>Nothing in this status</EmptyState.Title>
                          <EmptyState.Description>
                            Applications appear here as businesses submit them or as decisions are recorded.
                          </EmptyState.Description>
                        </EmptyState.Header>
                      </EmptyState>
                    </Card>
                  )}

                  <Card render={(p) => <section {...p} />} aria-labelledby="lk-h" className="gap-3 p-[18px]">
                    <Card.Header>
                      <CardHeading id="lk-h">Member Lookup</CardHeading>
                      <Card.Description>
                        Status from the Chamber’s own register as recorded in Injishi · last synced by upload 1 Oct
                      </Card.Description>
                    </Card.Header>
                    <SearchField aria-label="Business name or TIN" value={query} onChange={setQuery} fullWidth>
                      <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder="Business name or TIN" />
                        <SearchField.ClearButton />
                      </SearchField.Group>
                    </SearchField>
                    {lookup.length ? (
                      <ListView aria-labelledby="lk-h" variant="secondary" items={lookup}>
                        {(m) => (
                          <ListView.Item id={m.id} textValue={m.name}>
                            <ListView.ItemContent>
                              <Medal className="size-4 shrink-0 text-muted" aria-hidden="true" />
                              <div className="flex min-w-0 flex-col">
                                <ListView.Title className="whitespace-normal">{m.name}</ListView.Title>
                                <ListView.Description className="tabular">
                                  TIN {m.tin} · {m.detail}
                                </ListView.Description>
                              </div>
                            </ListView.ItemContent>
                            <ListView.ItemAction>
                              <ToneChip tone={m.tone}>{m.status}</ToneChip>
                            </ListView.ItemAction>
                          </ListView.Item>
                        )}
                      </ListView>
                    ) : (
                      <p className="text-[13px] text-muted">
                        No member or application matches. That does not mean the business is not a member elsewhere;
                        check the Chamber’s register.
                      </p>
                    )}
                  </Card>
                </div>

                <ApplicationDetail
                  persona={persona}
                  app={app}
                  status={statusOf(app, over)}
                  fresh={over[app.id] != null}
                  choice={choice}
                  onChoice={setChoice}
                  memberNo={memberNo}
                  onMemberNo={setMemberNo}
                  validUntil={validUntil}
                  onValidUntil={setValidUntil}
                  ask={ask}
                  onAsk={setAsk}
                  rejectReason={rejectReason}
                  onRejectReason={setRejectReason}
                  rejectNote={rejectNote}
                  onRejectNote={setRejectNote}
                  onStart={() => {
                    setOver((s) => ({ ...s, [app.id]: "review" }));
                    toast.success(`${app.business} now sees “Under review”`, {
                      indicator: <PaperPlane className="size-4" />,
                    });
                  }}
                  onRecord={(next) => {
                    setOver((s) => ({ ...s, [app.id]: next }));
                    toast.success(`Decision event sent to ${app.business}`, {
                      indicator: <PaperPlane className="size-4" />,
                    });
                  }}
                />
              </div>
            ) : null}
          </Tabs.Panel>
        ))}
      </Tabs>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}

function ApplicationDetail({
  persona,
  app,
  status,
  fresh,
  choice,
  onChoice,
  memberNo,
  onMemberNo,
  validUntil,
  onValidUntil,
  ask,
  onAsk,
  rejectReason,
  onRejectReason,
  rejectNote,
  onRejectNote,
  onStart,
  onRecord,
}: {
  persona: Persona;
  app: MembershipApplication;
  status: ApplicationStatus;
  fresh: boolean;
  choice: Choice;
  onChoice: (c: Choice) => void;
  memberNo: string;
  onMemberNo: (v: string) => void;
  validUntil: string;
  onValidUntil: (v: string) => void;
  ask: string;
  onAsk: (v: string) => void;
  rejectReason: string;
  onRejectReason: (v: string) => void;
  rejectNote: string;
  onRejectNote: (v: string) => void;
  onStart: () => void;
  onRecord: (next: ApplicationStatus) => void;
}) {
  const chip = STATUS[status];
  const fee = FEE[app.fee];
  const docs = documentsOf(app);
  const number = memberNo || app.memberNo;
  const events: { id: string; status: EventStatus; title: string; detail: string }[] = [
    {
      id: "received",
      status: "success",
      title: "Application received",
      detail: `${app.submitted} · Injishi and email to ${app.contact}`,
    },
  ];
  if (status !== "new") {
    events.push({
      id: "review",
      status: status === "review" ? "current" : "success",
      title: "Under review by the Chamber",
      detail: `${app.since ?? "Today"} · Injishi`,
    });
  }
  if (status === "info") {
    events.push({
      id: "info",
      status: "warning",
      title: "Information requested by the Chamber",
      detail: `${fresh ? "Just now" : "4 Oct"} · response due ${fresh ? "24 Oct" : "17 Oct"}`,
    });
  }
  if (status === "approved") {
    events.push({
      id: "approved",
      status: "success",
      title: `Approved by Chamber of Tourism · ${number}`,
      detail: `${fresh ? "Just now" : app.decidedOn} · Injishi and email`,
    });
  }
  if (status === "rejected") {
    events.push({
      id: "rejected",
      status: "danger",
      title: "Rejected by Chamber of Tourism · with reason",
      detail: `${fresh ? "Just now" : app.decidedOn} · Injishi and email`,
    });
  }
  if (status === "new" || status === "review") {
    events.push({ id: "pending", status: "default", title: "Decision", detail: "Sent when you record it" });
  }

  const decided =
    status === "approved"
      ? {
          status: "success" as const,
          icon: CircleCheck,
          title: `Approved by the Chamber · ${number}`,
          description: `Recorded under ${persona.name}. The business now shows Chamber of Tourism membership with this number.`,
        }
      : status === "rejected"
        ? {
            status: "danger" as const,
            icon: CircleXmark,
            title: "Rejected by the Chamber",
            description:
              "The business received the reason. They can submit a new application; this one stays on record.",
          }
        : status === "info"
          ? {
              status: "warning" as const,
              icon: Envelope,
              title: "Waiting for the business",
              description: "The application is paused until they reply. You can decide once the documents arrive.",
            }
          : null;

  const recordLabel = { approve: "Record approval", info: "Send information request", reject: "Record rejection" }[
    choice
  ];
  const target = { approve: "approved", info: "info", reject: "rejected" }[choice] as ApplicationStatus;

  return (
    <Card render={(p) => <section {...p} />} aria-labelledby="app-h" className="min-w-0 flex-[999_1_640px] gap-4 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 flex-[1_1_300px] flex-col">
          <p className="text-[13px] leading-[18px] font-medium text-muted tabular">
            {app.id} · submitted {app.submitted} · TIN {app.tin}
          </p>
          <h2 id="app-h" className="text-[20px] leading-7 font-semibold">
            {app.business}
          </h2>
        </div>
        <ToneChip tone={chip.tone}>{chip.label}</ToneChip>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-[14px]">
          <KeyValueList
            items={[
              { label: "Category", value: app.category },
              { label: "Establishments", value: app.establishments },
              { label: "Location", value: app.place },
              { label: "Submitted by", value: app.contact },
            ]}
          />
          <div className="flex flex-col gap-2">
            <InlineTitle>Documents</InlineTitle>
            {docs.map((d) => (
              <ItemCard key={d.name} variant="secondary" className="min-w-0 items-center px-2.5 py-2">
                <ItemCard.Icon>
                  <FileText className="size-4" />
                </ItemCard.Icon>
                <ItemCard.Content className="min-w-0">
                  <ItemCard.Title className="whitespace-normal">{d.name}</ItemCard.Title>
                  <ItemCard.Description className="whitespace-normal">{d.meta}</ItemCard.Description>
                </ItemCard.Content>
                <ItemCard.Action className="flex items-center gap-1.5">
                  <ToneChip tone={d.tone}>{d.state}</ToneChip>
                  {d.viewable ? (
                    <Button size="sm" variant="ghost" isIconOnly aria-label={`View ${d.name}`}>
                      <Eye className="size-4" />
                    </Button>
                  ) : null}
                </ItemCard.Action>
              </ItemCard>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <InlineTitle>Membership Fee</InlineTitle>
              <ToneChip tone={fee.tone}>{fee.label}</ToneChip>
            </div>
            <p className="text-[13px] leading-[18px]">{app.feeLine}</p>
            <p className="text-[12px] leading-4 text-muted">
              {app.fee === "verified"
                ? "Fee amounts follow the Chamber’s schedule. Injishi only links the payment evidence."
                : "Fee amounts follow the Chamber’s schedule. Only a provider-confirmed payment shows as Verified."}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-[14px]">
          {status === "new" ? (
            <Card variant="secondary" className="gap-2.5 p-3.5">
              <InlineTitle>Not Reviewed Yet</InlineTitle>
              <p className="text-[13px] leading-[18px]">
                Starting the review tells the business their application is now “Under review”. Nothing is decided yet.
              </p>
              <Button fullWidth onPress={onStart}>
                <Eye className="size-4" />
                Start review
              </Button>
            </Card>
          ) : null}

          {status === "review" ? (
            <Card variant="secondary" className="gap-2.5 p-3.5">
              <InlineTitle>Chamber Decision</InlineTitle>
              <RadioButtonGroup
                aria-label="Decision"
                layout="grid"
                value={choice}
                onChange={(v) => onChoice(v === "info" || v === "reject" ? v : "approve")}
                className="grid-cols-3 gap-2"
              >
                {(
                  [
                    ["approve", "Approve"],
                    ["info", "Request info"],
                    ["reject", "Reject"],
                  ] as const
                ).map(([id, label]) => (
                  <RadioButtonGroup.Item key={id} value={id} className="gap-0.5 px-3 py-2.5">
                    <RadioButtonGroup.Indicator>
                      <CircleCheckFill />
                    </RadioButtonGroup.Indicator>
                    <RadioButtonGroup.ItemContent>
                      <Label className="text-[13px] font-semibold">{label}</Label>
                    </RadioButtonGroup.ItemContent>
                  </RadioButtonGroup.Item>
                ))}
              </RadioButtonGroup>

              {choice === "approve" ? (
                <>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <TextField fullWidth value={memberNo} onChange={onMemberNo} className="gap-1">
                      <Label htmlFor="mno">Membership number</Label>
                      <Input id="mno" />
                      <Description>Issued by the Chamber</Description>
                    </TextField>
                    <TextField fullWidth value={validUntil} onChange={onValidUntil} className="gap-1">
                      <Label htmlFor="mto">Valid until</Label>
                      <Input id="mto" />
                    </TextField>
                  </div>
                  {app.fee !== "verified" ? (
                    <p className="flex items-start gap-2 text-[12px] leading-4 text-muted">
                      <CircleInfo className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      <span>
                        The fee is not verified. Injishi does not block your decision; whether to approve before payment
                        is the Chamber’s rule.
                      </span>
                    </p>
                  ) : null}
                </>
              ) : null}

              {choice === "info" ? (
                <TextField fullWidth value={ask} onChange={onAsk} className="gap-1">
                  <Label htmlFor="need">What the business must send</Label>
                  <TextArea id="need" rows={2} />
                  <Description>Response due Saturday 24 Oct · the application pauses until then</Description>
                </TextField>
              ) : null}

              {choice === "reject" ? (
                <>
                  <div className="flex flex-col gap-1">
                    <Label>Reason</Label>
                    <Select
                      aria-label="Rejection reason"
                      fullWidth
                      value={rejectReason}
                      onChange={(key) => key != null && onRejectReason(String(key))}
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {REASONS.map((r) => (
                            <ListBox.Item key={r} id={r} textValue={r}>
                              {r}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                  <TextField fullWidth value={rejectNote} onChange={onRejectNote} className="gap-1">
                    <Label htmlFor="rnote">Explanation for the business</Label>
                    <TextArea id="rnote" rows={2} />
                    <Description>Required for rejections</Description>
                  </TextField>
                </>
              ) : null}

              <Button
                variant={choice === "reject" ? "danger-soft" : "primary"}
                fullWidth
                onPress={() => onRecord(target)}
              >
                {recordLabel}
              </Button>
              <p className="text-[12px] leading-4 text-muted">
                Recorded as Chamber of Tourism · {persona.name} · 12 Oct 2026. Later changes are added as corrections,
                never edits.
              </p>
            </Card>
          ) : null}

          {decided ? (
            <Alert status={decided.status} role="status">
              <Alert.Indicator>
                <decided.icon />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>{decided.title}</Alert.Title>
                <Alert.Description>{decided.description}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-2">
            <InlineTitle>Events Sent to the Business</InlineTitle>
            <Timeline size="sm" density="compact">
              {events.map((ev) => (
                <Timeline.Item key={ev.id} status={ev.status}>
                  <Timeline.Rail>
                    <Timeline.Marker />
                    <Timeline.Connector />
                  </Timeline.Rail>
                  <Timeline.Content className="flex flex-col pb-0.5">
                    <span className="text-[13px] font-medium">{ev.title}</span>
                    <span className="text-[12px] leading-4 text-muted">{ev.detail}</span>
                  </Timeline.Content>
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        </div>
      </div>
    </Card>
  );
}
