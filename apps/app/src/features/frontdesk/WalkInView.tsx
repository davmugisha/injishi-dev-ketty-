"use client";

import {
  ArrowRightToSquare,
  ArrowsRotateRight,
  Calendar,
  Clock,
  FileText,
  LayoutCells,
  Lock,
  PaperPlane,
  ShieldExclamation,
  Tag,
  TriangleExclamation,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Label,
  Radio,
  RadioGroup,
  Table,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { EmptyState, RadioButtonGroup } from "@heroui-pro/react";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { screenHref } from "@injishi/data";
import type { GuestMatch, RoomType, WalkInQuote } from "@injishi/data/fixtures/frontdesk";
import { formatRwf, GateChip, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { checkInWalkIn } from "./actions";
import { ChoiceSelect, plural } from "./shared";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Today in Kigali, "2026-10-19": the walk-in arrives now, whatever day the prototype drew. */
const kigaliIso = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const kigaliClock = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

/** "Mon 12 Oct" for the arrival date plus `offset` days. */
function dayLabel(isoDate: string, offset: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + offset));
  return `${DOW[date.getUTCDay()]} ${date.getUTCDate()} ${MONTH[date.getUTCMonth()]}`;
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  fewer,
  more,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  fewer: string;
  more: string;
}) {
  return (
    <NumberStepper value={value} onChange={onChange} minValue={min} maxValue={max} className="flex flex-col gap-1">
      <Label>{label}</Label>
      <NumberStepper.Group>
        <NumberStepper.DecrementButton aria-label={fewer} />
        <NumberStepper.Value />
        <NumberStepper.IncrementButton aria-label={more} />
      </NumberStepper.Group>
    </NumberStepper>
  );
}

export function WalkInView({
  roomTypes,
  matches,
  quote,
  nights: initialNights,
  adults: initialAdults,
}: {
  roomTypes: RoomType[];
  matches: GuestMatch[];
  quote: WalkInQuote;
  nights: number;
  adults: number;
}) {
  const router = useRouter();
  const [nights, setNights] = useState(initialNights);
  const [adults, setAdults] = useState(initialAdults);
  const [kids, setKids] = useState(quote.children);
  const [sel, setSel] = useState<string>(quote.roomType);
  const [conflict, setConflict] = useState(quote.conflictType !== null);
  const [guest, setGuest] = useState(quote.guestMatch);
  // The walk-in arrives today, in Kigali; the availability is the page's own read of the desk's day.
  const [today] = useState(kigaliIso);
  const [checkedAt, setCheckedAt] = useState(kigaliClock);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, startSaving] = useTransition();

  const guests = adults + kids;
  const conflictType = roomTypes.find((t) => t.id === quote.conflictType);
  const offer = roomTypes.find((t) => t.id === "family");
  const stillFree = roomTypes.filter((t) => t.free > 0 && t.id !== "queen").map((t) => t.name);
  const bookable = (t: RoomType) => t.free > 0 && !t.soldNote && guests <= t.sleeps;
  const t = roomTypes.find((x) => x.id === sel && bookable(x));
  const canCheckIn = !!t && name.trim().length > 0 && !saving;

  const pick = (id: string) => setSel(id);

  /** Read availability again from the API (the page re-reads the desk's day). */
  const recheck = () => {
    router.refresh();
    setCheckedAt(kigaliClock());
  };

  /** Open the stay now: POST /ops/stays/walk-in picks a ready room of this type and opens its bill. */
  const checkIn = () => {
    if (!t || !name.trim()) return;
    const type = t;
    startSaving(async () => {
      const result = await checkInWalkIn({
        roomTypeId: type.id,
        nights,
        guestName: name,
        phone: phone || undefined,
        email: email || undefined,
      });
      if (!result.ok) {
        toast.danger(`${name.trim()} was not checked in: ${result.error}`);
        return;
      }
      const w = result.value;
      toast.success(
        `${name.trim()} is checked in to room ${w.room}${w.stayReference ? ` · stay ${w.stayReference}` : ""}${
          email ? (w.invited ? " · claim code emailed" : " · claim code not emailed") : ""
        }`,
      );
      router.push(`/stays/${encodeURIComponent(w.stayReference ?? w.stayId)}`);
    });
  };

  let q: { span: string; lines: { label: string; amt: number }[]; sub: number; vat: number; first: number } | null =
    null;
  if (t) {
    const sub = t.rate * nights;
    q = {
      span: `${dayLabel(today, 0)} → ${dayLabel(today, nights)} · ${plural(nights, "night")} · ${plural(adults, "adult")}${
        kids ? `, ${plural(kids, "child", "children")}` : ""
      }`,
      lines: Array.from({ length: nights }, (_, i) => ({
        label: `${dayLabel(today, i)} · Walk-in`,
        amt: t.rate,
      })),
      sub,
      vat: sub * quote.tax.rate,
      first: t.rate * (1 + quote.tax.rate),
    };
  }

  return (
    <PageContent className="text-[14px] leading-5">
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={
          <>
            <NextLink href={screenHref("FrontDeskToday")} className="text-inherit no-underline hover:underline">
              Today
            </NextLink>
            <span aria-hidden="true">›</span>
            <span>Walk-in</span>
          </>
        }
        title="Walk-in"
        description="Find a room, quote it, then check the guest in: the stay and its bill open at once."
        actions={
          <>
            <LinkButton href={screenHref("RoomRack")} variant="ghost">
              <LayoutCells className="size-4" />
              Room rack
            </LinkButton>
            <LinkButton href={screenHref("FrontDeskToday")} variant="secondary">
              Cancel
            </LinkButton>
          </>
        }
      />

      <Card className="px-[18px] py-4" aria-label="Dates and guests">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3.5">
          <ChoiceSelect
            label="Arrival"
            options={[`Today · ${dayLabel(today, 0)}`]}
            value={`Today · ${dayLabel(today, 0)}`}
            onChange={() => {}}
            indicator={<Calendar className="size-4" />}
            className="flex min-w-[190px] flex-col gap-1"
          />
          <Stepper
            label="Nights"
            value={nights}
            onChange={setNights}
            min={1}
            max={10}
            fewer="Fewer nights"
            more="More nights"
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Departure</span>
            <span className="flex h-9 items-center font-medium tabular" aria-live="polite">
              {dayLabel(today, nights)}
            </span>
          </div>
          <Stepper
            label="Adults"
            value={adults}
            onChange={setAdults}
            min={1}
            max={6}
            fewer="Fewer adults"
            more="More adults"
          />
          <Stepper
            label="Children"
            value={kids}
            onChange={setKids}
            min={0}
            max={4}
            fewer="Fewer children"
            more="More children"
          />
          <span className="flex-1" />
          <span className="self-center text-xs text-muted">Free tonight · checked {checkedAt}</span>
          <Button variant="secondary" onPress={recheck}>
            <ArrowsRotateRight className="size-4" />
            Check again
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-4">
          {conflict && conflictType ? (
            <Alert status="danger" role="alert">
              <Alert.Indicator>
                <TriangleExclamation />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Last {conflictType.name} was just booked on another channel — choose another</Alert.Title>
                <Alert.Description>
                  The marketplace confirmed it at {quote.conflictAt} while you were quoting. Nothing was held or charged
                  for this guest. {stillFree.join(" and ")} are still free for these dates.
                </Alert.Description>
                <div className="mt-2 flex flex-wrap gap-2">
                  {offer ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => {
                        pick(offer.id);
                        setAdults((a) => Math.min(a, offer.sleeps));
                      }}
                    >
                      Offer {offer.name}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onPress={() => setConflict(false)}>
                    Dismiss
                  </Button>
                </div>
              </Alert.Content>
            </Alert>
          ) : null}

          <Card className="gap-3 p-[18px]" aria-labelledby="av-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <h2 id="av-h" className="text-[15px] leading-[22px] font-semibold">
                  Availability by Room Type
                </h2>
                <span className="text-xs text-muted">Standard rate plan · per night · free tonight</span>
              </div>
              <GateChip icon={<Lock className="size-3" />}>Rates are managed by your general manager</GateChip>
            </div>
            <RadioGroup aria-label="Room type" value={t ? t.id : ""} onChange={pick}>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Room types for the selected dates">
                    <Table.Header>
                      <Table.Column isRowHeader>Room type</Table.Column>
                      <Table.Column>Sleeps</Table.Column>
                      <Table.Column>Free</Table.Column>
                      <Table.Column className="text-right">Rate a night</Table.Column>
                      <Table.Column>Policy</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {roomTypes.map((rt) => {
                        const tooMany = guests > rt.sleeps;
                        const on = t?.id === rt.id;
                        const free = rt.soldNote
                          ? { label: rt.soldNote, tone: "danger" as const }
                          : tooMany
                            ? { label: "Too many guests", tone: "default" as const }
                            : {
                                label: `${rt.free} free`,
                                tone: rt.free === 1 ? ("warning" as const) : ("default" as const),
                              };
                        return (
                          <Table.Row key={rt.id} id={rt.id} className={on ? "[&>td]:bg-surface-secondary" : undefined}>
                            <Table.Cell>
                              <Radio value={rt.id} isDisabled={!bookable(rt)}>
                                <Radio.Content className="flex items-center gap-3">
                                  <Radio.Control>
                                    <Radio.Indicator />
                                  </Radio.Control>
                                  <span className="flex flex-col">
                                    <span className="font-semibold">{rt.name}</span>
                                    <span className="text-xs font-normal text-muted">{rt.beds}</span>
                                  </span>
                                </Radio.Content>
                              </Radio>
                            </Table.Cell>
                            <Table.Cell className="tabular">{plural(rt.sleeps, "guest")}</Table.Cell>
                            <Table.Cell>
                              <Chip size="sm" variant="soft" color={toneColor(free.tone)} className="whitespace-nowrap">
                                {free.label}
                              </Chip>
                            </Table.Cell>
                            <Table.Cell className="text-right whitespace-nowrap tabular">
                              {formatRwf(rt.rate)}
                            </Table.Cell>
                            <Table.Cell>
                              <span className="flex flex-col">
                                <span className="whitespace-nowrap">{quote.policy.name}</span>
                                <span className="text-xs text-muted">{quote.policy.note}</span>
                              </span>
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </RadioGroup>
          </Card>

          <Card className="gap-3 p-[18px]" aria-labelledby="g-h">
            <div className="flex flex-col gap-0.5">
              <h2 id="g-h" className="text-[15px] leading-[22px] font-semibold">
                Guest
              </h2>
              <span className="text-xs text-muted">
                Search before creating a profile. Matches are suggestions; nothing is merged automatically.
              </span>
            </div>
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))]">
              <TextField value={name} onChange={setName} className="flex flex-col gap-1">
                <Label>Full name</Label>
                <Input placeholder="As on the guest's ID" />
              </TextField>
              <TextField value={phone} onChange={setPhone} className="flex flex-col gap-1">
                <Label>Phone</Label>
                <Input className="tabular" type="tel" placeholder="+250 7…" />
              </TextField>
              <TextField value={email} onChange={setEmail} className="flex flex-col gap-1">
                <Label>Email (optional)</Label>
                <Input placeholder="Gets the claim code for the guest app" type="email" />
              </TextField>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold">
                {plural(matches.filter((m) => m.id !== "new").length, "possible match", "possible matches")}
              </span>
              <span className="text-xs text-muted">Isangano guests only</span>
            </div>
            <RadioButtonGroup
              aria-label="Guest profile for this booking"
              value={guest}
              onChange={(v) => v && setGuest(v)}
              className="flex flex-col gap-2"
            >
              {matches.map((m) => (
                <RadioButtonGroup.Item key={m.id} value={m.id} className="flex-row items-center gap-3 px-3.5 py-2.5">
                  <RadioButtonGroup.ItemContent className="flex flex-1 flex-row items-center gap-3">
                    <Avatar size="sm" variant="soft" color={m.id === "g1" ? "accent" : "default"}>
                      <Avatar.Fallback>{m.initials}</Avatar.Fallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Label className="font-semibold">{m.name}</Label>
                      <span className="text-xs text-muted tabular">{m.desc}</span>
                    </span>
                    <Chip size="sm" variant="soft" color={toneColor(m.tone)}>
                      {m.chip}
                    </Chip>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
              ))}
            </RadioButtonGroup>
            <p className="text-xs text-muted" aria-live="polite">
              Guest profiles are not built yet, so a match is only a suggestion: the stay opens under the name typed
              above and nothing is linked. Check the ID when you hand over the key.
            </p>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4" aria-label="Quote">
          <Card className="gap-3.5 p-[18px]" aria-labelledby="q-h">
            <div className="flex items-center justify-between gap-2">
              <h2 id="q-h" className="text-[15px] leading-[22px] font-semibold">
                Quote
              </h2>
              <Chip size="sm" variant="soft">
                Estimate · not saved
              </Chip>
            </div>
            {!t || !q ? (
              <EmptyState size="sm">
                <EmptyState.Header>
                  <EmptyState.Media variant="icon">
                    <Tag />
                  </EmptyState.Media>
                  <EmptyState.Title>Choose a room type</EmptyState.Title>
                  <EmptyState.Description>The quote and its taxes appear here.</EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-[13px] text-muted tabular">{q.span}</span>
                </div>
                <ul className="flex flex-col gap-1.5 text-[13px]">
                  {q.lines.map((l) => (
                    <li key={l.label} className="flex justify-between gap-2">
                      <span>{l.label}</span>
                      <span className="tabular">{formatRwf(l.amt)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between gap-2 border-t border-separator pt-1.5">
                    <span>Subtotal</span>
                    <span className="tabular">{formatRwf(q.sub)}</span>
                  </li>
                  <li className="flex items-start justify-between gap-2">
                    <span className="flex flex-col gap-0.5">
                      <span>VAT {Math.round(quote.tax.rate * 100)}%</span>
                      <span className="text-[11px] text-muted">{quote.tax.rule}</span>
                      <GateChip icon={<ShieldExclamation className="size-3" />} className="self-start">
                        Configured · awaiting sign-off
                      </GateChip>
                    </span>
                    <span className="whitespace-nowrap tabular">{formatRwf(q.vat)}</span>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex flex-col">
                      <span>Tourism levy</span>
                      <span className="text-[11px] text-muted">{quote.tax.levy}</span>
                    </span>
                    <span className="text-muted tabular">{formatRwf(0)}</span>
                  </li>
                  <li className="flex justify-between gap-2 border-t border-separator pt-2 text-[15px] font-semibold">
                    <span>Total</span>
                    <span className="tabular">{formatRwf(q.sub + q.vat)}</span>
                  </li>
                </ul>
                <Card variant="secondary" className="gap-1 px-3.5 py-3 text-[13px]">
                  <span className="font-semibold">
                    {quote.policy.name} · {quote.policy.id}
                  </span>
                  <span className="text-muted">
                    A walk-in pays on the bill: each night posts at night audit, and the desk takes cash on the stay's
                    page after check-in (the first night is {formatRwf(t.rate)}).
                  </span>
                </Card>

                {/* Quote holds (a room kept for a guest who is deciding) have no table or route. */}
                <Alert status="default" role="status">
                  <Alert.Indicator>
                    <Clock />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Not held while the guest decides</Alert.Title>
                    <Alert.Description>
                      Holding a room for a quote is not available yet. Another desk or channel can still take {t.name}{" "}
                      until you check the guest in.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>

                <p className="text-xs text-muted">
                  Checking in opens the stay and its bill at once, in a ready {t.name} room, at the rate above for{" "}
                  {plural(nights, "night")}. If the last room is taken first, you'll be asked to choose again; nothing
                  is double-booked.
                </p>
                <Button fullWidth isDisabled={!canCheckIn} onPress={checkIn}>
                  <ArrowRightToSquare className="size-4" />
                  {saving
                    ? "Checking in…"
                    : name.trim()
                      ? `Check in ${name.trim()}`
                      : "Type the guest's name to check in"}
                </Button>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onPress={() => window.print()}>
                    <FileText className="size-4" />
                    Proforma
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => toast.warning("Sending a quote by SMS is not available yet. Nothing was sent.")}
                  >
                    <PaperPlane className="size-4" />
                    Send quote by SMS
                  </Button>
                </div>
              </div>
            )}
          </Card>
          <p className="px-1 text-xs leading-4 text-muted">
            A proforma is a quote, not a tax invoice. The EBM fiscal receipt is issued when the stay is settled.
          </p>
        </aside>
      </div>
    </PageContent>
  );
}
