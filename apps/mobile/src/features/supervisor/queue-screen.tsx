import { router } from "expo-router";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  EmptyView,
  Icon,
  ListGroup,
  LoadingBone,
  LoadingView,
  Screen,
  ScreenHeader,
  Section,
  StatusPill,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useInspectionQueue } from "./data";
import type { InspectionQueue } from "./types";
import { QueueRow, RoomRow } from "./ui";

/**
 * `sup-queue`, S6: the rooms waiting for Beatrice's inspection, ordered by the next arrival, with how
 * long each has waited, then the rooms she has already passed today.
 */
export function QueueScreen() {
  const query = useInspectionQueue();
  return (
    <Screen>
      <QueryView query={query} data={query.data} loading={<QueueLoading />}>
        {(queue) => <Queue queue={queue} />}
      </QueryView>
    </Screen>
  );
}

const inspect = (room: string) => router.push(href("sup-inspect", { room }));
const toFloor = () => router.navigate(href("sup-floor"));

function Queue({ queue }: { queue: InspectionQueue }) {
  const first = queue.waiting[0];
  const header = (
    <ScreenHeader
      eyebrow={queue.eyebrow}
      title="Waiting for you"
      right={
        queue.waiting.length > 0 ? <Chip label={String(queue.waiting.length)} tone="accent" size="lg" /> : undefined
      }
    />
  );
  if (queue.waiting.length === 0 && queue.done.length === 0)
    return (
      <View className="flex-1">
        {header}
        <EmptyView
          icon="CheckDouble"
          title="Nothing to inspect"
          body="Rooms land here when a housekeeper marks them clean. They stay Clean, not Ready, until you inspect them."
          action={{ label: "See the floor", icon: "LayoutCells", onPress: toFloor }}
        />
      </View>
    );
  return (
    <View>
      {header}
      <Banner
        tone="info"
        className="mx-4"
        body="Rooms stay Clean, not Ready, until you inspect them. Front desk cannot give them out yet."
      />
      {first ? (
        <>
          <ListGroup className="mx-4 mt-3">
            {queue.waiting.map((item) => (
              <QueueRow key={item.room} item={item} onPress={() => inspect(item.room)} />
            ))}
          </ListGroup>
          <View className="mt-4 px-4">
            <Button icon="CheckDouble" onPress={() => inspect(first.room)}>
              {`Start with ${first.room}`}
            </Button>
          </View>
        </>
      ) : (
        <Card tone="success" className="mx-4 mt-3">
          <View className="flex-row items-center gap-3">
            <Icon name="CheckDouble" size={24} />
            <View className="flex-1 gap-0.5">
              <Text role="callout" strong>
                All inspected
              </Text>
              <Text role="caption">New rooms land here when a housekeeper marks them clean.</Text>
            </View>
          </View>
        </Card>
      )}
      {queue.done.length > 0 ? (
        <>
          <Section title="Done today" detail={queue.doneNote} />
          <ListGroup className="mx-4">
            {queue.done.map((item) => (
              <RoomRow
                key={item.room}
                room={item.room}
                title={item.title}
                detail={item.detail}
                trailing={<StatusPill status="ready" />}
                onPress={toFloor}
                accessibilityLabel={`Room ${item.room}, ${item.title}, ${item.detail}. Opens the floor board`}
              />
            ))}
          </ListGroup>
        </>
      ) : null}
    </View>
  );
}

function QueueLoading() {
  return (
    <LoadingView label="Loading the rooms waiting for you" className="px-4 pt-2">
      <View className="gap-2">
        <LoadingBone className="h-3 w-40" />
        <LoadingBone className="h-7 w-48" />
      </View>
      <LoadingBone className="h-16 rounded-2xl" />
      <LoadingBone className="h-52 rounded-3xl" />
      <LoadingBone className="h-14 rounded-full" />
      <LoadingBone className="h-4 w-32" />
      <LoadingBone className="h-36 rounded-3xl" />
    </LoadingView>
  );
}
