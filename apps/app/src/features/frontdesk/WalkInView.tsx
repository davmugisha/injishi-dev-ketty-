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
  Tag,
} from "@gravity-ui/icons";
import {
  Alert,
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
import { EmptyState } from "@heroui-pro/react";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { screenHref } from "@injishi/data";
import type { RoomType } from "@injishi/data/fixtures/frontdesk";
import { formatRwf, GateChip, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EMPTY_REGISTRATION_CARD, RegistrationCard, registrationDetails } from "./RegistrationCard";
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

/**
 * The walk-in reads the room types and what is free tonight from the API. Quote holds, guest profiles to
 * match and a walk-in policy do not exist yet, so none is shown: the prototype's sample quote, its policy,
 * its tax rule and its sample guests are not drawn on this live screen.
 */
export function WalkInView({
  roomTypes,
  nights: initialNights,
  adults: initialAdults,
}: {
  roomTypes: RoomType[];
  nights: number;
  adults: number;
}) {
  const router = useRouter();
  const [nights, setNights] = useState(initialNights);
  const [adults, setAdults] = useState(initialAdults);
  const [kids, setKids] = useState(0);
  const [sel, setSel] = useState<string>("");
  // The walk-in arrives today, in Kigali; the availability is the page's own read of the desk's day.
  const [today] = useState(kigaliIso);
  const [checkedAt, setCheckedAt] = useState(kigaliClock);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [card, setCard] = useState(EMPTY_REGISTRATION_CARD);
  const [saving, startSaving] = useTransition();

  const guests = adults + kids;
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
        guest: registrationDetails(card),
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

  let q: { span: string; lines: { label: string; amt: number }[]; sub: number } | null = null;
  if (t) {
    const sub = t.rate * nights;
    q = {
      // POST /ops/stays/walk-in takes no party size, so the quote names none: the guests counted
      // above only choose a room that sleeps them.
      span: `${dayLabel(today, 0)} → ${dayLabel(today, nights)} · ${plural(nights, "night")}`,
      lines: Array.from({ length: nights }, (_, i) => ({
        label: `${dayLabel(today, i)} · Walk-in`,
        amt: t.rate,
      })),
      sub,
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
          <span className="self-center text-xs text-muted">
            Finds a room that sleeps them · not recorded on the stay
          </span>
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
          <Card className="gap-3 p-[18px]" aria-labelledby="av-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <h2 id="av-h" className="text-[15px] leading-[22px] font-semibold">
                  Availability by Room Type
                </h2>
                <span className="text-xs text-muted">Default rate · per night · free tonight</span>
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
                                <span className="whitespace-nowrap">Pays on the bill</span>
                                <span className="text-xs text-muted">No booking, so no cancellation terms</span>
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
              <span className="text-xs text-muted">The stay opens under the name typed here.</span>
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
            <RegistrationCard value={card} onChange={setCard} />
            <p className="text-xs text-muted" aria-live="polite">
              Guest profiles are not built yet, so there is nothing to search or match: the stay opens under the name
              typed above and is linked to no earlier stay. Check the ID when you hand over the key.
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
                  <EmptyState.Description>The quote appears here.</EmptyState.Description>
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
                  {/* The night audit posts each room night at the stay's rate with no tax line of its own, and no levy
                      is posted to a bill: the estimate adds neither. */}
                  <li className="flex items-start justify-between gap-2">
                    <span className="flex flex-col gap-0.5">
                      <span>VAT</span>
                      <span className="text-[11px] text-muted">
                        Room nights post at the rate, with no separate VAT line
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-muted">Not added</span>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span className="flex flex-col">
                      <span>Tourism levy</span>
                      <span className="text-[11px] text-muted">Not posted to the bill</span>
                    </span>
                    <span className="whitespace-nowrap text-muted">Not added</span>
                  </li>
                  <li className="flex justify-between gap-2 border-t border-separator pt-2 text-[15px] font-semibold">
                    <span>Total</span>
                    <span className="tabular">{formatRwf(q.sub)}</span>
                  </li>
                </ul>
                <Card variant="secondary" className="gap-1 px-3.5 py-3 text-[13px]">
                  <span className="font-semibold">Pays on the bill</span>
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
