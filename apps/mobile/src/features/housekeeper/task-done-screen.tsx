import { router } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Card,
  Dock,
  EmptyView,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  Section,
  Timeline,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useStartRoom, useTaskDone } from "./data";
import type { TaskDoneView } from "./types";
import { Bones, backOr, ListBones, openTab, RoomList, StateHero, TextLink } from "./ui";

/**
 * `hk-task-done`: the room is clean. It shows what happens next (Clean, then Inspected, then Ready) and
 * hands her straight to the next room.
 */
export function TaskDoneScreen() {
  const { room } = useScreenParams("hk-task-done");
  const query = useTaskDone(room);
  const startRoom = useStartRoom();
  const done = query.data;

  const startNext = (next: string) => {
    startRoom.mutate(next);
    router.replace(href("hk-task", { room: next }));
  };

  return (
    <Screen
      header={<NavBar title="" onBack={() => backOr(href("hk-today"))} />}
      dock={done ? <DoneDock done={done} onStart={startNext} /> : undefined}
    >
      <QueryView query={query} data={done} loading={<DoneLoading />}>
        {(view) =>
          view ? (
            <DoneBody done={view} />
          ) : (
            <EmptyView
              icon="LayoutCells"
              title={`Room ${room} is not on your list`}
              body="Your rooms and their state are in My rooms."
              action={{ label: "My rooms", icon: "LayoutCells", onPress: () => openTab(href("hk-rooms")) }}
            />
          )
        }
      </QueryView>
    </Screen>
  );
}

function DoneDock({ done, onStart }: { done: TaskDoneView | null; onStart: (room: string) => void }) {
  const next = done?.next;
  if (!next) {
    return (
      <Dock>
        <Button icon="House" onPress={() => openTab(href("hk-today"))}>
          Back to today
        </Button>
      </Dock>
    );
  }
  return (
    <Dock>
      <Button icon="CirclePlay" onPress={() => onStart(next.room)}>
        {`Start cleaning ${next.room}`}
      </Button>
      <TextLink label="Back to today" onPress={() => openTab(href("hk-today"))} />
    </Dock>
  );
}

function DoneBody({ done }: { done: TaskDoneView }) {
  const cleaned = [
    done.at,
    `${done.checks.done} of ${done.checks.total} checks`,
    done.minibarSent ? "minibar sent" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <View>
      <StateHero
        icon="CircleCheck"
        tone="success"
        title={`${done.room} is clean`}
        body={`Cleaned in ${done.minutes} minute${done.minutes === 1 ? "" : "s"}. Sent to front desk at ${done.at}.`}
      />
      <Card className="mx-4 mt-5">
        <Timeline
          steps={[
            { title: "Cleaned by you", detail: cleaned, state: "done" },
            {
              title: "Inspection by Beatrice",
              detail: "Required before the room can be sold",
              state: "now",
              icon: "CheckDouble",
            },
            {
              title: "Ready for front desk",
              detail: "Front desk sees Clean, not Ready, until then",
              state: "todo",
              icon: "House",
            },
          ]}
        />
      </Card>
      {done.next ? (
        <>
          <Section title="Up next" detail={`${done.left} to go`} />
          <RoomList lines={[done.next]} onOpen={(next) => router.replace(href("hk-task", { room: next }))} />
        </>
      ) : (
        <Section title="That was your last room" detail="Well done" />
      )}
    </View>
  );
}

function DoneLoading() {
  return (
    <LoadingView label="Loading">
      <View className="items-center gap-3">
        <LoadingBone className="size-24 rounded-3xl" />
        <LoadingBone className="h-8 w-48" />
        <LoadingBone className="h-4 w-64" />
      </View>
      <Bones>
        <LoadingBone className="h-44 rounded-3xl" />
        <LoadingBone className="mt-3 h-5 w-24" />
        <ListBones rows={1} />
      </Bones>
    </LoadingView>
  );
}
