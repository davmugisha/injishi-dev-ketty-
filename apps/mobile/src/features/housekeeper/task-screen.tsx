import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Dock,
  EmptyView,
  IconButton,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  metrics,
  NavBar,
  OfflineBar,
  PressArea,
  ProgressBar,
  Screen,
  Section,
  Stepper,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useFinishRoom, useSetCheck, useSetMinibar, useTask, useToggleTimer } from "./data";
import type { CheckItem, MinibarItem, TaskView } from "./types";
import { Bones, backOr, clockWords, ListBones, openScreen, openTab, TextLink, useTicker } from "./ui";

/**
 * `hk-task`: a room being cleaned. The checklist, the timer and the minibar count keep working with no
 * signal (every tick waits on the phone); skipped checks are allowed, and Beatrice sees them.
 */
export function TaskScreen() {
  const { room } = useScreenParams("hk-task");
  const query = useTask(room);
  const finish = useFinishRoom();
  const task = query.data;

  const markClean = () =>
    finish.mutate(room, { onSuccess: () => router.replace(href("hk-task-done", { room })) });

  return (
    <Screen
      header={
        <NavBar
          title={`Room ${room}`}
          subtitle={task?.subtitle}
          onBack={() => backOr(href("hk-today"))}
          right={
            <IconButton
              icon="TriangleExclamation"
              label="Report a problem"
              variant="plain"
              onPress={() => openScreen(href("hk-report"))}
            />
          }
        />
      }
      dock={task ? <TaskDock task={task} busy={finish.isPending} onMarkClean={markClean} /> : undefined}
    >
      <QueryView query={query} data={task} loading={<TaskLoading />}>
        {(view) =>
          view ? (
            <TaskBody task={view} />
          ) : (
            <EmptyView
              icon="LayoutCells"
              title={`Room ${room} is not on your list`}
              body="Open a room from My rooms to clean it."
              action={{ label: "My rooms", icon: "LayoutCells", onPress: () => openTab(href("hk-rooms")) }}
            />
          )
        }
      </QueryView>
    </Screen>
  );
}

function counts(task: TaskView): { done: number; total: number } {
  const all = task.groups.flatMap((g) => g.items);
  return { done: all.filter((item) => item.done).length, total: all.length };
}

function TaskDock({ task, busy, onMarkClean }: { task: TaskView; busy: boolean; onMarkClean: () => void }) {
  if (task.cleaned) {
    return (
      <Dock note="Beatrice inspects it before front desk can sell it.">
        <Button variant="secondary" icon="LayoutCells" onPress={() => openTab(href("hk-rooms"))}>
          Back to my rooms
        </Button>
      </Dock>
    );
  }
  const { done, total } = counts(task);
  const left = total - done;
  const note =
    left > 0
      ? `${left} check${left === 1 ? "" : "s"} left. Beatrice sees anything you skip when she inspects.`
      : "Every check done. Beatrice inspects it next.";
  return (
    <Dock note={note}>
      <Button icon="CircleCheck" isDisabled={busy} onPress={onMarkClean}>
        {`Mark ${task.room} clean`}
      </Button>
    </Dock>
  );
}

function TaskBody({ task }: { task: TaskView }) {
  const { done, total } = counts(task);
  return (
    <View>
      {task.offline ? <OfflineBar message={task.offline} /> : null}
      {task.cleaned ? (
        <Banner
          tone="success"
          className="mx-4 mt-3"
          title="Clean, waiting for Beatrice"
          body="It shows Ready to front desk once she has inspected it."
        />
      ) : null}
      <TimerCard task={task} />
      <View className="mt-3 px-4">
        <View className="flex-row items-center justify-between gap-3">
          <Text role="callout" strong>
            {`${done} of ${total} checks`}
          </Text>
          {task.arrival ? (
            <Text role="callout" tone="muted">
              {task.arrival}
            </Text>
          ) : null}
        </View>
        <ProgressBar value={total ? (done / total) * 100 : 0} label="Checks done" className="mt-2" />
      </View>
      {task.groups.map((group) => {
        const groupDone = group.items.filter((item) => item.done).length;
        return (
          <View key={group.key}>
            <Section title={group.title} detail={`${groupDone} of ${group.items.length}`} />
            <ListGroup className="mx-4">
              {group.items.map((item) => (
                <CheckRow key={item.id} room={task.room} item={item} />
              ))}
            </ListGroup>
          </View>
        );
      })}
      <Minibar room={task.room} items={task.minibar} />
      <View className="mt-3 flex-row gap-2.5 px-4">
        <Button
          variant="outline"
          icon="Magnifier"
          className="flex-1"
          onPress={() => router.push(href("hk-found", { room: task.room }))}
        >
          Found an item
        </Button>
        <Button
          variant="outline"
          icon="TriangleExclamation"
          className="flex-1"
          onPress={() => openScreen(href("hk-report"))}
        >
          Problem
        </Button>
      </View>
    </View>
  );
}

function TimerCard({ task }: { task: TaskView }) {
  const toggle = useToggleTimer();
  const now = useTicker(task.timer.running);
  const running = task.timer.running;
  const elapsed = task.timer.seconds + (running ? Math.max(0, now - task.timer.readAt) / 1000 : 0);
  return (
    <Card className="mx-4 mt-3">
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text role="micro" tone="muted" caps strong>
            {running || elapsed === 0 ? "Time in room" : "Time in room · paused"}
          </Text>
          <Text role="title1" tabular className="mt-1" accessibilityLabel={`Time in room ${clockWords(elapsed)}`}>
            {clockWords(elapsed)}
          </Text>
          <Text role="caption" tone="muted" className="mt-1">
            {task.usual}
          </Text>
        </View>
        {task.cleaned ? null : (
          <IconButton
            icon={running ? "CirclePause" : "CirclePlay"}
            label={running ? "Pause the clock" : "Start the clock"}
            variant="surface"
            onPress={() => toggle.mutate(task.room)}
          />
        )}
      </View>
    </Card>
  );
}

function CheckRow({ room, item }: { room: string; item: CheckItem }) {
  const setCheck = useSetCheck();
  return (
    <PressArea
      onPress={() => setCheck.mutate({ room, id: item.id, done: !item.done })}
      feedback="native"
      accessibilityRole="checkbox"
      accessibilityLabel={item.label}
      accessibilityState={{ checked: item.done }}
      className="overflow-hidden"
    >
      <View className="flex-row items-center gap-3 px-3.5 py-2" style={{ minHeight: metrics.rowMin }}>
        <Checkbox checked={item.done} />
        <Text role="callout" tone={item.done ? "muted" : "default"} className="flex-1">
          {item.label}
        </Text>
      </View>
    </PressArea>
  );
}

/** "Water × 2, soft drink × 1". */
function usedWords(items: readonly MinibarItem[]): string {
  return items
    .filter((m) => m.count > 0)
    .map((m, i) => `${i === 0 ? m.label : m.label.toLowerCase()} × ${m.count}`)
    .join(", ");
}

function Minibar({ room, items }: { room: string; items: MinibarItem[] }) {
  const [editing, setEditing] = useState(false);
  const setCount = useSetMinibar();
  const used = items.reduce((sum, m) => sum + m.count, 0);
  return (
    <>
      <Section title="Minibar" detail="Saved on phone" />
      <ListGroup className="mx-4">
        <ListItem
          icon="Box"
          title={used > 0 ? `${used} item${used === 1 ? "" : "s"} used` : "Nothing used"}
          subtitle={
            used > 0
              ? `${usedWords(items)} · front desk adds them to the bill`
              : "Count it before you leave · front desk adds it to the bill"
          }
          trailing={
            <TextLink
              label={editing ? "Done" : "Change"}
              accessibilityLabel={editing ? "Done counting the minibar" : "Change the minibar count"}
              onPress={() => setEditing((now) => !now)}
            />
          }
        />
        {editing
          ? items.map((m) => (
              <ListItem
                key={m.key}
                title={m.label}
                trailing={
                  <Stepper
                    label={`${m.label} used`}
                    value={m.count}
                    min={0}
                    max={9}
                    onChange={(count) => setCount.mutate({ room, key: m.key, count })}
                  />
                }
              />
            ))
          : null}
      </ListGroup>
    </>
  );
}

function TaskLoading() {
  return (
    <LoadingView label="Loading the room">
      <Bones>
        <LoadingBone className="h-10 rounded-xl" />
        <LoadingBone className="h-28 rounded-3xl" />
        <LoadingBone className="h-4 w-32" />
        <LoadingBone className="h-2 rounded-full" />
        <LoadingBone className="mt-3 h-5 w-24" />
        <ListBones rows={4} />
        <LoadingBone className="mt-3 h-5 w-24" />
        <ListBones rows={4} />
      </Bones>
    </LoadingView>
  );
}
