import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  IconButton,
  Icon,
  LoadingBone,
  LoadingView,
  metrics,
  PressArea,
  RoomCell,
  RoomGrid,
  Screen,
  ScreenHeader,
  Section,
  Segmented,
  Text,
  type TextTone,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useFloorBoard } from "./data";
import type { CountStatus, FloorBoard, FloorCell, FloorCount, FloorId } from "./types";

/** Each count's tint and its words (`.sx-count`): the board's own status colours, always with the word. */
const COUNT_LOOK: Record<CountStatus, { root: string; tone: TextTone }> = {
  dirty: { root: "bg-warning-soft", tone: "warning" },
  cleaning: { root: "bg-info-soft", tone: "info" },
  clean: { root: "bg-accent-soft", tone: "accent" },
  ready: { root: "bg-success-soft", tone: "success" },
  blocked: { root: "bg-danger-soft", tone: "danger" },
};

/**
 * `sup-floor`, S5: the live board of Beatrice's floor. Counts by status on top (each one filters the
 * grid), the rush alert when front desk moves an arrival, then the rooms, arrivals first.
 */
export function FloorScreen() {
  const [floor, setFloor] = useState<FloorId>("2");
  const [filter, setFilter] = useState<CountStatus | null>(null);
  const query = useFloorBoard(floor);
  return (
    <Screen>
      <QueryView query={query} data={query.data} loading={<FloorLoading />}>
        {(board) => (
          <Board
            board={board}
            filter={filter}
            onFloor={(next) => {
              setFloor(next);
              setFilter(null);
            }}
            onFilter={(status) => setFilter((now) => (now === status ? null : status))}
          />
        )}
      </QueryView>
    </Screen>
  );
}

function openCell(cell: FloorCell) {
  if (cell.opens === "queue") router.navigate(href("sup-queue"));
  else router.push(href("sup-room", { room: cell.room }));
}

function Board({
  board,
  filter,
  onFloor,
  onFilter,
}: {
  board: FloorBoard;
  filter: CountStatus | null;
  onFloor: (floor: FloorId) => void;
  onFilter: (status: CountStatus) => void;
}) {
  const chosen = filter ? board.counts.find((c) => c.status === filter) : undefined;
  const all = [...board.arrivals, ...board.others];
  const shown = filter ? all.filter((c) => c.status === filter) : [];
  return (
    <View>
      <ScreenHeader
        eyebrow={board.eyebrow}
        title={board.title}
        onTitlePress={() => router.push(href("shared-switcher"))}
        titleActionLabel="Switch place or role"
        right={
          <IconButton
            icon="Bell"
            label="Notifications"
            variant="surface"
            dot
            onPress={() => router.push(href("shared-notifs", undefined, { app: "supervisor" }))}
          />
        }
      />
      <View className="px-4">
        <Segmented label="Floor" options={board.floors} value={board.floor} onChange={onFloor} />
      </View>
      <View className="mt-3 flex-row gap-1.5 px-4">
        {board.counts.map((count) => (
          <CountTile
            key={count.status}
            count={count}
            selected={filter === count.status}
            dimmed={filter !== null && filter !== count.status}
            onPress={() => onFilter(count.status)}
          />
        ))}
      </View>
      {board.alert ? <RushAlert alert={board.alert} /> : null}
      {chosen ? (
        <>
          <Section
            title={`${chosen.label} rooms`}
            detail={`${shown.length} of ${all.length}`}
            action={{ label: "Show all", onPress: () => onFilter(chosen.status) }}
          />
          {shown.length > 0 ? (
            <Grid cells={shown} />
          ) : (
            <Text role="callout" tone="muted" className="px-4">
              {`No ${chosen.label.toLowerCase()} rooms on ${board.title} right now.`}
            </Text>
          )}
        </>
      ) : (
        <>
          {board.arrivals.length > 0 ? (
            <>
              <Section title="Arrivals first" detail={board.arrivalsNote} />
              <Grid cells={board.arrivals} />
            </>
          ) : null}
          <Section title="No arrival today" detail={board.othersNote} />
          <Grid cells={board.others} />
        </>
      )}
      {board.waiting > 0 ? (
        <View className="mt-4 px-4">
          <Button icon="CheckDouble" onPress={() => router.navigate(href("sup-queue"))}>
            {`Inspect ${board.waiting} waiting room${board.waiting === 1 ? "" : "s"}`}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

function Grid({ cells }: { cells: readonly FloorCell[] }) {
  return (
    <RoomGrid className="px-4">
      {cells.map((cell) => (
        <RoomCell
          key={cell.room}
          room={cell.room}
          status={cell.status}
          note={cell.note}
          flag={cell.flag}
          flagLabel={cell.flagLabel}
          onPress={() => openCell(cell)}
        />
      ))}
    </RoomGrid>
  );
}

/** `.sx-count > div`: one status's count on its tint; pressing it shows only those rooms. */
function CountTile({
  count,
  selected,
  dimmed,
  onPress,
}: {
  count: FloorCount;
  selected: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const look = COUNT_LOOK[count.status];
  return (
    <PressArea
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${count.count} ${count.label}`}
      accessibilityHint={selected ? "Shows every room again" : `Shows only the ${count.label.toLowerCase()} rooms`}
      accessibilityState={{ selected }}
      className="flex-1"
    >
      <View
        className={`items-center rounded-2xl px-1 py-2 ${look.root} ${dimmed ? "opacity-40" : ""}`}
        style={{ minHeight: metrics.touch }}
      >
        <Text role="title2" tabular tone={look.tone}>
          {String(count.count)}
        </Text>
        <Text role="micro" strong tone={look.tone} numberOfLines={1}>
          {count.label}
        </Text>
      </View>
    </PressArea>
  );
}

/** `.card.tint-bad`: front desk moved an arrival onto a room that is not ready. */
function RushAlert({ alert }: { alert: NonNullable<FloorBoard["alert"]> }) {
  const open = () => router.push(href("sup-room", { room: alert.room }));
  return (
    <Card tone="danger" padding="sm" className="mx-4 mt-3">
      <View className="flex-row items-center gap-3">
        <Icon name="Thunderbolt" size={24} />
        <View className="flex-1 gap-0.5">
          <Text role="callout" strong>
            {alert.title}
          </Text>
          <Text role="caption" tone="muted">
            {alert.body}
          </Text>
        </View>
        <Button size="sm" variant="danger" onPress={open} accessibilityLabel={`Rush room ${alert.room}`}>
          Rush
        </Button>
      </View>
    </Card>
  );
}

function FloorLoading() {
  return (
    <LoadingView label="Loading the floor board" className="px-4 pt-2">
      <View className="gap-2">
        <LoadingBone className="h-3 w-32" />
        <LoadingBone className="h-7 w-28" />
      </View>
      <LoadingBone className="h-12 rounded-2xl" />
      <View className="flex-row gap-1.5">
        {COUNT_BONES.map((key) => (
          <LoadingBone key={key} className="h-14 flex-1 rounded-2xl" />
        ))}
      </View>
      <LoadingBone className="h-16 rounded-3xl" />
      <LoadingBone className="h-4 w-36" />
      {GRID_ROWS.map((row) => (
        <View key={row} className="flex-row gap-2">
          {GRID_COLUMNS.map((column) => (
            <LoadingBone key={column} className="flex-1 rounded-2xl" style={{ height: metrics.roomCell }} />
          ))}
        </View>
      ))}
    </LoadingView>
  );
}

const COUNT_BONES = ["dirty", "cleaning", "clean", "ready", "blocked"] as const;
const GRID_ROWS = ["a", "b", "c"] as const;
const GRID_COLUMNS = ["1", "2", "3", "4"] as const;
