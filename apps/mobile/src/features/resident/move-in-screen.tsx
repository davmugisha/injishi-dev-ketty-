import { View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Dock,
  Icon,
  LoadingBone,
  metrics,
  NavBar,
  Photo,
  PressArea,
  Screen,
  StepBar,
  Text,
  TileGrid,
  Timeline,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useMoveIn, usePhotographRoom } from "./data";
import type { MoveInRoom, MoveInView } from "./types";
import { backOr, CardBone, Skeleton, useNotify } from "./ui";

/**
 * `res-movein` (R4): the journey of a newly invited resident moving into unit C-04. A tracker
 * (invitation, ID and lease, payment), then room by room photos that later protect the deposit.
 * Photographing a room ticks it off and moves on to the next; with every room done, the keys are next.
 */
export function MoveInScreen() {
  const query = useMoveIn();
  const photograph = usePhotographRoom();
  const notify = useNotify();
  const view = query.data;
  const next = view?.next;

  const shoot = (room: MoveInRoom) =>
    photograph.mutate(room.id, {
      onSuccess: () => notify.done(`${room.name} photographed and saved`, "Camera"),
      onError: notify.failed,
    });

  return (
    <Screen
      header={<NavBar title="Moving in" subtitle={view?.unit} onBack={() => backOr(href("res-me"))} />}
      dock={
        view ? (
          <Dock note={next ? undefined : "Solange has every room. Collect your keys and gate card on Sun 1 Nov."}>
            {next ? (
              <Button size="lg" icon="Camera" isDisabled={photograph.isPending} onPress={() => shoot(next)}>
                {`Photograph ${next.name}`}
              </Button>
            ) : (
              <Button size="lg" variant="secondary" icon="CircleCheck" onPress={() => backOr(href("res-me"))}>
                Every room is done
              </Button>
            )}
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} data={view} loading={<MoveInSkeleton />}>
        {(data) => <Journey view={data} onShoot={shoot} />}
      </QueryView>
    </Screen>
  );
}

function Journey({ view, onShoot }: { view: MoveInView; onShoot: (room: MoveInRoom) => void }) {
  return (
    <View className="gap-4 px-4">
      <StepBar total={view.total} step={view.step} />
      <Card>
        <Timeline steps={view.steps} />
      </Card>
      <View className="flex-row items-baseline justify-between gap-3">
        <Text role="headline">{`Rooms · ${view.done} of ${view.rooms.length} done`}</Text>
        <Text role="caption" tone="muted">
          Walls, floor, fittings
        </Text>
      </View>
      <TileGrid columns={3}>
        {view.rooms.map((room) => (
          <RoomTile key={room.id} room={room} onShoot={() => onShoot(room)} />
        ))}
      </TileGrid>
    </View>
  );
}

/** `.rx-room`: a room's first photo and its count, or a camera or plus waiting for photos. */
function RoomTile({ room, onShoot }: { room: MoveInRoom; onShoot: () => void }) {
  const now = room.state === "now";
  const label = room.state === "done" ? `${room.photos} photos` : now ? "Next" : "To do";
  const frame = now ? "border-2 border-accent" : "border border-separator";
  const tile = (
    <View className={`overflow-hidden rounded-2xl bg-surface ${frame}`}>
      {room.photo ? (
        <Photo
          source={room.photo}
          height={metrics.photo.thumb}
          radius="none"
          topRight={<Chip variant="glass" icon="Camera" label={String(room.photos)} />}
        />
      ) : (
        <View
          className={`items-center justify-center border-b border-dashed border-border ${now ? "bg-accent-soft" : "bg-surface-secondary"}`}
          style={{ height: metrics.photo.thumb }}
        >
          <Icon name={now ? "Camera" : "Plus"} size={32} tone={now ? "accent" : "muted"} />
        </View>
      )}
      <View className="px-2 pb-2 pt-1.5">
        <Text role="caption" strong numberOfLines={1}>
          {room.name}
        </Text>
        <Text role="micro" tone={now ? "accent" : "muted"}>
          {label}
        </Text>
      </View>
    </View>
  );
  if (room.state === "done") {
    return (
      <View accessible accessibilityLabel={`${room.name}, ${label}`}>
        {tile}
      </View>
    );
  }
  return (
    <PressArea onPress={onShoot} accessibilityLabel={`Photograph ${room.name}`} className="overflow-hidden rounded-2xl">
      {tile}
    </PressArea>
  );
}

function MoveInSkeleton() {
  return (
    <Skeleton label="Loading your move-in">
      <LoadingBone className="h-1 rounded-full" />
      <CardBone size="lg" />
      <LoadingBone className="h-5 w-2/5" />
      <View className="flex-row gap-2.5">
        <LoadingBone className="h-28 flex-1 rounded-2xl" />
        <LoadingBone className="h-28 flex-1 rounded-2xl" />
        <LoadingBone className="h-28 flex-1 rounded-2xl" />
      </View>
    </Skeleton>
  );
}
