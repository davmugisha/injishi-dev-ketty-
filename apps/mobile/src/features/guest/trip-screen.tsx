import { screenHref } from "@injishi/data";
import type {
  ArrivalGuideEntry,
  CancellationTier,
  GuestBooking,
  GuestMessage,
  GuestTrip,
  HotelDepartment,
} from "@injishi/data/fixtures/guest";
import { Link, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Input,
  Label,
  ListGroup,
  TextArea,
  TextField,
} from "heroui-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody } from "@/components/phone";
import { useSession } from "@/lib/session";
import { getCollection, getDocument } from "@/lib/store";
import { toneColor } from "@/lib/tone";
import {
  ChoiceChips,
  formatNumber,
  formatRwf,
  GuestTop,
  Hint,
  IconTile,
  InitialsAvatar,
  KeyValue,
  MeterBar,
  PhotoFrame,
  param,
  ScreenHeading,
  SectionTitle,
  Segmented,
  SoftChip,
  StatusDot,
  useGuestLang,
} from "./ui";

interface SentMessage {
  id: string;
  text: string;
  meta: string;
}

/** Guest · upcoming trip (artifact: GuestTrip). `?claim=unclaimed` opens the stay-code form. */
export default function GuestTripScreen() {
  const { persona } = useSession();
  const claim = param(useLocalSearchParams<{ claim?: string }>().claim) === "unclaimed" ? "unclaimed" : "linked";
  const trips = getCollection<GuestTrip>("guest.trips");
  const guide = getCollection<ArrivalGuideEntry>("guest.arrivalGuide");
  const tiers = getCollection<CancellationTier>("guest.cancellationTiers");
  const departments = getCollection<HotelDepartment>("guest.departments");
  const messages = getCollection<GuestMessage>("guest.messages").filter((m) => m.thread === "booking");
  const upcomingTrip = trips.find((t) => t.status === "upcoming");
  const booking = upcomingTrip ? getDocument<GuestBooking>("guest.bookings", upcomingTrip.id) : undefined;

  const [lang, setLang] = useGuestLang();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [linkedNow, setLinkedNow] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [to, setTo] = useState(departments[0]?.id ?? "");
  const [draft, setDraft] = useState("");
  const [sent, setSent] = useState<SentMessage[]>([]);

  if (!persona || !booking || !departments.length) return null;

  const upcoming = trips.filter((t) => t.status === "upcoming");
  const past = trips.filter((t) => t.status === "past");
  const dept = departments.find((d) => d.id === to) ?? departments[0];
  const linked = claim !== "unclaimed" || linkedNow;
  const firstName = persona.firstName;
  const copy = {
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
  }[lang];
  const balance = booking.roomTotal - booking.deposit.amount;
  const thread = [
    ...messages.map((m) => ({ id: m.id, mine: m.kind === "guest", text: m.text, meta: m.meta, initials: m.initials })),
    ...sent.map((m) => ({ ...m, mine: true, initials: null as string | null })),
  ];

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
    setSent((current) => [
      ...current,
      { id: `sent-${current.length + 1}`, text, meta: `You · to ${dept.label} · Mon 12 Oct 10:24 · ${note}` },
    ]);
    setDraft("");
  };

  return (
    <>
      <GuestTop
        lead={<InitialsAvatar initials={persona.initials} label={persona.name} />}
        title={persona.name}
        sub={`Trips · ${upcoming.length} upcoming`}
        lang={lang}
        onLang={setLang}
      />
      <PhoneBody>
        <View className="gap-[14px]">
          <ScreenHeading title={copy.hello} sub={copy.sub}>
            {copy.note ? <Hint icon="Globe">{copy.note}</Hint> : null}
          </ScreenHeading>

          <Segmented
            label="Trips"
            value={tab}
            onChange={(value) => setTab(value === "past" ? "past" : "upcoming")}
            items={[
              { id: "upcoming", label: `Upcoming · ${upcoming.length}` },
              { id: "past", label: `Past · ${past.length}` },
            ]}
          />

          {tab === "upcoming" ? (
            <>
              <Card className="gap-0 overflow-hidden p-0">
                <PhotoFrame image={booking.photo} caption={booking.photoCaption} className="h-[132px] w-full" />
                <View className="gap-3 px-4 pt-3.5 pb-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text accessibilityRole="header" className="text-[17px] leading-6 font-semibold text-foreground">
                        {booking.property}
                      </Text>
                      <Text className="text-xs leading-4 text-muted">{booking.location}</Text>
                    </View>
                    <Chip variant="soft" color={toneColor(booking.statusTone)}>
                      <Icon name="CircleCheck" size={12} />
                      <Chip.Label>{booking.status}</Chip.Label>
                    </Chip>
                  </View>
                  <View className="flex-row gap-2">
                    {[
                      { label: "Check-in", ...booking.checkIn },
                      { label: "Check-out", ...booking.checkOut },
                    ].map((day) => (
                      <Card key={day.label} variant="secondary" className="flex-1 gap-0 px-3 py-2.5">
                        <Text className="text-xs leading-4 text-muted">{day.label}</Text>
                        <Text className="text-[15px] leading-[22px] font-semibold text-foreground">{day.day}</Text>
                        <Text className="text-xs leading-4 text-muted">{day.time}</Text>
                      </Card>
                    ))}
                  </View>
                  <KeyValue
                    items={[
                      { label: "Room", value: booking.room },
                      { label: "Guests", value: booking.guests },
                      { label: "Booking", value: booking.id },
                      { label: "Room total", value: formatRwf(booking.roomTotal) },
                    ]}
                  />
                  <Card variant="secondary" className="flex-row items-start gap-3 p-3">
                    <IconTile name={booking.deposit.icon} />
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text className="text-sm font-semibold text-foreground">
                        Deposit {formatRwf(booking.deposit.amount)}
                      </Text>
                      <Text className="text-xs leading-4 text-muted">
                        {booking.deposit.method} · ref {booking.deposit.ref} · {booking.deposit.at}
                      </Text>
                    </View>
                    <SoftChip label={booking.deposit.status} tone={booking.deposit.tone} icon="Check" />
                  </Card>
                  <Text className="text-xs leading-4 text-muted">
                    The other {formatRwf(balance)} and anything you add during your stay are paid at the hotel. Your
                    bill shows each payment and receipt.
                  </Text>
                </View>
              </Card>

              <View accessibilityLabel="Booking link" className="gap-2">
                {linked ? (
                  <>
                    <Card className="flex-row items-start gap-3 p-3.5">
                      <IconTile name="Link" />
                      <View className="min-w-0 flex-1 gap-0.5">
                        <Text className="text-sm font-semibold text-foreground">Linked to your account</Text>
                        <Text className="text-xs leading-4 text-muted">
                          {linkedNow
                            ? "Linked just now with your stay code"
                            : `Linked on ${booking.linkedOn} with the code from your confirmation email`}
                        </Text>
                      </View>
                      <SoftChip label="Linked" tone="success" />
                    </Card>
                    <Hint icon="CircleInfo">
                      Linking shows this booking in your app. It is not an ID check: the front desk still checks your ID
                      when you arrive.
                    </Hint>
                  </>
                ) : (
                  <Card className="gap-2.5 p-4">
                    <View className="flex-row items-start gap-[10px]">
                      <Icon name="LinkSlash" tone="warning" />
                      <View className="min-w-0 flex-1 gap-0.5">
                        <Text className="font-semibold text-foreground">
                          This booking isn’t linked to your account yet
                        </Text>
                        <Text className="text-xs leading-4 text-muted">
                          Enter the stay code from your confirmation email, or scan its QR code at the desk.
                        </Text>
                      </View>
                    </View>
                    <TextField isInvalid={codeError}>
                      <Label>Stay code</Label>
                      <Input
                        value={code}
                        onChangeText={(value) => {
                          setCode(value);
                          setCodeError(false);
                        }}
                        placeholder={`For example ${booking.stayCodeExample}`}
                      />
                      {codeError ? (
                        <FieldError>
                          That code looks too short. Copy it exactly from your confirmation email.
                        </FieldError>
                      ) : null}
                      <Description>Only links the booking. It does not prove who you are.</Description>
                    </TextField>
                    <Button onPress={linkCode}>
                      <Icon name="Link" tone="accent-foreground" />
                      <Button.Label>Link booking</Button.Label>
                    </Button>
                  </Card>
                )}
              </View>

              <Card className="gap-3 p-4">
                <View className="flex-row items-start gap-3">
                  <IconTile name="ListCheck" />
                  <View className="min-w-0 flex-1 gap-0.5">
                    <SectionTitle>Check in before you arrive</SectionTitle>
                    <Text className="text-[13px] leading-[18px] text-muted">
                      Add your ID, arrival time and preferences now. About 3 minutes, and less waiting at the desk.
                    </Text>
                  </View>
                </View>
                <MeterBar
                  label="Pre-arrival check-in"
                  valueLabel={`${booking.preArrival.done} of ${booking.preArrival.steps} steps`}
                  pct={(booking.preArrival.done / booking.preArrival.steps) * 100}
                  accessibilityLabel="Pre-arrival check-in"
                />
                <Link href={screenHref("GuestPreArrival") as never} asChild>
                  <Button size="lg">
                    <Button.Label>Start pre-arrival check-in</Button.Label>
                    <Icon name="ArrowRight" tone="accent-foreground" />
                  </Button>
                </Link>
              </Card>

              <View className="gap-2">
                <View className="flex-row items-center justify-between gap-3">
                  <SectionTitle>Arrival guide</SectionTitle>
                  <Text className="text-xs text-muted">From the hotel · updated {booking.guideUpdated}</Text>
                </View>
                <ListGroup>
                  {guide.map((entry, index) => (
                    <View key={entry.id}>
                      {index > 0 ? <View className="mx-4 h-px bg-separator" /> : null}
                      <ListGroup.Item>
                        <ListGroup.ItemPrefix>
                          <Icon name={entry.icon} tone="muted" />
                        </ListGroup.ItemPrefix>
                        <ListGroup.ItemContent>
                          <ListGroup.ItemTitle>{entry.title}</ListGroup.ItemTitle>
                          <ListGroup.ItemDescription>{entry.text}</ListGroup.ItemDescription>
                        </ListGroup.ItemContent>
                      </ListGroup.Item>
                    </View>
                  ))}
                </ListGroup>
              </View>

              <Card className="gap-2.5 p-4">
                <View className="gap-0.5">
                  <SectionTitle>Cancellation and Policies</SectionTitle>
                  <Text className="text-[13px] leading-[18px] text-muted">
                    Policy {booking.policy.version}, agreed when you booked on {booking.policy.agreedOn}
                  </Text>
                </View>
                <View accessibilityLabel="Cancellation tiers" className="gap-1">
                  {tiers.map((tier) => (
                    <View
                      key={tier.id}
                      accessibilityState={tier.current ? { selected: true } : undefined}
                      className={`flex-row items-start gap-[10px] rounded-[14px] px-3 py-2.5 ${tier.current ? "bg-surface-secondary" : ""}`}
                    >
                      <View className="mt-1.5">
                        <StatusDot tone={tier.current ? tier.tone : null} />
                      </View>
                      <View className="min-w-0 flex-1 gap-0.5">
                        <Text className="text-[13px] leading-[18px] font-medium text-foreground">{tier.when}</Text>
                        <Text className="text-xs leading-4 text-muted">{tier.what}</Text>
                      </View>
                      <SoftChip label={tier.state} tone={tier.tone} />
                    </View>
                  ))}
                </View>
                <Text className="text-xs leading-4 text-muted">
                  Any refund goes back to the MTN MoMo number you paid from and shows as pending until MTN confirms it.
                  No smoking indoors · quiet hours 22:00–07:00 · children under 6 stay free in your room.
                </Text>
              </Card>

              <Card className="gap-3 p-4">
                <View className="gap-0.5">
                  <SectionTitle>Message the Hotel</SectionTitle>
                  <Text className="text-[13px] leading-[18px] text-muted">
                    Linked to booking {booking.id}. After check-in, the same conversation continues with your stay.
                  </Text>
                </View>
                <ChoiceChips
                  label="Send to"
                  options={departments.map((d) => ({ id: d.id, label: d.label }))}
                  selected={[to]}
                  onChange={(next) => {
                    if (next[0]) setTo(next[0]);
                  }}
                />
                <View className="flex-row items-center gap-1.5">
                  <StatusDot tone={dept.open ? "success" : "warning"} />
                  <Text className="flex-1 text-xs leading-4 text-muted">{dept.hours}</Text>
                </View>
                <View className="gap-2.5">
                  {thread.map((message) =>
                    message.mine ? (
                      <View key={message.id} className="items-end gap-[3px]">
                        <View className="max-w-[84%] rounded-2xl bg-accent-soft px-3 py-2">
                          <Text className="text-sm text-foreground">{message.text}</Text>
                        </View>
                        <Text className="text-[11px] leading-[14px] text-muted">{message.meta}</Text>
                      </View>
                    ) : (
                      <View key={message.id} className="flex-row items-start gap-2">
                        <InitialsAvatar initials={message.initials ?? ""} label={message.meta.split(" · ")[0]} />
                        <View className="min-w-0 flex-1 gap-[3px]">
                          <View className="self-start rounded-2xl bg-surface-secondary px-3 py-2">
                            <Text className="text-sm text-foreground">{message.text}</Text>
                          </View>
                          <Text className="text-[11px] leading-[14px] text-muted">{message.meta}</Text>
                        </View>
                      </View>
                    ),
                  )}
                </View>
                <TextField>
                  <TextArea
                    value={draft}
                    onChangeText={setDraft}
                    numberOfLines={2}
                    placeholder={`Write to ${dept.label}`}
                    accessibilityLabel={`Message to ${dept.label}`}
                  />
                </TextField>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-xs text-muted">Staff replies only, no automated answers</Text>
                  <Button isIconOnly accessibilityLabel="Send message" isDisabled={!draft.trim()} onPress={send}>
                    <Icon name="PaperPlane" tone="accent-foreground" />
                  </Button>
                </View>
              </Card>
            </>
          ) : (
            <View accessibilityLabel="Past trips" className="gap-2.5">
              {past.map((trip) => (
                <Card key={trip.id} className="gap-2.5 px-4 py-3.5">
                  <View className="flex-row items-start gap-3">
                    <PhotoFrame image={trip.photo} className="size-14 rounded-[14px]" />
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text className="font-semibold text-foreground">{trip.property}</Text>
                      <Text className="text-xs leading-4 text-muted">{trip.summary}</Text>
                      <Text className="text-xs leading-4 text-muted">{trip.id}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between gap-3">
                    {trip.review ? <SoftChip label={trip.review} tone={trip.reviewTone ?? "default"} /> : <View />}
                    {trip.points ? (
                      <Text className="text-xs text-muted">+{formatNumber(trip.points)} points</Text>
                    ) : null}
                  </View>
                </Card>
              ))}
              <Text className="px-3 py-1 text-center text-xs leading-4 text-muted">
                After you check out of Isangano, your review and loyalty points for this trip appear here.
              </Text>
            </View>
          )}
        </View>
      </PhoneBody>
    </>
  );
}
