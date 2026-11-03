"use client";

import { FieldError, Input, Label, Switch, TextArea, TextField, toast } from "@heroui/react";
import { RadioButtonGroup } from "@heroui-pro/react";
import type { DeskReservationChannel, DeskReservationQuote, DeskReservationRequest } from "@injishi/contracts";
import { screenHref } from "@injishi/data";
import {
  ActionButton,
  ActionLink,
  BoundedDatePicker,
  CountrySelect,
  CountStepper,
  formatDay,
  formatMoney,
  KeyValueList,
  MoneyInput,
  PhoneInput,
  SelectField,
  SidePanel,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { quoteNewBooking, saveNewBooking } from "@/features/pms/front-desk-actions";

/** A room type the desk can book. */
export interface DeskRoomType {
  id: string;
  name: string;
}

const SOURCES: { id: DeskReservationChannel; label: string; hint: string }[] = [
  { id: "phone", label: "Phone", hint: "A call or WhatsApp" },
  { id: "direct", label: "In person", hint: "At the desk" },
  { id: "travel_agent", label: "Agent", hint: "A travel agent" },
  { id: "corporate", label: "Company", hint: "A company booking" },
];

const DEPOSITS = [
  { id: "none", label: "Nothing now" },
  { id: "cash", label: "Cash" },
  { id: "mobile_money", label: "MoMo, paid" },
] as const;
type DepositChoice = (typeof DEPOSITS)[number]["id"];

/** Arrival windows on the hour, 06:00 to 23:00. */
const ARRIVALS = Array.from({ length: 18 }, (_, i) => {
  const h = String(i + 6).padStart(2, "0");
  return { id: `${h}:00`, label: `${h}:00` };
});

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** The last minute of a Kigali day, as an instant: when a hold "until 5 Nov" ends. */
const endOfKigaliDay = (iso: string) => `${iso}T23:59:00+02:00`;

/**
 * THE DESK BOOKS A GUEST (0124): one side panel, from the page header, the Bookings list or a time chosen
 * on the calendar. Dates and party, then the room type with its price from the API (the stay's own rules)
 * and the rooms free to hold, then who the guest is, where the booking came from, a deposit if one was
 * taken, and an optional hold. Nothing is chosen for the desk. A booking that starts today goes straight
 * on to check in.
 */
export function NewBookingPanel({
  roomTypes,
  today,
  initial,
  onClose,
}: {
  roomTypes: DeskRoomType[];
  today: string;
  initial?: { day?: string; time?: string; roomTypeId?: string; roomId?: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [arrival, setArrival] = useState<string | null>(initial?.day && initial.day >= today ? initial.day : null);
  const [nights, setNights] = useState(1);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [typeId, setTypeId] = useState<string | null>(initial?.roomTypeId ?? null);
  const [roomId, setRoomId] = useState<string | null>(initial?.roomId ?? null);
  const [quote, setQuote] = useState<DeskReservationQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [nationality, setNationality] = useState<string | null>(null);
  const [source, setSource] = useState<DeskReservationChannel | null>(null);
  const [eta, setEta] = useState<string | null>(initial?.time && /^\d{2}:00$/.test(initial.time) ? initial.time : null);
  const [ownPrice, setOwnPrice] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [priceReason, setPriceReason] = useState("");
  const [deposit, setDeposit] = useState<DepositChoice | null>(null);
  const [depositRwf, setDepositRwf] = useState<number | null>(null);
  const [depositRef, setDepositRef] = useState("");
  const [holdUntil, setHoldUntil] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [key] = useState(() => crypto.randomUUID());
  const [pricing, priceIt] = useTransition();
  const [saving, save] = useTransition();

  const checkOut = arrival ? addDays(arrival, nights) : null;
  const startsToday = arrival === today;

  // The price and the free rooms whenever the stay's answer changes.
  useEffect(() => {
    if (!arrival || !checkOut || !typeId) {
      setQuote(null);
      return;
    }
    priceIt(async () => {
      const r = await quoteNewBooking({
        checkIn: arrival,
        checkOut,
        roomTypeId: typeId,
        adults,
        children,
        ...(ownPrice && price ? { nightlyRateRwf: price } : {}),
      });
      if (!r.ok) {
        setQuote(null);
        setQuoteError(r.error);
        return;
      }
      setQuoteError(null);
      setQuote(r.value);
      setRoomId((current) => (current && r.value.freeRooms.some((x) => x.id === current) ? current : null));
    });
  }, [arrival, checkOut, typeId, adults, children, ownPrice, price]);

  const roomOptions = useMemo(
    () => [
      { id: "none", label: "No room yet" },
      ...(quote?.freeRooms ?? []).map((r) => ({ id: r.id, label: `Room ${r.label}` })),
    ],
    [quote],
  );
  const problems = [...(quote?.problems ?? []), ...(quoteError ? [quoteError] : [])];

  const submit = () => {
    const e: Record<string, string> = {};
    if (!arrival) e.arrival = "Choose the arrival day.";
    if (!typeId) e.roomType = "Choose a room type.";
    if (!fullName.trim()) e.fullName = "Type the guest's name as on their ID.";
    if (!phone) e.phone = "Type the guest's phone number.";
    if (!source) e.source = "Say where the booking came from.";
    if (ownPrice && !price) e.price = "Type the price a night.";
    if (ownPrice && priceReason.trim().length < 3) e.priceReason = "Say why the price changed.";
    if (deposit === null) e.deposit = "Say whether a deposit was taken.";
    if (deposit && deposit !== "none" && !depositRwf) e.depositRwf = "Type the amount taken.";
    if (deposit === "mobile_money" && !depositRef.trim()) e.depositRef = "Type the MoMo transaction reference.";
    setErrors(e);
    if (Object.keys(e).length > 0 || !arrival || !checkOut || !typeId || !source) return;
    if (problems.length > 0) {
      toast.danger(problems[0] ?? "This booking cannot be made.");
      return;
    }
    const request: DeskReservationRequest = {
      checkIn: arrival,
      checkOut,
      roomTypeId: typeId,
      ...(roomId && roomId !== "none" ? { roomId } : {}),
      adults,
      children,
      guest: {
        fullName: fullName.trim(),
        ...(phone ? { phone } : {}),
        ...(nationality ? { nationality } : {}),
      },
      channel: source,
      ...(eta ? { eta } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(holdUntil ? { holdUntil: endOfKigaliDay(holdUntil) } : {}),
      ...(ownPrice && price ? { nightlyRateRwf: price, rateOverrideReason: priceReason.trim() } : {}),
      ...(deposit && deposit !== "none" && depositRwf
        ? {
            deposit: {
              method: deposit,
              amountRwf: depositRwf,
              ...(depositRef.trim() ? { reference: depositRef.trim() } : {}),
            },
          }
        : {}),
    };
    save(async () => {
      const r = await saveNewBooking(request, key);
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      const b = r.value;
      toast.success(`${fullName.trim()} booked, ${b.reference}${b.roomLabel ? `, room ${b.roomLabel}` : ""}`);
      if (b.roomProblem) toast.warning(`${b.roomProblem} The booking waits for a room.`);
      onClose();
      if (startsToday) router.push(`${screenHref("CheckIn")}?booking=${encodeURIComponent(b.reference)}`);
      else router.refresh();
    });
  };

  return (
    <SidePanel
      isOpen
      onOpenChange={(o) => (o ? undefined : onClose())}
      title="New booking"
      description={
        arrival ? `${formatDay(arrival, "long")}${checkOut ? ` to ${formatDay(checkOut, "long")}` : ""}` : undefined
      }
      submitLabel={startsToday ? "Book and check in" : "Book"}
      submitIcon="CircleCheck"
      isPending={saving}
      validationErrors={errors}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BoundedDatePicker
          label="Arrival"
          name="arrival"
          value={arrival}
          onChange={setArrival}
          minValue={today}
          isRequired
          errorMessage={errors.arrival}
        />
        <CountStepper label="Nights" unit="nights" min={1} max={90} value={nights} onChange={setNights} />
        <CountStepper label="Adults" unit="adults" min={1} max={20} value={adults} onChange={setAdults} />
        <CountStepper label="Children" unit="children" min={0} max={20} value={children} onChange={setChildren} />
      </div>

      <SelectField
        label="Room type"
        name="roomType"
        isRequired
        options={roomTypes.map((t) => ({ id: t.id, label: t.name }))}
        value={typeId}
        onChange={setTypeId}
        placeholder="Choose a room type"
        errorMessage={errors.roomType}
      />
      {typeId && arrival ? (
        <SelectField
          label="Room"
          name="room"
          options={roomOptions}
          value={roomId ?? "none"}
          onChange={(v) => setRoomId(v === "none" ? null : v)}
          isDisabled={pricing || !quote?.available}
          description={quote?.available ? `${quote.freeRooms.length} free for these nights` : undefined}
        />
      ) : null}

      {quote || pricing || problems.length > 0 ? (
        <div
          className="flex flex-col gap-1 rounded-[var(--inner-radius)] bg-default/60 px-3 py-2 text-sm"
          aria-live="polite"
        >
          {pricing ? (
            <span className="text-muted">Pricing…</span>
          ) : quote && problems.length === 0 ? (
            <KeyValueList
              items={[
                { label: "A night", value: formatMoney(quote.chargedNightlyRwf) },
                { label: "Total", value: formatMoney(quote.totalRwf) },
              ]}
            />
          ) : null}
          {!pricing && problems.length > 0 ? <span className="text-danger">{problems.join(" ")}</span> : null}
        </div>
      ) : null}

      <Switch isSelected={ownPrice} onChange={setOwnPrice} className="self-start">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <span className="text-sm">Change the price</span>
        </Switch.Content>
      </Switch>
      {ownPrice ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MoneyInput
            label="Price a night"
            name="price"
            value={price}
            onChange={setPrice}
            errorMessage={errors.price}
          />
          <TextField
            name="priceReason"
            value={priceReason}
            onChange={setPriceReason}
            isInvalid={!!errors.priceReason}
            className="flex flex-col gap-1"
          >
            <Label>Why</Label>
            <Input placeholder="Returning guest" />
            <FieldError>{errors.priceReason}</FieldError>
          </TextField>
        </div>
      ) : null}

      <TextField
        name="fullName"
        isRequired
        value={fullName}
        onChange={setFullName}
        isInvalid={!!errors.fullName}
        className="flex flex-col gap-1"
      >
        <Label>Guest name</Label>
        <Input autoComplete="off" />
        <FieldError>{errors.fullName}</FieldError>
      </TextField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PhoneInput label="Phone" value={phone} onChange={setPhone} isRequired errorMessage={errors.phone} />
        <CountrySelect
          label="Nationality"
          value={nationality}
          onChange={setNationality}
          description="Foreign guests are reported to DGIE"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Booked by</span>
        <RadioButtonGroup
          aria-label="Booked by"
          value={source ?? ""}
          onChange={(v) => setSource(v as DeskReservationChannel)}
          layout="grid"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {SOURCES.map((s) => (
            <RadioButtonGroup.Item key={s.id} value={s.id} className="px-3 py-2">
              <RadioButtonGroup.ItemContent>
                <span className="text-sm font-medium">{s.label}</span>
                <span className="text-xs text-muted">{s.hint}</span>
              </RadioButtonGroup.ItemContent>
            </RadioButtonGroup.Item>
          ))}
        </RadioButtonGroup>
        {errors.source ? <span className="text-xs text-danger">{errors.source}</span> : null}
      </div>

      <SelectField
        label="Arrives around"
        name="eta"
        options={ARRIVALS}
        value={eta}
        onChange={setEta}
        placeholder="Not said"
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Deposit</span>
        <RadioButtonGroup
          aria-label="Deposit"
          value={deposit ?? ""}
          onChange={(v) => setDeposit(v as DepositChoice)}
          className="grid grid-cols-3 gap-2"
        >
          {DEPOSITS.map((d) => (
            <RadioButtonGroup.Item key={d.id} value={d.id} className="px-3 py-2">
              <RadioButtonGroup.ItemContent>
                <span className="text-sm font-medium">{d.label}</span>
              </RadioButtonGroup.ItemContent>
            </RadioButtonGroup.Item>
          ))}
        </RadioButtonGroup>
        {errors.deposit ? <span className="text-xs text-danger">{errors.deposit}</span> : null}
      </div>
      {deposit && deposit !== "none" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MoneyInput
            label="Amount"
            name="depositRwf"
            value={depositRwf}
            onChange={setDepositRwf}
            errorMessage={errors.depositRwf}
            description="Goes on the guest's bill"
          />
          {deposit === "mobile_money" ? (
            <TextField
              name="depositRef"
              value={depositRef}
              onChange={setDepositRef}
              isInvalid={!!errors.depositRef}
              className="flex flex-col gap-1"
            >
              <Label>MoMo reference</Label>
              <Input autoComplete="off" />
              <FieldError>{errors.depositRef}</FieldError>
            </TextField>
          ) : null}
        </div>
      ) : null}

      <BoundedDatePicker
        label="Hold until"
        name="holdUntil"
        value={holdUntil}
        onChange={setHoldUntil}
        minValue={today}
        maxValue={arrival ?? undefined}
        description="Optional. Not confirmed by then, the nights are freed."
      />
      <TextField name="note" value={note} onChange={setNote} className="flex flex-col gap-1">
        <Label>Note</Label>
        <TextArea rows={2} placeholder="Late arrival, airport pickup…" />
      </TextField>
    </SidePanel>
  );
}

/** The desk's header actions: Walk in, and New booking with its panel. */
export function DeskHeaderActions({
  roomTypes,
  today,
  canBook,
}: {
  roomTypes: DeskRoomType[];
  today: string;
  canBook: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ActionLink href={screenHref("WalkIn")} icon="PersonPlus" intent={canBook ? "secondary" : "primary"}>
        Walk in
      </ActionLink>
      {canBook ? (
        <ActionButton intent="primary" icon="Plus" onPress={() => setOpen(true)}>
          New booking
        </ActionButton>
      ) : null}
      {open ? <NewBookingPanel roomTypes={roomTypes} today={today} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
