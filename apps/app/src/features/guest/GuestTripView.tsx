"use client";

import { ArrowRight, Check, CircleCheck, Link as LinkIcon, LinkSlash, PaperPlane } from "@gravity-ui/icons";
import {
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Input,
  Label,
  ProgressBar,
  Tag,
  TagGroup,
  TextField,
} from "@heroui/react";
import { ChatMessage, ItemCard, ListView, PromptInput, Segment } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  ArrivalGuideEntry,
  CancellationTier,
  GuestBooking,
  GuestMessage,
  GuestTrip,
  HotelDepartment,
} from "@injishi/data/fixtures/guest";
import { stock } from "@injishi/data/media";
import {
  formatNumber,
  formatRwf,
  Icon,
  KeyValueList,
  LinkButton,
  PhoneBody,
  Photo,
  SectionHeader,
  StatusDot,
  toneColor,
} from "@injishi/ui";
import { useState } from "react";
import {
  CardHeading,
  cx,
  GuestTop,
  Hint,
  IconTile,
  InitialsAvatar,
  type Lang,
  renderArticle,
  renderSection,
  ScreenHeading,
  useGuestLang,
} from "./parts";

interface GuestTripData {
  trips: GuestTrip[];
  booking: GuestBooking;
  guide: ArrivalGuideEntry[];
  tiers: CancellationTier[];
  departments: HotelDepartment[];
  /** The booking conversation (thread "booking"). */
  messages: GuestMessage[];
}

interface SentMessage {
  id: string;
  text: string;
  meta: string;
}

/** Guest · upcoming trip: the booking, its link to the account, pre-arrival, arrival guide, policy and messages. */
export function GuestTripView({
  persona,
  data,
  claim,
}: {
  persona: Persona;
  data: GuestTripData;
  claim: "linked" | "unclaimed";
}) {
  const { trips, booking, guide, tiers, departments, messages } = data;
  const [lang, setLang] = useGuestLang();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [linkedNow, setLinkedNow] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [to, setTo] = useState(departments[0].id);
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<SentMessage[]>([]);

  const upcoming = trips.filter((t) => t.status === "upcoming");
  const past = trips.filter((t) => t.status === "past");
  const dept = departments.find((d) => d.id === to) ?? departments[0];
  const linked = claim !== "unclaimed" || linkedNow;
  const firstName = persona.firstName;

  const COPY: Record<Lang, { hello: string; sub: string; note: string }> = {
    en: { hello: `Hello, ${firstName}`, sub: `Your stay at ${booking.shortName} starts in 2 days.`, note: "" },
    rw: {
      hello: `Muraho, ${firstName}`,
      sub: "Murakaza neza! Tubategereje ku wa Kabiri, 14 Ukwakira.",
      note: "Hotel guides and messages show in Kinyarwanda where Isangano has translated them.",
    },
    fr: {
      hello: `Bonjour, ${firstName}`,
      sub: `Votre séjour à ${booking.shortName} commence dans 2 jours.`,
      note: "Hotel guides and messages show in French where Isangano has translated them.",
    },
  };
  const t = COPY[lang];

  const linkCode = () => {
    if (code.trim().length < 9) setCodeError(true);
    else {
      setLinkedNow(true);
      setCodeError(false);
    }
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const note = dept.open ? "Sent" : "Sent · they reply when they open";
    setSent((s) => [
      ...s,
      { id: `sent-${s.length + 1}`, text, meta: `You · to ${dept.label} · Mon 12 Oct 10:24 · ${note}` },
    ]);
    setDraft("");
  };

  const thread = [
    ...messages.map((m) => ({ id: m.id, mine: m.kind === "guest", text: m.text, meta: m.meta, initials: m.initials })),
    ...sent.map((m) => ({ ...m, mine: true, initials: null })),
  ];

  return (
    <>
      <GuestTop
        lead={<InitialsAvatar initials={persona.initials} />}
        title={persona.name}
        sub={`Trips · ${upcoming.length} upcoming`}
        lang={lang}
        onLang={setLang}
      />

      <PhoneBody>
        <ScreenHeading title={t.hello} sub={t.sub}>
          {t.note ? (
            <Hint icon="Globe" className="mt-[4px]">
              {t.note}
            </Hint>
          ) : null}
        </ScreenHeading>

        <Segment
          aria-label="Trips"
          selectedKey={tab}
          onSelectionChange={(k) => setTab(k === "past" ? "past" : "upcoming")}
          className="w-full shrink-0"
        >
          <Segment.Item id="upcoming" className="flex-1">
            <Segment.Separator />
            Upcoming · {upcoming.length}
          </Segment.Item>
          <Segment.Item id="past" className="flex-1">
            <Segment.Separator />
            Past · {past.length}
          </Segment.Item>
        </Segment>

        {tab === "upcoming" ? (
          <>
            <Card render={renderSection} aria-labelledby="trip-h" className="shrink-0 gap-0 overflow-hidden p-0">
              <div className="relative h-[132px] shrink-0 bg-surface-secondary">
                <Photo image={stock[booking.photo]} fill sizes="390px" priority />
                <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-[14px] pt-[20px] pb-[10px] text-[12px] leading-4 font-medium text-white">
                  {booking.photoCaption}
                </span>
              </div>
              <div className="flex flex-col gap-[12px] px-[16px] pt-[14px] pb-[16px]">
                <div className="flex items-start justify-between gap-[12px]">
                  <div className="flex min-w-0 flex-col gap-[2px]">
                    <h2 id="trip-h" className="text-[17px] leading-6 font-semibold">
                      {booking.property}
                    </h2>
                    <span className="text-[12px] leading-4 text-muted">{booking.location}</span>
                  </div>
                  <Chip color={toneColor(booking.statusTone)} variant="soft" className="shrink-0">
                    <CircleCheck className="size-3" />
                    <Chip.Label>{booking.status}</Chip.Label>
                  </Chip>
                </div>
                <div className="grid grid-cols-2 gap-[8px]">
                  {[
                    { label: "Check-in", ...booking.checkIn },
                    { label: "Check-out", ...booking.checkOut },
                  ].map((d) => (
                    <Card key={d.label} variant="secondary" className="gap-0 px-[12px] py-[10px]">
                      <span className="text-[12px] leading-4 text-muted">{d.label}</span>
                      <span className="text-[15px] leading-[22px] font-semibold">{d.day}</span>
                      <span className="text-[12px] leading-4 text-muted">{d.time}</span>
                    </Card>
                  ))}
                </div>
                <KeyValueList
                  className="grid-cols-[96px_minmax(0,1fr)]!"
                  items={[
                    { label: "Room", value: booking.room },
                    { label: "Guests", value: booking.guests },
                    { label: "Booking", value: <span className="tabular">{booking.id}</span> },
                    { label: "Room total", value: <span className="tabular">{formatRwf(booking.roomTotal)}</span> },
                  ]}
                />
                <ItemCard variant="secondary">
                  <ItemCard.Icon>
                    <Icon name={booking.deposit.icon} />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title className="tabular">Deposit {formatRwf(booking.deposit.amount)}</ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal tabular">
                      {booking.deposit.method} · ref {booking.deposit.ref} · {booking.deposit.at}
                    </ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <Chip size="sm" variant="soft" color={toneColor(booking.deposit.tone)}>
                      <Check className="size-3" />
                      <Chip.Label>{booking.deposit.status}</Chip.Label>
                    </Chip>
                  </ItemCard.Action>
                </ItemCard>
                <p className="text-[12px] leading-4 text-muted">
                  The other {formatRwf(booking.roomTotal - booking.deposit.amount)} and anything you add during your
                  stay are paid at the hotel. Your bill shows each payment and receipt.
                </p>
              </div>
            </Card>

            <section aria-labelledby="claim-h" className="flex shrink-0 flex-col gap-[8px]">
              <h2 id="claim-h" className="sr-only">
                Booking link
              </h2>
              {linked ? (
                <>
                  <ItemCard>
                    <ItemCard.Icon>
                      <LinkIcon />
                    </ItemCard.Icon>
                    <ItemCard.Content>
                      <ItemCard.Title>Linked to your account</ItemCard.Title>
                      <ItemCard.Description className="whitespace-normal">
                        {linkedNow
                          ? "Linked just now with your stay code"
                          : `Linked on ${booking.linkedOn} with the code from your confirmation email`}
                      </ItemCard.Description>
                    </ItemCard.Content>
                    <ItemCard.Action>
                      <Chip size="sm" variant="soft" color="success">
                        Linked
                      </Chip>
                    </ItemCard.Action>
                  </ItemCard>
                  <Hint icon="CircleInfo" className="px-[4px]">
                    Linking shows this booking in your app. It is not an ID check: the front desk still checks your ID
                    when you arrive.
                  </Hint>
                </>
              ) : (
                <Card className="gap-[10px] p-[16px]">
                  <div className="flex items-start gap-[10px]">
                    <LinkSlash className="mt-[2px] size-4 shrink-0 text-warning" aria-hidden="true" />
                    <div className="flex min-w-0 flex-col gap-[2px]">
                      <span className="font-semibold">This booking isn’t linked to your account yet</span>
                      <span className="text-[12px] leading-4 text-muted">
                        Enter the stay code from your confirmation email, or scan its QR code at the desk.
                      </span>
                    </div>
                  </div>
                  <TextField
                    fullWidth
                    value={code}
                    onChange={(v) => {
                      setCode(v);
                      setCodeError(false);
                    }}
                    isInvalid={codeError}
                    className="flex flex-col gap-[4px]"
                  >
                    <Label>Stay code</Label>
                    <Input placeholder={`For example ${booking.stayCodeExample}`} />
                    <FieldError>That code looks too short. Copy it exactly from your confirmation email.</FieldError>
                    <Description>Only links the booking. It does not prove who you are.</Description>
                  </TextField>
                  <Button fullWidth onPress={linkCode}>
                    <LinkIcon className="size-4" />
                    Link booking
                  </Button>
                </Card>
              )}
            </section>

            <Card render={renderSection} aria-labelledby="pre-h" className="shrink-0 gap-[12px] p-[16px]">
              <div className="flex items-start gap-[12px]">
                <IconTile name="ListCheck" />
                <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                  <CardHeading id="pre-h">Check in before you arrive</CardHeading>
                  <p className="text-[13px] leading-[18px] text-muted">
                    Add your ID, arrival time and preferences now. About 3 minutes, and less waiting at the desk.
                  </p>
                </div>
              </div>
              <ProgressBar
                value={(booking.preArrival.done / booking.preArrival.steps) * 100}
                aria-label="Pre-arrival check-in"
                valueLabel={`${booking.preArrival.done} of ${booking.preArrival.steps} steps`}
                className="flex flex-col gap-[6px]"
              >
                <div className="flex items-center justify-between gap-[12px]">
                  <Label>Pre-arrival check-in</Label>
                  <ProgressBar.Output className="tabular" />
                </div>
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
              <LinkButton href={screenHref("GuestPreArrival")} size="lg" fullWidth>
                Start pre-arrival check-in
                <ArrowRight className="size-4" />
              </LinkButton>
            </Card>

            <section aria-labelledby="guide-h" className="flex shrink-0 flex-col gap-[8px]">
              <SectionHeader
                id="guide-h"
                title="Arrival guide"
                action={<span className="text-[12px] text-muted">From the hotel · updated {booking.guideUpdated}</span>}
                className="items-center"
              />
              <ListView aria-label="Arrival guide" items={guide} className="shrink-0">
                {(g) => (
                  <ListView.Item id={g.id} textValue={g.title} className="items-start">
                    <ListView.ItemContent className="items-start">
                      <Icon name={g.icon} className="mt-[2px] size-4 shrink-0 text-muted" />
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>{g.title}</ListView.Title>
                        <ListView.Description className="leading-4 whitespace-normal">{g.text}</ListView.Description>
                      </div>
                    </ListView.ItemContent>
                  </ListView.Item>
                )}
              </ListView>
            </section>

            <Card render={renderSection} aria-labelledby="pol-h" className="shrink-0 gap-[10px] p-[16px]">
              <Card.Header className="gap-[2px]">
                <CardHeading id="pol-h">Cancellation and Policies</CardHeading>
                <Card.Description>
                  Policy {booking.policy.version}, agreed when you booked on {booking.policy.agreedOn}
                </Card.Description>
              </Card.Header>
              <ol className="m-0 flex list-none flex-col gap-[4px] p-0">
                {tiers.map((tr) => (
                  <li
                    key={tr.id}
                    aria-current={tr.current ? "step" : undefined}
                    className={cx(
                      "flex items-start gap-[10px] rounded-[14px] px-[12px] py-[10px]",
                      tr.current && "bg-surface-secondary",
                    )}
                  >
                    <StatusDot tone={tr.current ? tr.tone : null} className="mt-[6px]" />
                    <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                      <span className="text-[13px] leading-[18px] font-medium">{tr.when}</span>
                      <span className="text-[12px] leading-4 text-muted tabular">{tr.what}</span>
                    </div>
                    <Chip size="sm" variant="soft" color={toneColor(tr.tone)} className="shrink-0">
                      {tr.state}
                    </Chip>
                  </li>
                ))}
              </ol>
              <p className="text-[12px] leading-4 text-muted">
                Any refund goes back to the MTN MoMo number you paid from and shows as pending until MTN confirms it. No
                smoking indoors · quiet hours 22:00–07:00 · children under 6 stay free in your room.
              </p>
            </Card>

            <Card render={renderSection} aria-labelledby="msg-h" className="shrink-0 gap-[12px] p-[16px]">
              <Card.Header className="gap-[2px]">
                <CardHeading id="msg-h">Message the Hotel</CardHeading>
                <Card.Description>
                  Linked to booking {booking.id}. After check-in, the same conversation continues with your stay.
                </Card.Description>
              </Card.Header>
              <div className="flex flex-col gap-[6px]">
                <TagGroup
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={[to]}
                  onSelectionChange={(keys) => {
                    const k = [...keys][0];
                    if (k) setTo(String(k));
                  }}
                  className="flex flex-col gap-[6px]"
                >
                  <Label>Send to</Label>
                  <TagGroup.List className="flex flex-wrap gap-[6px]">
                    {departments.map((d) => (
                      <Tag key={d.id} id={d.id}>
                        {d.label}
                      </Tag>
                    ))}
                  </TagGroup.List>
                </TagGroup>
                <span className="flex items-center gap-[6px] text-[12px] leading-4">
                  <StatusDot tone={dept.open ? "success" : "warning"} />
                  <span className="text-muted">{dept.hours}</span>
                </span>
              </div>
              <div className="flex flex-col gap-[10px]">
                {thread.map((m) =>
                  m.mine ? (
                    <ChatMessage.User key={m.id} className="gap-[3px]">
                      <ChatMessage.Bubble className="max-w-[84%] bg-accent-soft">
                        <ChatMessage.Content>{m.text}</ChatMessage.Content>
                      </ChatMessage.Bubble>
                      <span className="text-[11px] leading-[14px] text-muted">{m.meta}</span>
                    </ChatMessage.User>
                  ) : (
                    <ChatMessage.Assistant key={m.id} className="gap-[8px] p-0">
                      <ChatMessage.Avatar show fallback={m.initials ?? ""} alt={m.meta.split(" · ")[0]} />
                      <ChatMessage.Body className="gap-[3px] pe-[20px]">
                        <ChatMessage.Bubble>
                          <ChatMessage.Content>{m.text}</ChatMessage.Content>
                        </ChatMessage.Bubble>
                        <span className="text-[11px] leading-[14px] text-muted">{m.meta}</span>
                      </ChatMessage.Body>
                    </ChatMessage.Assistant>
                  ),
                )}
              </div>
              <PromptInput size="sm" value={draft} onValueChange={setDraft} onSubmit={send}>
                <PromptInput.Shell>
                  <Label htmlFor="trip-msg" className="sr-only">
                    Message to {dept.label}
                  </Label>
                  <PromptInput.Content>
                    <PromptInput.TextArea id="trip-msg" rows={2} placeholder={`Write to ${dept.label}`} />
                  </PromptInput.Content>
                  <PromptInput.Toolbar>
                    <PromptInput.ToolbarStart>
                      <span className="text-[12px] text-muted">Staff replies only, no automated answers</span>
                    </PromptInput.ToolbarStart>
                    <PromptInput.ToolbarEnd>
                      <PromptInput.Send aria-label="Send message" isDisabled={!draft.trim()}>
                        <PaperPlane className="size-4" />
                      </PromptInput.Send>
                    </PromptInput.ToolbarEnd>
                  </PromptInput.Toolbar>
                </PromptInput.Shell>
              </PromptInput>
            </Card>
          </>
        ) : (
          <section aria-label="Past trips" className="flex shrink-0 flex-col gap-[10px]">
            {past.map((p) => (
              <Card key={p.id} render={renderArticle} className="gap-[10px] px-[16px] py-[14px]">
                <div className="flex items-start gap-[12px]">
                  <Photo image={stock[p.photo]} className="size-[56px] shrink-0 rounded-[14px]" sizes="56px" />
                  <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                    <span className="font-semibold">{p.property}</span>
                    <span className="text-[12px] leading-4 text-muted">{p.summary}</span>
                    <span className="text-[12px] leading-4 text-muted tabular">{p.id}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-[12px]">
                  <Chip size="sm" variant="soft" color={toneColor(p.reviewTone)}>
                    {p.review}
                  </Chip>
                  {p.points ? (
                    <span className="text-[12px] text-muted tabular">+{formatNumber(p.points)} points</span>
                  ) : null}
                </div>
              </Card>
            ))}
            <p className="px-[12px] py-[4px] text-center text-[12px] leading-4 text-muted">
              After you check out of Isangano, your review and loyalty points for this trip appear here.
            </p>
          </section>
        )}
      </PhoneBody>
    </>
  );
}
