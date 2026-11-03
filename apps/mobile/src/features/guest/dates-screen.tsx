import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  Choice,
  Divider,
  Dock,
  LoadingBone,
  LoadingView,
  Segmented,
  SheetScreen,
  Stepper,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { MonthCalendar, MonthHeader } from "./calendar";
import { useChooseStay, useDates, useSetSearch } from "./data";
import { addDays, dayMonth, daysBetween, type Month, monthOf, rangeWords, shiftMonth } from "./dates";
import { type PlacePick, pickPlace } from "./explore-intent";
import { intentFrom } from "./intent";
import type { DatesData } from "./types";
import { WhereField } from "./where-field";

type Tab = "dates" | "guests" | "room";

type Form = {
  checkIn: string | null;
  checkOut: string | null;
  adults: number;
  children: number;
  roomId: string | null;
};

const TABS: readonly { value: Tab; label: string }[] = [
  { value: "dates", label: "Dates" },
  { value: "guests", label: "Guests" },
  { value: "room", label: "Room" },
];

/** How far ahead the calendar goes, in months. */
const MONTHS_AHEAD = 11;
const MAX_CHILDREN = 4;

function monthIndex({ year, month }: Month): number {
  return year * 12 + month;
}

/** The first sold out night between check-in and the night before `day`, if any. */
function soldNightBefore(sold: readonly string[], checkIn: string, day: string): string | null {
  for (let night = checkIn; night < day; night = addDays(night, 1)) if (sold.includes(night)) return night;
  return null;
}

/**
 * Dates and guests (prototype `guest-dates`): one sheet for the nights, the party and the room, with
 * sold out nights marked before they are picked. Over a stay's page its button shows the total and
 * goes to checkout; opened from Explore's search (`from=explore`) it sets the search instead, and a
 * "Where" field on top changes the place (the search's own params come with it).
 */
export function DatesScreen() {
  const params = useScreenParams("guest-dates");
  const explore = params.from === "explore";
  const searched = intentFrom(params);
  const query = useDates({ explore, slug: params.slug ?? null, roomId: params.room ?? null });
  const choose = useChooseStay();
  const search = useSetSearch();
  const [tab, setTab] = useState<Tab>("dates");
  const [edits, setEdits] = useState<Partial<Form>>({});
  const [month, setMonth] = useState<Month | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const data = query.data;
  const form: Form | null = data
    ? {
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        adults: data.adults,
        children: data.children,
        roomId: data.roomId,
        ...edits,
      }
    : null;
  const room = data?.rooms.find((r) => r.id === form?.roomId) ?? data?.rooms[0] ?? null;
  const shown = month ?? (data ? monthOf(form?.checkIn ?? data.today) : null);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace(explore ? href("guest-explore") : href("guest-property", { slug: data?.slug ?? params.slug }));
  };

  const pickWhere = (pick: PlacePick) => {
    pickPlace(pick);
    // No dates to set here (they did not load): the place was all this sheet could change.
    if (!form) close();
  };

  const pick = (day: string) => {
    if (!form) return;
    const sold = room?.soldOut ?? [];
    setNotice(null);
    if (form.checkIn && !form.checkOut && day > form.checkIn) {
      const blocked = soldNightBefore(sold, form.checkIn, day);
      if (blocked) {
        setNotice(`${room?.name ?? "This room"} is sold out on the night of ${dayMonth(blocked)}. Pick other days.`);
        return;
      }
      setEdits((e) => ({ ...e, checkOut: day }));
      return;
    }
    if (sold.includes(day)) {
      setNotice(`${room?.name ?? "This room"} is sold out on the night of ${dayMonth(day)}.`);
      return;
    }
    setEdits((e) => ({ ...e, checkIn: day, checkOut: null }));
  };

  const confirm = () => {
    if (!form?.checkIn || !form.checkOut || !data) return;
    // A room picked after the dates may be sold out on one of those nights.
    const blocked = room ? soldNightBefore(room.soldOut, form.checkIn, form.checkOut) : null;
    if (blocked) {
      setTab("dates");
      setNotice(`${room?.name ?? "This room"} is sold out on the night of ${dayMonth(blocked)}. Pick other days.`);
      return;
    }
    const choice = {
      slug: data.slug,
      roomId: room?.id ?? null,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      adults: form.adults,
      children: form.children,
    };
    if (explore) search.mutate(choice, { onSuccess: close });
    else choose.mutate(choice, { onSuccess: () => router.replace(href("guest-checkout")) });
  };

  const nights = form?.checkIn && form.checkOut ? daysBetween(form.checkIn, form.checkOut) : 0;
  const range = form?.checkIn && form.checkOut ? rangeWords(form.checkIn, form.checkOut) : null;
  const label =
    range === null
      ? form?.checkIn
        ? "Choose your check-out day"
        : "Choose your check-in day"
      : explore
        ? `Show stays · ${range}`
        : room
          ? `${range} · ${rwf(room.priceRwf * nights)}`
          : range;

  const tabs: readonly { value: Tab; label: string }[] = explore ? TABS.filter((t) => t.value !== "room") : TABS;

  const body = (
    <QueryView query={query} data={data} offlineNote={null} loading={<DatesBones />}>
      {(d) => (
        <View className="gap-4">
          <Segmented label="What to change" options={tabs} value={tab} onChange={setTab} />
          {tab === "room" && !explore ? (
            <RoomChoices data={d} roomId={room?.id ?? null} onPick={(roomId) => setEdits((e) => ({ ...e, roomId }))} />
          ) : null}
          {tab === "dates" && shown ? (
            <View className="gap-2">
              <MonthHeader
                month={shown}
                canBack={monthIndex(shown) > monthIndex(monthOf(d.today))}
                canForward={monthIndex(shown) < monthIndex(monthOf(d.today)) + MONTHS_AHEAD}
                onShift={(by) => setMonth(shiftMonth(shown, by))}
              />
              <MonthCalendar
                month={shown}
                today={d.today}
                checkIn={form?.checkIn ?? null}
                checkOut={form?.checkOut ?? null}
                soldOut={room?.soldOut ?? []}
                onPick={pick}
              />
              {notice ? (
                <Text role="caption" tone="danger" accessibilityLiveRegion="polite">
                  {notice}
                </Text>
              ) : room && room.soldOut.length > 0 ? (
                <View className="flex-row items-center gap-1.5">
                  <View className="h-1.5 w-1.5 rounded-full bg-danger" />
                  <Text role="caption" tone="muted">
                    {room.name} sold out
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          {tab !== "room" && form ? (
            <>
              {tab === "dates" ? <Divider /> : null}
              <Guests
                adults={form.adults}
                kids={form.children}
                maxAdults={d.maxAdults}
                onAdults={(adults) => setEdits((e) => ({ ...e, adults }))}
                onKids={(children) => setEdits((e) => ({ ...e, children }))}
              />
            </>
          ) : null}
        </View>
      )}
    </QueryView>
  );

  return (
    <SheetScreen
      title="When are you staying?"
      closeButton
      onClose={close}
      dock={
        form ? (
          <Dock>
            <Button onPress={confirm} isDisabled={range === null || choose.isPending || search.isPending}>
              {label}
            </Button>
          </Dock>
        ) : undefined
      }
    >
      {explore ? (
        <WhereField
          initial={searched.placeLabel ?? searched.q}
          searching={params.where}
          mode={searched.mode}
          onPick={pickWhere}
        >
          {body}
        </WhereField>
      ) : (
        body
      )}
    </SheetScreen>
  );
}

function Guests({
  adults,
  kids,
  maxAdults,
  onAdults,
  onKids,
}: {
  adults: number;
  kids: number;
  maxAdults: number;
  onAdults: (n: number) => void;
  onKids: (n: number) => void;
}) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between gap-3">
        <View className="shrink">
          <Text role="callout" strong>
            Adults
          </Text>
          <Text role="caption" tone="muted">
            Age 13+
          </Text>
        </View>
        <Stepper label="Adults" value={adults} onChange={onAdults} min={1} max={maxAdults} />
      </View>
      <View className="flex-row items-center justify-between gap-3">
        <View className="shrink">
          <Text role="callout" strong>
            Children
          </Text>
          <Text role="caption" tone="muted">
            Under 6 stay free
          </Text>
        </View>
        <Stepper label="Children" value={kids} onChange={onKids} min={0} max={MAX_CHILDREN} />
      </View>
    </View>
  );
}

function RoomChoices({
  data,
  roomId,
  onPick,
}: {
  data: DatesData;
  roomId: string | null;
  onPick: (roomId: string) => void;
}) {
  return (
    <View className="gap-2">
      {data.rooms.map((r) => (
        <Choice
          key={r.id}
          title={r.name}
          subtitle={r.detail}
          selected={r.id === roomId}
          onPress={() => onPick(r.id)}
          trailing={
            <Text role="callout" strong tabular>
              {rwf(r.priceRwf)}
            </Text>
          }
        />
      ))}
    </View>
  );
}

function DatesBones() {
  return (
    <LoadingView label="Loading dates">
      <LoadingBone className="h-12 rounded-2xl" />
      <LoadingBone className="h-5 w-2/5" />
      <LoadingBone className="h-72 rounded-3xl" />
      <LoadingBone className="h-12" />
    </LoadingView>
  );
}
