"use client";

import { Input, Label, TextField, toast } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import {
  BROKER_GROUP_MAX_ROOMS,
  type BrokerDeal,
  type BrokerRoomOffer,
  type BrokerRoomType,
  brokerCommissionFor,
  brokerDealTermsLine,
  computeBreakdown,
  networkForMsisdn,
  nightlyRateFor,
} from "@injishi/contracts";
import { ActionButton, EmptyBlock, formatMoney, PageContent, PageHeader, SectionCard, SelectField } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CountInput, TextInput } from "../rentals/fields";
import { bookRooms, loadRooms } from "./actions";

interface RoomDraft {
  key: number;
  roomTypeId: string | null;
  guestName: string;
  guestPhone: string;
  adults: number | null;
  children: number | null;
}

const blankRoom = (key: number, roomTypeId: string | null = null): RoomDraft => ({
  key,
  roomTypeId,
  guestName: "",
  guestPhone: "",
  adults: 1,
  children: 0,
});

/** "0788 123 456", "+250788123456" → "788123456", or null while it is not nine digits. */
function nationalDigits(text: string): string | null {
  let d = text.replace(/\D/g, "");
  if (d.startsWith("250")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return /^\d{9}$/.test(d) ? d : null;
}

/** One room's price for the stay, by the same arithmetic the API charges with. */
function roomPrice(type: BrokerRoomType | undefined, adults: number, children: number, nights: number): number | null {
  if (!type || nights <= 0) return null;
  const guests = adults + children;
  const rate = nightlyRateFor(
    { nightlyRateRwf: type.nightlyRateRwf, singleGuestPriceRwf: type.singleGuestPriceRwf, priceBasis: type.priceBasis },
    guests,
  );
  return computeBreakdown({
    nightlyRateRwf: rate,
    nights,
    nonRefundable: false,
    guests,
    priceBasis: type.priceBasis as Parameters<typeof computeBreakdown>[0]["priceBasis"],
  }).grossRwf;
}

/**
 * Book rooms at a hotel under a running deal (0125): the dates, then one line per room with the guest's
 * name on it, then how the group is paid. Paid at the hotel, the rooms are confirmed at once; paid by MoMo,
 * one prompt for the whole group goes to the phone, and the rooms are confirmed when it is approved.
 */
export function BookRoomsView({ deal }: { deal: BrokerDeal }) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [offer, setOffer] = useState<BrokerRoomOffer | null>(null);
  const [rooms, setRooms] = useState<RoomDraft[]>([blankRoom(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [contactPhone, setContactPhone] = useState(deal.broker.phone ?? "");
  const [note, setNote] = useState("");
  const [payment, setPayment] = useState<"at_hotel" | "momo">("at_hotel");
  const [momo, setMomo] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [booking, startBooking] = useTransition();

  const types = new Map((offer?.roomTypes ?? []).map((t) => [t.id, t]));
  const nights = offer?.nights ?? 0;
  const prices = rooms.map((r) => roomPrice(types.get(r.roomTypeId ?? ""), r.adults ?? 0, r.children ?? 0, nights));
  const total = prices.every((p) => p !== null) ? prices.reduce<number>((s, p) => s + (p ?? 0), 0) : null;
  const commission = total !== null ? brokerCommissionFor(deal.terms, total, rooms.length) : null;
  const msisdn = nationalDigits(momo);
  const network = msisdn ? networkForMsisdn(msisdn) : null;

  const search = () => {
    setProblem(null);
    startSearch(async () => {
      const result = await loadRooms(deal.hotel.orgId, checkIn, checkOut);
      if (!result.ok) {
        setOffer(null);
        setProblem(result.error);
        return;
      }
      setOffer(result.value);
      const first = result.value.roomTypes.find((t) => t.freeRooms > 0)?.id ?? null;
      setRooms((rs) =>
        rs.map((r) =>
          r.roomTypeId && result.value.roomTypes.some((t) => t.id === r.roomTypeId) ? r : { ...r, roomTypeId: first },
        ),
      );
    });
  };

  const update = (key: number, patch: Partial<RoomDraft>) => {
    setRooms((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setProblem(null);
  };
  const addRoom = () => {
    if (rooms.length >= BROKER_GROUP_MAX_ROOMS) return;
    setRooms((rs) => [...rs, blankRoom(nextKey, rs[rs.length - 1]?.roomTypeId ?? null)]);
    setNextKey((k) => k + 1);
  };

  const submit = () => {
    if (!offer) return;
    setProblem(null);
    if (payment === "momo" && (!msisdn || !network)) {
      setProblem("Give the MTN or Airtel number that pays, like 078 123 4567.");
      return;
    }
    const input = {
      checkIn: offer.checkIn,
      checkOut: offer.checkOut,
      rooms: rooms.map((r) => ({
        roomTypeId: r.roomTypeId ?? "",
        guestName: r.guestName,
        guestPhone: r.guestPhone.trim() || null,
        adults: r.adults ?? 0,
        children: r.children ?? 0,
      })),
      contactPhone,
      note: note.trim() || null,
      payment:
        payment === "at_hotel"
          ? { method: "at_hotel" as const }
          : {
              method: "momo" as const,
              instrument: { kind: "mobile_money" as const, network: network ?? "mtn_momo", msisdn: msisdn ?? "" },
              attemptToken: crypto.randomUUID(),
            },
    };
    startBooking(async () => {
      const result = await bookRooms(deal.hotel.orgId, input);
      if (!result.ok) {
        const first = result.fieldErrors ? Object.entries(result.fieldErrors).find(([k]) => k !== "_") : undefined;
        setProblem(first ? `${fieldWhere(first[0])}${first[1]}` : result.error);
        return;
      }
      const group = result.value;
      if (group.status === "booked")
        toast.success(
          `${group.rooms.length} ${group.rooms.length === 1 ? "room" : "rooms"} booked · ${group.reference}`,
        );
      router.push(`/broker/bookings/${group.id}`);
    });
  };

  const freeLeft = (typeId: string | null, upTo: number): number => {
    const type = typeId ? types.get(typeId) : undefined;
    if (!type) return 0;
    return type.freeRooms - rooms.slice(0, upTo + 1).filter((r) => r.roomTypeId === typeId).length;
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow={`Hotels · ${deal.hotel.name}`}
        title={`Book rooms at ${deal.hotel.name}`}
        description={`Your deal: ${brokerDealTermsLine(deal.terms)}. Rooms that are free are confirmed straight away.`}
      />
      <div className="flex max-w-[960px] flex-col gap-5">
        <SectionCard title="When">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <TextField value={checkIn} onChange={setCheckIn} isRequired className="flex flex-col gap-1">
              <Label>Check-in</Label>
              <Input type="date" />
            </TextField>
            <TextField value={checkOut} onChange={setCheckOut} isRequired className="flex flex-col gap-1">
              <Label>Check-out</Label>
              <Input type="date" />
            </TextField>
            <ActionButton type="submit" icon="Magnifier" isPending={searching} isDisabled={!checkIn || !checkOut}>
              See rooms
            </ActionButton>
          </form>
          {problem && !offer ? <p className="mt-3 text-sm text-danger">{problem}</p> : null}
        </SectionCard>

        {offer ? (
          offer.roomTypes.length === 0 ? (
            <EmptyBlock
              icon="House"
              title="No rooms on sale"
              description={`${deal.hotel.name} has no room types on sale right now.`}
            />
          ) : (
            <>
              <SectionCard title={`Rooms · ${offer.nights} ${offer.nights === 1 ? "night" : "nights"}`}>
                <ul className="mb-4 flex flex-col gap-1 text-sm">
                  {offer.roomTypes.map((t) => (
                    <li key={t.id} className="flex flex-wrap justify-between gap-2">
                      <span>
                        <span className="font-medium">{t.name}</span>
                        <span className="text-muted"> · sleeps {t.capacity}</span>
                      </span>
                      <span className="tabular text-muted">
                        {formatMoney(t.nightlyRateRwf)} {t.priceBasis === "per_unit" ? "per room" : "per guest"} a night
                        ·{" "}
                        <span className={t.freeRooms > 0 ? "text-foreground" : "text-danger"}>{t.freeRooms} free</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-4">
                  {rooms.map((r, i) => (
                    <div key={r.key} className="flex flex-col gap-3 rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">Room {i + 1}</span>
                        <span className="flex items-center gap-3">
                          {prices[i] != null ? (
                            <span className="tabular text-sm">{formatMoney(prices[i] as number)}</span>
                          ) : null}
                          {rooms.length > 1 ? (
                            <ActionButton
                              size="sm"
                              icon="Xmark"
                              onPress={() => setRooms((rs) => rs.filter((x) => x.key !== r.key))}
                            >
                              Remove
                            </ActionButton>
                          ) : null}
                        </span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <SelectField
                          label="Room type"
                          options={offer.roomTypes.map((t) => ({ id: t.id, label: t.name }))}
                          value={r.roomTypeId}
                          onChange={(roomTypeId) => update(r.key, { roomTypeId })}
                          errorMessage={
                            r.roomTypeId && freeLeft(r.roomTypeId, i) < 0
                              ? "Not enough of these free for those dates."
                              : null
                          }
                          isRequired
                        />
                        <TextInput
                          label="Guest's name"
                          name={`guest-${r.key}`}
                          value={r.guestName}
                          onChange={(guestName) => update(r.key, { guestName })}
                          placeholder="As on their ID"
                          isRequired
                        />
                        <TextInput
                          label="Guest's phone"
                          name={`phone-${r.key}`}
                          value={r.guestPhone}
                          onChange={(guestPhone) => update(r.key, { guestPhone })}
                          inputMode="tel"
                          description="Optional."
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <CountInput
                            label="Adults"
                            name={`adults-${r.key}`}
                            value={r.adults}
                            onChange={(adults) => update(r.key, { adults })}
                            minValue={1}
                            maxValue={20}
                            isRequired
                          />
                          <CountInput
                            label="Children"
                            name={`children-${r.key}`}
                            value={r.children}
                            onChange={(children) => update(r.key, { children })}
                            minValue={0}
                            maxValue={20}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div>
                    <ActionButton icon="Plus" onPress={addRoom} isDisabled={rooms.length >= BROKER_GROUP_MAX_ROOMS}>
                      Add a room
                    </ActionButton>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Contact and payment">
                <div className="flex flex-col gap-4">
                  <TextInput
                    label="Phone the hotel calls about this booking"
                    name="contactPhone"
                    value={contactPhone}
                    onChange={setContactPhone}
                    inputMode="tel"
                    isRequired
                  />
                  <TextInput
                    label="Note to the hotel"
                    name="note"
                    value={note}
                    onChange={setNote}
                    multiline
                    placeholder="Arrival time, a conference, special requests."
                  />
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">How the rooms are paid</span>
                    <Segment
                      aria-label="How the rooms are paid"
                      selectedKey={payment}
                      onSelectionChange={(k) => setPayment(String(k) === "momo" ? "momo" : "at_hotel")}
                      className="w-full"
                    >
                      <Segment.Item id="at_hotel">Guests pay at the hotel</Segment.Item>
                      <Segment.Item id="momo">Pay now by MoMo</Segment.Item>
                    </Segment>
                  </div>
                  {payment === "momo" ? (
                    <TextInput
                      label="MoMo number that pays"
                      name="momo"
                      value={momo}
                      onChange={setMomo}
                      inputMode="tel"
                      placeholder="078 123 4567"
                      description={
                        network
                          ? `${network === "mtn_momo" ? "MTN MoMo" : "Airtel Money"}. One prompt for the whole booking goes to this phone.`
                          : "MTN or Airtel. One prompt for the whole booking goes to this phone."
                      }
                      isRequired
                    />
                  ) : (
                    <p className="text-sm text-muted">
                      Nothing is paid now. The guests pay at the desk, and your commission is paid to you after they
                      check out.
                    </p>
                  )}

                  <div className="flex flex-col gap-1 rounded-xl bg-surface-secondary px-4 py-3 text-sm">
                    <span className="flex justify-between">
                      <span className="font-medium">
                        {rooms.length} {rooms.length === 1 ? "room" : "rooms"} · {offer.nights}{" "}
                        {offer.nights === 1 ? "night" : "nights"}
                      </span>
                      <span className="tabular font-semibold">{total !== null ? formatMoney(total) : "-"}</span>
                    </span>
                    {commission ? (
                      <span className="text-muted">
                        {commission.note ??
                          `Your commission: ${formatMoney(commission.brokerRwf)} (${formatMoney(commission.commissionRwf)} less Injishi's ${formatMoney(commission.injishiRwf)}), paid after the stays.`}
                      </span>
                    ) : null}
                  </div>

                  {problem ? <p className="text-sm text-danger">{problem}</p> : null}
                  <div>
                    <ActionButton
                      intent="primary"
                      icon={payment === "momo" ? "Smartphone" : "CircleCheck"}
                      isPending={booking}
                      onPress={submit}
                    >
                      {payment === "momo"
                        ? `Pay ${total !== null ? formatMoney(total) : ""} and book`
                        : "Book the rooms"}
                    </ActionButton>
                  </div>
                </div>
              </SectionCard>
            </>
          )
        ) : null}
      </div>
    </PageContent>
  );
}

/** "rooms.2.guestName" → "Room 3: " so a refusal says which room it is about. */
function fieldWhere(path: string): string {
  const m = /^rooms\.(\d+)\./.exec(path);
  return m ? `Room ${Number(m[1]) + 1}: ` : "";
}
