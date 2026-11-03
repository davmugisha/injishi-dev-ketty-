import { router } from "expo-router";
import { useRef, useState } from "react";
import { type ScrollViewInstance, View } from "react-native";
import {
  Card,
  EmptyView,
  FilterChips,
  Icon,
  IconButton,
  LoadingBone,
  LoadingView,
  Screen,
  ScreenHeader,
  Section,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useRooms } from "./data";
import type { RoomLine, RoomsView } from "./types";
import { Bones, ListBones, openTab, RoomList } from "./ui";

type Group = "todo" | "waiting" | "ready";

/**
 * `hk-rooms`: the whole list in cleaning order, then the rooms waiting for Beatrice's inspection, then
 * the rooms ready to sell, so Jeanne sees her work reach front desk. The chips count each group and jump
 * to it.
 */
export function RoomsScreen() {
  const query = useRooms();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offsets = useRef<Record<Group | "base", number>>({ base: 0, todo: 0, waiting: 0, ready: 0 });
  const [group, setGroup] = useState<Group>("todo");

  const jump = (next: Group) => {
    setGroup(next);
    // Each group is measured inside the list, which sits under the header.
    const y = offsets.current.base + offsets.current[next];
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  };

  return (
    <Screen scrollRef={scrollRef}>
      <ScreenHeader
        eyebrow={query.data?.eyebrow ?? "My floor"}
        title="My rooms"
        right={
          <IconButton
            icon="Bell"
            label="Notifications"
            variant="surface"
            dot
            onPress={() => router.push(href("shared-notifs"))}
          />
        }
      />
      <QueryView query={query} data={query.data} loading={<RoomsLoading />}>
        {(rooms) =>
          rooms.todo.length + rooms.waiting.length + rooms.ready.length === 0 ? (
            <EmptyView
              icon="LayoutCells"
              title="No rooms on your list yet"
              body="Beatrice gives out the rooms at the morning briefing. Yours show here, in the order to clean them."
              action={{ label: "Back to today", icon: "House", onPress: () => openTab(href("hk-today")) }}
            />
          ) : (
            <RoomGroups
              rooms={rooms}
              group={group}
              onJump={jump}
              onLayoutGroup={(g, y) => {
                offsets.current[g] = y;
              }}
            />
          )
        }
      </QueryView>
    </Screen>
  );
}

function open(room: string) {
  router.push(href("hk-task", { room }));
}

function RoomGroups({
  rooms,
  group,
  onJump,
  onLayoutGroup,
}: {
  rooms: RoomsView;
  group: Group;
  onJump: (group: Group) => void;
  onLayoutGroup: (group: Group | "base", y: number) => void;
}) {
  const options = [
    { value: "todo", label: `To do · ${rooms.todo.length}` },
    { value: "waiting", label: `Waiting check · ${rooms.waiting.length}` },
    { value: "ready", label: `Ready · ${rooms.ready.length}` },
  ] as const;
  return (
    <View onLayout={(e) => onLayoutGroup("base", e.nativeEvent.layout.y)}>
      <FilterChips label="Jump to rooms" options={options} value={group} onChange={onJump} />
      <View onLayout={(e) => onLayoutGroup("todo", e.nativeEvent.layout.y)}>
        <Section title="To do" detail="in this order" />
        <GroupList lines={rooms.todo} empty="Nothing left to clean. Well done." />
      </View>
      <View onLayout={(e) => onLayoutGroup("waiting", e.nativeEvent.layout.y)}>
        <Section title="Waiting for Beatrice" detail="Clean, not Ready" />
        <GroupList lines={rooms.waiting} empty="No room is waiting for inspection." />
      </View>
      <View onLayout={(e) => onLayoutGroup("ready", e.nativeEvent.layout.y)}>
        <Section title="Ready to sell" detail="Inspected" />
        <GroupList lines={rooms.ready} empty="Rooms show here once Beatrice has inspected them." />
      </View>
    </View>
  );
}

function GroupList({ lines, empty }: { lines: RoomLine[]; empty: string }) {
  if (lines.length > 0) return <RoomList lines={lines} onOpen={open} />;
  return (
    <Card tone="flat" padding="sm" className="mx-4">
      <View className="flex-row items-center gap-3">
        <Icon name="CircleCheck" tone="muted" />
        <Text role="callout" tone="muted" className="flex-1">
          {empty}
        </Text>
      </View>
    </Card>
  );
}

function RoomsLoading() {
  return (
    <LoadingView label="Loading your rooms">
      <View className="flex-row gap-2 px-4">
        <LoadingBone className="h-9 w-24 rounded-full" />
        <LoadingBone className="h-9 w-36 rounded-full" />
        <LoadingBone className="h-9 w-24 rounded-full" />
      </View>
      <Bones>
        <LoadingBone className="mt-2 h-5 w-24" />
        <ListBones rows={7} />
        <LoadingBone className="mt-2 h-5 w-40" />
        <ListBones rows={3} />
      </Bones>
    </LoadingView>
  );
}
