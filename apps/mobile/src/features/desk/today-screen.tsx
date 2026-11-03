import { router } from "expo-router";
import { View } from "react-native";
import {
  Avatar,
  Card,
  Chip,
  IconButton,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  PressArea,
  Screen,
  ScreenHeader,
  Section,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { protoImages } from "@/proto/images";
import { href } from "@/proto/screens";
import { useDeskToday } from "./data";
import type { ArrivalRow, DepartureRow, DeskCount, DeskToday } from "./types";
import { TimeBlock } from "./ui";

/**
 * `desk-today` (N2): a small lodge with no desk PC. Arrivals, departures, in house and free tents at
 * a glance, with each guest's balance shown before they reach the desk. The place name opens the
 * switcher; the bell opens the guest arriving now.
 */
export function TodayScreen() {
  const query = useDeskToday();
  return (
    <Screen>
      <QueryView query={query} data={query.data} loading={<TodaySkeleton />}>
        {(today) => <Today today={today} />}
      </QueryView>
    </Screen>
  );
}

function Today({ today }: { today: DeskToday }) {
  const { nextArrival, nextDeparture } = today;
  return (
    <>
      <ScreenHeader
        eyebrow={today.dateLine}
        title={today.place}
        onTitlePress={() => router.push(href("shared-switcher"))}
        titleActionLabel={`${today.place}, switch place`}
        left={<Avatar size="m" source={protoImages[today.placePhoto]} />}
        right={
          nextArrival ? (
            <IconButton
              icon="Bell"
              label="Guest arriving now"
              variant="surface"
              dot={today.hasNews}
              onPress={() => router.push(href("desk-arrival", { guest: nextArrival }))}
            />
          ) : null
        }
      />
      <View className="flex-row gap-2 px-4">
        <CountTile label="Arriving" count={today.arriving} />
        <CountTile
          label="Leaving"
          count={today.leaving}
          onPress={nextDeparture ? () => router.push(href("desk-checkout", { guest: nextDeparture })) : undefined}
        />
        <CountTile label="In house" count={today.inHouse} onPress={() => router.navigate(href("desk-rooms"))} />
        <CountTile label="Free" count={today.free} accent onPress={() => router.navigate(href("desk-walkin"))} />
      </View>
      <Section title="Arriving" />
      {today.arrivals.length > 0 ? (
        <ListGroup className="mx-4">
          {today.arrivals.map((row) => (
            <ArrivalItem key={row.stayId} row={row} />
          ))}
        </ListGroup>
      ) : (
        <Quiet>No arrivals today.</Quiet>
      )}
      <Section title="Leaving" />
      {today.departures.length > 0 ? (
        <ListGroup className="mx-4">
          {today.departures.map((row) => (
            <DepartureItem key={row.stayId} row={row} />
          ))}
        </ListGroup>
      ) : (
        <Quiet>Nobody checks out today.</Quiet>
      )}
    </>
  );
}

/** `.mx-sum > div`: a count, its name above and a quiet detail below; most open where they lead. */
function CountTile({
  label,
  count,
  accent = false,
  onPress,
}: {
  label: string;
  count: DeskCount;
  accent?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <View className="items-center rounded-2xl border border-separator bg-surface px-1.5 py-2.5">
      <Text role="caption" tone="muted" strong maxScale={1.5} numberOfLines={1}>
        {label}
      </Text>
      <Text role="title2" tabular tone={accent ? "accent" : undefined} maxScale={1.5}>
        {String(count.value)}
      </Text>
      <Text role="micro" tone="muted" numberOfLines={1}>
        {count.detail}
      </Text>
    </View>
  );
  const spoken = `${label}, ${count.value}, ${count.detail}`;
  if (!onPress) {
    return (
      <View className="flex-1" accessible accessibilityLabel={spoken}>
        {body}
      </View>
    );
  }
  return (
    <PressArea onPress={onPress} accessibilityLabel={spoken} className="flex-1 overflow-hidden rounded-2xl">
      {body}
    </PressArea>
  );
}

function ArrivalItem({ row }: { row: ArrivalRow }) {
  return (
    <ListItem
      leading={<TimeBlock time={row.time} label={row.timeLabel} />}
      title={row.name}
      subtitle={row.detail}
      trailing={<Chip label={row.tag.label} tone={row.tag.tone} />}
      accessibilityLabel={`${row.timeLabel} ${row.time}, ${row.name}, ${row.detail}, ${row.tag.label}`}
      onPress={() =>
        row.inHouse ? router.navigate(href("desk-rooms")) : router.push(href("desk-arrival", { guest: row.stayId }))
      }
    />
  );
}

function DepartureItem({ row }: { row: DepartureRow }) {
  return (
    <ListItem
      leading={<TimeBlock time={row.tent} label="Tent" />}
      title={row.name}
      subtitle={row.detail}
      trailing={<Chip label={row.tag.label} tone={row.tag.tone} />}
      accessibilityLabel={`Tent ${row.tent}, ${row.name}, ${row.detail}, ${row.tag.label}`}
      onPress={() => router.push(href("desk-checkout", { guest: row.stayId }))}
    />
  );
}

/** An empty list's one line, on the second surface where the list would be. */
function Quiet({ children }: { children: string }) {
  return (
    <Card tone="flat" className="mx-4">
      <Text role="callout" tone="muted">
        {children}
      </Text>
    </Card>
  );
}

const TILES = ["arriving", "leaving", "in-house", "free"] as const;

function TodaySkeleton() {
  return (
    <LoadingView label="Loading today at the lodge" className="px-4 pt-2">
      <View className="flex-row items-center gap-3">
        <LoadingBone className="size-10 rounded-full" />
        <View className="flex-1 gap-2">
          <LoadingBone className="h-3 w-2/5" />
          <LoadingBone className="h-6 w-3/4" />
        </View>
      </View>
      <View className="flex-row gap-2">
        {TILES.map((tile) => (
          <LoadingBone key={tile} className="h-20 flex-1 rounded-2xl" />
        ))}
      </View>
      <LoadingBone className="mt-2 h-5 w-1/4" />
      <LoadingBone className="h-72 rounded-3xl" />
      <LoadingBone className="mt-2 h-5 w-1/4" />
      <LoadingBone className="h-36 rounded-3xl" />
    </LoadingView>
  );
}
