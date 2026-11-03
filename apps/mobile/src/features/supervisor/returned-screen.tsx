import { rnSpace } from "@injishi/design-tokens";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  Dock,
  Icon,
  ListGroup,
  LoadingBone,
  LoadingView,
  NavBar,
  Photo,
  Screen,
  Section,
  Text,
  Toast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useReturnedRoom, useUndoReturn } from "./data";
import type { ReturnedRoom } from "./types";
import { backTo, QueueRow } from "./ui";

/**
 * `sup-return`: the room went back to the housekeeper. It says exactly what she sees, offers an undo
 * for a minute, then moves Beatrice on to the next room in her queue.
 */
export function ReturnedScreen() {
  const { room } = useScreenParams("sup-return");
  const query = useReturnedRoom(room);
  const data = query.data;
  return (
    <Screen
      header={<NavBar title="" onBack={() => backTo("sup-queue")} />}
      dock={data ? <ReturnedDock returned={data} /> : undefined}
    >
      <QueryView query={query} data={data} loading={<ReturnedLoading />}>
        {(returned) => <Returned returned={returned} />}
      </QueryView>
    </Screen>
  );
}

const inspect = (room: string) => router.replace(href("sup-inspect", { room }));

function Returned({ returned }: { returned: ReturnedRoom }) {
  return (
    <View>
      <View className="items-center gap-4 px-6 pt-1.5">
        <Card tone="danger" padding="none" className="size-24">
          <View className="flex-1 items-center justify-center">
            <Icon name="ArrowUturnCcwLeft" size={40} />
          </View>
        </Card>
        <View className="items-center gap-2">
          <Text role="title1" className="text-center">
            {returned.title}
          </Text>
          <Text role="body" tone="muted" className="text-center">
            {returned.body}
          </Text>
        </View>
      </View>
      {returned.seen.length > 0 ? (
        <Card className="mx-4 mt-5">
          <Text role="micro" caps strong tone="muted">
            What she sees
          </Text>
          <View className="mt-2 gap-3">
            {returned.seen.map((item) => (
              <View key={item.id} className="flex-row items-start gap-3">
                {item.photo ? <Photo source={item.photo} width={rnSpace[16]} height={rnSpace[16]} radius="md" /> : null}
                <View className="flex-1 gap-1">
                  <Text role="callout" strong>
                    {item.title}
                  </Text>
                  <Text role="callout" tone="muted">
                    {item.quote}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
      <Section title="Next in your queue" detail={`${returned.left} left`} />
      {returned.next ? (
        <ListGroup className="mx-4">
          <QueueRow item={returned.next} onPress={() => inspect(returned.next?.room ?? returned.room)} />
        </ListGroup>
      ) : (
        <Text role="callout" tone="muted" className="px-4">
          Nothing else waits for you on this floor.
        </Text>
      )}
    </View>
  );
}

/** Seconds left on the undo, ticking once a second until it runs out. */
function useSecondsLeft(until: number): number {
  const [now, setNow] = useState(() => Date.now());
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (left <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [left]);
  return left;
}

function ReturnedDock({ returned }: { returned: ReturnedRoom }) {
  const undo = useUndoReturn();
  const left = useSecondsLeft(returned.undoUntil);
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <View>
      {left > 0 ? (
        <View className="px-4 pb-3">
          <Toast
            icon="ArrowUturnCcwLeft"
            message="Returned · not sellable"
            action={{
              label: `Undo · ${clock}`,
              onPress: () => undo.mutate(returned.room, { onSuccess: () => inspect(returned.room) }),
            }}
          />
        </View>
      ) : null}
      <Dock>
        {returned.next ? (
          <Button icon="CheckDouble" onPress={() => inspect(returned.next?.room ?? returned.room)}>
            {`Inspect ${returned.next.room}`}
          </Button>
        ) : (
          <Button variant="secondary" onPress={() => router.dismissTo(href("sup-queue"))}>
            Back to the queue
          </Button>
        )}
      </Dock>
    </View>
  );
}

function ReturnedLoading() {
  return (
    <LoadingView label="Loading the returned room" className="items-center px-4 pt-2">
      <LoadingBone className="size-24 rounded-4xl" />
      <LoadingBone className="h-8 w-64" />
      <LoadingBone className="h-12 w-72" />
      <LoadingBone className="h-28 self-stretch rounded-3xl" />
      <LoadingBone className="h-16 self-stretch rounded-3xl" />
    </LoadingView>
  );
}
