import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  LoadingBone,
  LoadingView,
  RoomCell,
  RoomGrid,
  Screen,
  ScreenHeader,
  Section,
  Segmented,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useRack } from "./data";
import type { DeskRack, RackNight, RackTent } from "./types";

const NIGHTS: readonly RackNight[] = ["tonight", "tomorrow", "thu"];
const isNight = (value: string | undefined): value is RackNight => NIGHTS.includes(value as RackNight);

/**
 * `desk-rooms`: all 18 tents on one screen, the state in words and colour, arrivals dashed; tonight,
 * tomorrow and Thursday at a tap. An arriving tent opens its guest, a tent being left its bill.
 */
export function RoomsScreen() {
  // A link may name the night (`?night=tomorrow`); the segments change it from there.
  const { night: linked } = useScreenParams("desk-rooms");
  const [night, setNight] = useState<RackNight>(isNight(linked) ? linked : "tonight");
  const query = useRack(night);
  const rack = query.data;
  return (
    <Screen>
      <ScreenHeader title="Tents" subtitle={rack?.subtitle} />
      <View className="px-4">
        <Segmented
          label="Night"
          options={rack?.nights ?? [{ value: "tonight", label: "Tonight" }]}
          value={night}
          onChange={setNight}
        />
      </View>
      <QueryView query={query} data={rack} loading={<RackSkeleton />}>
        {(r) => <Rack rack={r} />}
      </QueryView>
    </Screen>
  );
}

/** `.mx-legend`: what each look means, so the colour is never the only cue. */
const LEGEND = [
  { key: "occupied", label: "In house", swatch: "bg-surface-tertiary border border-border" },
  { key: "arriving", label: "Arriving", swatch: "border-2 border-dashed border-accent" },
  { key: "ready", label: "Ready", swatch: "bg-success-soft" },
  { key: "dirty", label: "Dirty", swatch: "bg-warning-soft" },
  { key: "blocked", label: "Blocked", swatch: "bg-danger-soft" },
] as const;

function Rack({ rack }: { rack: DeskRack }) {
  return (
    <>
      <View className="mt-3 flex-row flex-wrap gap-x-3 gap-y-1.5 px-4" accessible accessibilityLabel="Legend">
        {LEGEND.map((item) => (
          <View key={item.key} className="flex-row items-center gap-1.5">
            <View className={`size-2.5 rounded-sm ${item.swatch}`} />
            <Text role="caption" tone="muted" maxScale={1.5}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
      {rack.groups.map((group) => (
        <Section key={group.key} title={group.title} className="px-4">
          <RoomGrid>
            {group.tents.map((tent) => (
              <Tent key={tent.id} tent={tent} />
            ))}
          </RoomGrid>
        </Section>
      ))}
    </>
  );
}

function Tent({ tent }: { tent: RackTent }) {
  const opens = tent.opens;
  const onPress = !opens
    ? undefined
    : opens.to === "arrival"
      ? () => router.push(href("desk-arrival", { guest: opens.stayId }))
      : () => router.push(href("desk-checkout", { guest: opens.stayId }));
  return (
    <RoomCell
      room={tent.id}
      status={tent.status}
      note={tent.note}
      flag={tent.flag}
      flagLabel={tent.flagLabel}
      onPress={onPress}
    />
  );
}

const ROWS = ["first", "second"] as const;
const CELLS = ["a", "b", "c", "d"] as const;

function RackSkeleton() {
  return (
    <LoadingView label="Loading the tent rack" className="px-4 pt-4">
      <LoadingBone className="h-4 w-4/5" />
      <LoadingBone className="h-5 w-1/3" />
      {ROWS.map((row) => (
        <View key={row} className="flex-row gap-2">
          {CELLS.map((cell) => (
            <LoadingBone key={cell} className="h-20 flex-1 rounded-2xl" />
          ))}
        </View>
      ))}
      <LoadingBone className="h-5 w-1/3" />
      <LoadingBone className="h-20 rounded-2xl" />
    </LoadingView>
  );
}
