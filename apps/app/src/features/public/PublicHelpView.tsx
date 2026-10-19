"use client";

import {
  BookOpen,
  ChevronRight,
  CircleCheck,
  CirclePlay,
  FileArrowDown,
  Lock,
  Magnifier,
  Paperclip,
  PaperPlane,
  ShieldExclamation,
  TriangleExclamation,
  Xmark,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  Description,
  Form,
  Input,
  Label,
  SearchField,
  Table,
  Tabs,
  Tag,
  TagGroup,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { DropZone, EmptyState, ListView, Segment, Stepper, Timeline } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  DataProcessor,
  HelpGuide,
  HelpRole,
  IncidentUpdate,
  PolicyDoc,
  ServiceStatus,
  SupportBusiness,
} from "@injishi/data/fixtures/public";
import { GateChip, Icon, LinkButton, StatusDot, TextLink, toneColor } from "@injishi/ui";
import { type FormEvent, useState, useTransition } from "react";
import { openSupportTicketAction } from "./actions";
import { ChoiceField } from "./fields";
import type { DemoLinks } from "./links";
import { PublicFooter, PublicHeader, PublicMain, type PublicVisitor, SignInAction } from "./PublicChrome";
import { linkTo } from "./shared";

export interface PublicHelpData {
  guides: HelpGuide[];
  services: ServiceStatus[];
  incident: IncidentUpdate[];
  policies: PolicyDoc[];
  processors: DataProcessor[];
  businesses: SupportBusiness[];
}

type Lang = "en" | "rw";

/** Interface copy in English and Kinyarwanda (artifact: EN / RW). Guide titles stay in English. */
const COPY = {
  en: {
    signIn: "Sign in",
    eyebrow: "Help centre",
    hero: "How can we help?",
    searchPh: "Search guides, tutorials and answers",
    popular: "Popular:",
    status: "System status",
    contact: "Contact support",
    contactSub: "A person on the support team reads every ticket.",
    category: "Category",
    business: "Business",
    describe: "Describe the problem",
    attach: "Attachment",
    send: "Send to support",
    privacyTerms: "Privacy notice and terms",
    processors: "Who processes your data",
    guides: "Guides and tutorials",
  },
  rw: {
    signIn: "Injira",
    eyebrow: "Ubufasha",
    hero: "Twagufasha iki?",
    searchPh: "Shakisha amabwiriza n’ibisubizo",
    popular: "Ibikunzwe:",
    status: "Uko serivisi zihagaze",
    contact: "Twandikire",
    contactSub: "Umuntu asoma buri kibazo.",
    category: "Icyiciro",
    business: "Ikigo",
    describe: "Sobanura ikibazo",
    attach: "Umugereka",
    send: "Ohereza",
    privacyTerms: "Politiki y’ibanga n’amategeko",
    processors: "Abatunganya amakuru yawe",
    guides: "Amabwiriza n’amasomo",
  },
} satisfies Record<Lang, Record<string, string>>;

const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "rw", label: "Kinyarwanda" },
];

const ROLES: { id: HelpRole; label: string }[] = [
  { id: "owner", label: "Owners and managers" },
  { id: "desk", label: "Front desk" },
  { id: "housekeeping", label: "Housekeeping" },
  { id: "finance", label: "Finance" },
  { id: "guest", label: "Guests and residents" },
];
const ROLE_NAME = Object.fromEntries(ROLES.map((r) => [r.id, r.label])) as Record<HelpRole, string>;

const PILLS = ["Pending", "Refund", "Fiscal receipt", "Offline"];

const WHO = [
  { id: "biz", label: "I work at a business" },
  { id: "guest", label: "I’m a guest or resident" },
];

const CATEGORIES = [
  { id: "payments", label: "Payments and refunds" },
  { id: "fiscal", label: "Fiscal receipts (EBM)" },
  { id: "bookings", label: "Bookings and channels" },
  { id: "account", label: "Account and sign-in" },
  { id: "privacy", label: "Privacy or data request" },
  { id: "other", label: "Something else" },
];

/** The help form's categories → the support intake's closed topics. */
const TOPIC: Record<string, "booking" | "payment" | "listing" | "other"> = {
  payments: "payment",
  fiscal: "payment",
  bookings: "booking",
};

const DATA_REQUEST =
  "I would like a copy of the personal data you hold about me, and to know which businesses it was shared with.";

/** Public · help and support (artifact: PublicHelp.dc.html) — guides, system status, support and privacy. */
export function PublicHelpView({
  visitor,
  links,
  initialDoc,
  data,
}: {
  visitor: PublicVisitor | null;
  links: DemoLinks;
  initialDoc: PolicyDoc["id"];
  data: PublicHelpData;
}) {
  const [lang, setLang] = useState<Lang>("en");
  const [role, setRole] = useState<HelpRole>("desk");
  const [query, setQuery] = useState("");
  const [docId, setDocId] = useState<PolicyDoc["id"]>(initialDoc);

  const [who, setWho] = useState("biz");
  const [cat, setCat] = useState("payments");
  const [business, setBusiness] = useState(data.businesses[0]?.id ?? "");
  // The form opens a real ticket, so it starts empty: a sample reply address would file someone else's email.
  const [bizReply, setBizReply] = useState("");
  const [place, setPlace] = useState("");
  const [guestReply, setGuestReply] = useState("");
  const [reference, setReference] = useState("");
  const [problem, setProblem] = useState("");
  const [dataRequest, setDataRequest] = useState(DATA_REQUEST);
  const [sent, setSent] = useState(false);
  const [ticket, setTicket] = useState("");
  const [sending, startSending] = useTransition();

  const rw = lang === "rw";
  const t = COPY[lang];
  const q = query.trim().toLowerCase();
  const guides = q
    ? data.guides.filter((g) => g.title.toLowerCase().includes(q) || g.kind.toLowerCase().includes(q))
    : data.guides.filter((g) => g.role === role);
  const guidesTitle = q ? `${guides.length} results for “${query}”` : t.guides;
  const disrupted = data.services.some((s) => s.tone !== "success");

  const privacy = cat === "privacy";
  const catLabel = CATEGORIES.find((c) => c.id === cat)?.label ?? "";
  const businessName = data.businesses.find((b) => b.id === business)?.name;
  const replyTo = who === "biz" ? bizReply : guestReply;
  const ticketLine = `${catLabel}${who === "biz" && businessName ? ` · ${businessName}.` : "."}`;
  const ticketSteps = [
    { id: "received", title: "Received", detail: `Now · ${catLabel}` },
    {
      id: "agent",
      title: "With a support agent",
      detail: "Next · a person on the support team picks it up",
    },
    { id: "waiting", title: "Waiting for you", detail: "Only if we need more information" },
    { id: "resolved", title: "Resolved", detail: "Closed by support once answered" },
  ];

  // The support intake takes text only and no route stores a file for a ticket, so nothing is attached:
  // choosing or dropping a file says so and keeps nothing.
  const addFiles = (list: File[]) => {
    if (!list.length) return;
    toast.warning("Attaching a file is not available yet. Nothing was attached; describe it in your message.");
  };
  const send = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = privacy ? dataRequest : problem;
    const context = [
      `Category: ${catLabel}`,
      who === "biz" && businessName ? `Business: ${businessName}` : null,
      who === "guest" && place.trim() ? `Stayed or booked at: ${place.trim()}` : null,
      !privacy && reference.trim() ? `Reference: ${reference.trim()}` : null,
    ].filter(Boolean);
    startSending(async () => {
      const result = await openSupportTicketAction({
        topic: TOPIC[cat] ?? "other",
        message: `${context.join("\n")}\n\n${body}`,
        email: replyTo,
      });
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      setTicket(result.value.id);
      setSent(true);
    });
  };
  const startPrivacy = () => {
    setCat("privacy");
    setWho("guest");
    setSent(false);
    document.getElementById("contact-h")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div lang={lang} className="flex flex-1 flex-col">
      <PublicHeader
        current="help"
        actions={
          <>
            <Segment aria-label="Language" selectedKey={lang} onSelectionChange={(k) => setLang(k as Lang)}>
              {LANGS.map((l, i) => (
                <Segment.Item key={l.id} id={l.id}>
                  {i > 0 ? <Segment.Separator /> : null}
                  <span lang={l.id}>{l.label}</span>
                </Segment.Item>
              ))}
            </Segment>
            <SignInAction visitor={visitor} label={t.signIn} />
          </>
        }
      />

      <PublicMain className="gap-[28px] sm:pt-[32px]">
        <Card variant="secondary" className="items-start gap-[14px] p-[20px] sm:p-[28px]">
          <div className="flex w-full flex-wrap items-center gap-[10px]">
            <p className="flex-1 text-[13px] leading-[18px] font-medium text-muted">{t.eyebrow}</p>
            {rw ? (
              <Chip size="sm" variant="soft" color="warning">
                Kinyarwanda · translation under review
              </Chip>
            ) : null}
          </div>
          <h1 className="text-[32px] leading-[40px] font-[650] tracking-[-0.02em]">{t.hero}</h1>
          <SearchField aria-label={t.searchPh} value={query} onChange={setQuery} className="w-full max-w-[720px]">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={t.searchPh} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <div className="flex flex-wrap items-center gap-[6px]">
            <span id="popular-l" className="mr-[4px] text-[12px] text-muted">
              {t.popular}
            </span>
            <TagGroup
              aria-labelledby="popular-l"
              size="sm"
              variant="surface"
              selectionMode="single"
              selectedKeys={PILLS.includes(query) ? [query] : []}
              onSelectionChange={(keys) => {
                const [k] = keys === "all" ? [] : [...keys];
                setQuery(k === undefined ? "" : String(k));
              }}
            >
              <TagGroup.List className="flex flex-wrap gap-[6px]">
                {PILLS.map((p) => (
                  <Tag key={p} id={p}>
                    {p}
                  </Tag>
                ))}
              </TagGroup.List>
            </TagGroup>
          </div>
        </Card>

        <div className="flex flex-wrap items-start gap-[24px]">
          <section className="flex min-w-0 flex-[1_1_620px] flex-col gap-[14px]" aria-labelledby="guides-h">
            <div className="flex flex-wrap items-center justify-between gap-[12px]">
              <h2 id="guides-h" className="text-[17px] leading-[22px] font-semibold" aria-live="polite">
                {guidesTitle}
              </h2>
              {q ? (
                <Button variant="ghost" size="sm" onPress={() => setQuery("")}>
                  <Xmark className="size-4" />
                  Clear search
                </Button>
              ) : (
                <Segment aria-label="Role" selectedKey={role} onSelectionChange={(k) => setRole(k as HelpRole)}>
                  {ROLES.map((r, i) => (
                    <Segment.Item key={r.id} id={r.id}>
                      {i > 0 ? <Segment.Separator /> : null}
                      {r.label}
                    </Segment.Item>
                  ))}
                </Segment>
              )}
            </div>
            {guides.length ? (
              <>
                <ListView aria-labelledby="guides-h" variant="secondary" items={guides}>
                  {(g) => (
                    <ListView.Item id={g.id} textValue={g.title} href={linkTo(links, g.board)}>
                      <ListView.ItemContent className="gap-[12px]">
                        <Avatar size="sm" variant="soft">
                          <Avatar.Fallback>
                            {g.kind === "Video tutorial" ? (
                              <CirclePlay className="size-4" aria-hidden="true" />
                            ) : (
                              <BookOpen className="size-4" aria-hidden="true" />
                            )}
                          </Avatar.Fallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-col gap-[2px]">
                          <ListView.Title className="font-medium">{g.title}</ListView.Title>
                          <ListView.Description className="text-[12px]">
                            {g.kind} · {g.length} · {ROLE_NAME[g.role]} · updated {g.updated}
                          </ListView.Description>
                        </div>
                      </ListView.ItemContent>
                      <ListView.ItemAction>
                        <ChevronRight className="size-4 text-muted" aria-hidden="true" />
                      </ListView.ItemAction>
                    </ListView.Item>
                  )}
                </ListView>
                {rw ? (
                  <p className="text-[12px] text-muted">
                    Some guides are only in English for now. Kinyarwanda versions are marked when ready.
                  </p>
                ) : null}
              </>
            ) : (
              <Card variant="secondary">
                <EmptyState size="sm">
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <Magnifier className="size-5" />
                    </EmptyState.Media>
                    <EmptyState.Title>No guides match “{query}”</EmptyState.Title>
                    <EmptyState.Description>
                      Try other words, or send us the question and a person will answer.
                    </EmptyState.Description>
                  </EmptyState.Header>
                  <EmptyState.Content>
                    <Button variant="secondary" size="sm" onPress={() => setQuery("")}>
                      Clear search
                    </Button>
                  </EmptyState.Content>
                </EmptyState>
              </Card>
            )}
          </section>

          <Card
            aria-labelledby="status-h"
            className="min-w-0 flex-[1_1_340px] gap-[12px] p-[18px]"
            render={(p) => <section {...p} />}
          >
            <div className="flex items-center justify-between gap-[12px]">
              <h2 id="status-h" className="text-[15px] leading-[22px] font-semibold">
                {t.status}
              </h2>
              <Chip size="sm" variant="soft" color={disrupted ? "warning" : "success"}>
                {disrupted ? "Partial disruption" : "Operational"}
              </Chip>
            </div>
            <ul className="flex flex-col gap-[8px] text-[13px]">
              {data.services.map((sv) => (
                <li key={sv.id} className="flex items-center gap-[10px]">
                  <StatusDot tone={sv.tone} />
                  <span className="flex-1">{sv.name}</span>
                  <span className="text-[12px] text-muted">{sv.state}</span>
                </li>
              ))}
            </ul>
            <Alert status="warning">
              <Alert.Indicator>
                <TriangleExclamation />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>MTN MoMo confirmations delayed</Alert.Title>
                <Alert.Description>
                  Since 09:20 CAT some confirmations take up to 10 minutes. Payments show Pending until the provider
                  confirms. Please don’t pay twice.
                </Alert.Description>
              </Alert.Content>
            </Alert>
            <Timeline size="sm" density="compact" aria-label="Incident updates">
              {data.incident.map((ic) => (
                <Timeline.Item key={ic.id} status={ic.status}>
                  <Timeline.Rail>
                    <Timeline.Marker />
                    <Timeline.Connector />
                  </Timeline.Rail>
                  <Timeline.Content className="flex flex-col pb-[2px]">
                    <span className="text-[13px] font-medium">{ic.title}</span>
                    <span className="text-[12px] text-muted">{ic.detail}</span>
                  </Timeline.Content>
                </Timeline.Item>
              ))}
            </Timeline>
            <span className="text-[12px] text-muted">Updated 10:41 CAT, Monday 12 October</span>
          </Card>
        </div>

        <div className="flex flex-wrap items-start gap-[24px]">
          <Card
            aria-labelledby="contact-h"
            className="min-w-0 flex-[1_1_560px] gap-[14px] p-[22px]"
            render={(p) => <section {...p} />}
          >
            <Card.Header>
              <h2 id="contact-h" className="scroll-mt-[24px] text-[17px] leading-[24px] font-semibold">
                {t.contact}
              </h2>
              <Card.Description>{t.contactSub}</Card.Description>
            </Card.Header>
            {sent ? (
              <>
                <Alert status="success" role="status">
                  <Alert.Indicator>
                    <CircleCheck />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Ticket {ticket.slice(0, 8).toUpperCase()} created</Alert.Title>
                    <Alert.Description>
                      {ticketLine} A person on the support team reads it. Your reply address is {replyTo}.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
                <Stepper orientation="vertical" size="sm" currentStep={1} aria-label="Ticket progress">
                  {ticketSteps.map((s) => (
                    <Stepper.Step key={s.id}>
                      <Stepper.Indicator />
                      <Stepper.Content>
                        <Stepper.Title>{s.title}</Stepper.Title>
                        <Stepper.Description>{s.detail}</Stepper.Description>
                      </Stepper.Content>
                      <Stepper.Separator />
                    </Stepper.Step>
                  ))}
                </Stepper>
                <div className="flex flex-wrap items-center gap-[8px]">
                  <Button variant="ghost" size="sm" onPress={() => setSent(false)}>
                    Send another
                  </Button>
                </div>
              </>
            ) : (
              <Form aria-labelledby="contact-h" className="flex flex-col gap-[14px]" onSubmit={send}>
                <Segment
                  aria-label="Who are you"
                  selectedKey={who}
                  onSelectionChange={(k) => setWho(String(k))}
                  className="self-start"
                >
                  {WHO.map((w, i) => (
                    <Segment.Item key={w.id} id={w.id}>
                      {i > 0 ? <Segment.Separator /> : null}
                      {w.label}
                    </Segment.Item>
                  ))}
                </Segment>
                <div className="grid gap-[12px] [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
                  <ChoiceField id="c-cat" label={t.category} value={cat} onChange={setCat} options={CATEGORIES} />
                  {who === "biz" ? (
                    <>
                      <ChoiceField
                        id="c-biz"
                        label={t.business}
                        value={business}
                        onChange={setBusiness}
                        options={data.businesses.map((b) => ({ id: b.id, label: `${b.name} · ${b.legalEntity}` }))}
                      />
                      <TextField variant="secondary" value={bizReply} onChange={setBizReply} className="gap-[4px]">
                        <Label>Reply to</Label>
                        <Input type="email" />
                      </TextField>
                    </>
                  ) : (
                    <>
                      <TextField variant="secondary" value={place} onChange={setPlace} className="gap-[4px]">
                        <Label>Where you stayed or booked</Label>
                        <Input />
                      </TextField>
                      <TextField variant="secondary" value={guestReply} onChange={setGuestReply} className="gap-[4px]">
                        <Label>Reply to</Label>
                        <Input type="email" />
                      </TextField>
                    </>
                  )}
                  {privacy ? null : (
                    <TextField variant="secondary" value={reference} onChange={setReference} className="gap-[4px]">
                      <Label>Reference (optional)</Label>
                      <Input />
                      <Description>Booking, payment or receipt number</Description>
                    </TextField>
                  )}
                </div>
                {privacy ? (
                  <TextField variant="secondary" value={dataRequest} onChange={setDataRequest} className="gap-[4px]">
                    <Label>{t.describe}</Label>
                    <TextArea rows={3} />
                    <Description>We confirm your identity before releasing any data.</Description>
                  </TextField>
                ) : (
                  <TextField variant="secondary" value={problem} onChange={setProblem} className="gap-[4px]">
                    <Label>{t.describe}</Label>
                    <TextArea rows={3} />
                    <Description className="inline-flex items-center gap-[6px]">
                      <Lock className="size-3 shrink-0" aria-hidden="true" />
                      Never send PINs, passwords or full card numbers.
                    </Description>
                  </TextField>
                )}
                <DropZone className="flex flex-col gap-[8px]">
                  <Label id="c-attach">{t.attach}</Label>
                  <DropZone.Area
                    aria-labelledby="c-attach"
                    className="p-[16px]"
                    onDrop={async (e) => {
                      const dropped: File[] = [];
                      for (const it of e.items) if (it.kind === "file") dropped.push(await it.getFile());
                      addFiles(dropped);
                    }}
                  >
                    <DropZone.Icon>
                      <Paperclip className="size-6" />
                    </DropZone.Icon>
                    <DropZone.Label>Drop a screenshot or PDF here</DropZone.Label>
                    <DropZone.Description>Not available yet · describe it in your message</DropZone.Description>
                    <DropZone.Trigger>Choose file</DropZone.Trigger>
                  </DropZone.Area>
                  <DropZone.Input
                    accept="image/jpeg,image/png,application/pdf"
                    multiple
                    onSelect={(list) => addFiles([...list])}
                  />
                </DropZone>
                <div className="flex flex-wrap items-center justify-between gap-[10px]">
                  <TextLink href={linkTo(links, "Assistant")} className="text-[13px]">
                    Signed in? Ask the Injishi assistant first
                  </TextLink>
                  <Button type="submit" isDisabled={sending}>
                    <PaperPlane className="size-4" />
                    {t.send}
                  </Button>
                </div>
              </Form>
            )}
          </Card>

          <Card
            id="policies"
            aria-labelledby="priv-h"
            className="min-w-0 flex-[1_1_400px] scroll-mt-[24px] gap-[14px] p-[22px]"
            render={(p) => <section {...p} />}
          >
            <h2 id="priv-h" className="text-[17px] leading-[24px] font-semibold">
              {t.privacyTerms}
            </h2>
            <Tabs variant="secondary" selectedKey={docId} onSelectionChange={(k) => setDocId(k as PolicyDoc["id"])}>
              <Tabs.ListContainer>
                <Tabs.List aria-label="Policies" className="gap-[4px]">
                  {data.policies.map((d) => (
                    <Tabs.Tab key={d.id} id={d.id} className="h-10 w-auto flex-none px-[12px] text-[14px]">
                      {d.label}
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
              {data.policies.map((d) => (
                <Tabs.Panel key={d.id} id={d.id} className="mt-[14px] flex flex-col gap-[14px] p-0">
                  <div className="flex flex-wrap items-center gap-[8px]">
                    <Chip size="sm" variant="soft">
                      {d.version}
                    </Chip>
                    <span className="text-[12px] text-muted">{d.effective}</span>
                  </div>
                  <ul className="flex flex-col gap-[10px]">
                    {d.points.map((pt) => (
                      <li key={pt.title} className="flex gap-[10px] text-[13px] leading-[19px]">
                        <Icon name={pt.icon} className="mt-[3px] size-3.5 shrink-0 text-accent-soft-foreground" />
                        <span>
                          <strong className="font-semibold">{pt.title}</strong> {pt.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Tabs.Panel>
              ))}
            </Tabs>
            <div className="flex flex-wrap items-center gap-[8px]">
              <Button
                variant="secondary"
                size="sm"
                onPress={() => toast.warning("The full text of this document is not available here yet.")}
              >
                <BookOpen className="size-4" />
                Read in full
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onPress={() => toast.warning("Downloading this document is not available yet.")}
              >
                <FileArrowDown className="size-4" />
                PDF
              </Button>
            </div>
            <Card variant="secondary" className="gap-[8px] p-[14px]">
              <span className="text-[13px] font-semibold">Your rights over your data</span>
              <span className="text-[12px] leading-[17px] text-muted">
                Ask to see, correct or delete your personal data, or object to how it is used. Signed-in users can do
                this from their account.
              </span>
              <div className="flex flex-wrap items-center gap-[8px]">
                <Button variant="secondary" size="sm" onPress={startPrivacy}>
                  Make a data request
                </Button>
                <LinkButton href={linkTo(links, "Account")} variant="ghost" size="sm">
                  Manage in your account
                </LinkButton>
              </div>
            </Card>
          </Card>
        </div>

        <section id="processors" className="flex scroll-mt-[24px] flex-col gap-[12px]" aria-labelledby="proc-h">
          <div className="flex flex-wrap items-end gap-x-[16px] gap-y-[8px]">
            <div className="flex min-w-0 flex-[1_1_400px] flex-col gap-[2px]">
              <h2 id="proc-h" className="text-[17px] leading-[22px] font-semibold">
                {t.processors}
              </h2>
              <span className="text-[12px] text-muted">
                Companies that handle personal data on our behalf. Updated 1 Oct 2026; we update this list before a new
                processor starts.
              </span>
            </div>
            <GateChip icon={<ShieldExclamation className="size-3" />}>Several agreements still in negotiation</GateChip>
          </div>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-labelledby="proc-h">
                <Table.Header>
                  <Table.Column isRowHeader>Processor</Table.Column>
                  <Table.Column>What they do for us</Table.Column>
                  <Table.Column>Personal data involved</Table.Column>
                  <Table.Column>Where</Table.Column>
                  <Table.Column>Status</Table.Column>
                </Table.Header>
                <Table.Body>
                  {data.processors.map((pr) => (
                    <Table.Row key={pr.id} id={pr.id}>
                      <Table.Cell className="font-medium">{pr.name}</Table.Cell>
                      <Table.Cell>{pr.purpose}</Table.Cell>
                      <Table.Cell className="text-muted">{pr.data}</Table.Cell>
                      <Table.Cell>{pr.where}</Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={toneColor(pr.tone)}>
                          {pr.status}
                        </Chip>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </section>
      </PublicMain>

      <PublicFooter
        links={[
          { label: "For hosts", href: screenHref("PublicHost") },
          { label: "Join the waitlist", href: `${screenHref("PublicHost")}#waitlist` },
          { label: "Training and certificates", href: screenHref("Training") },
          { label: "Find a stay", href: screenHref("MarketExplore") },
        ]}
      />
      <Toast.Provider placement="bottom" />
    </div>
  );
}
