import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Avatar,
  Banner,
  Button,
  Dock,
  goBack,
  ListGroup,
  LoadingBone,
  LoadingView,
  metrics,
  PressArea,
  Radio,
  SheetScreen,
  StatusPill,
  Text,
  Toggle,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useRoomSheet, useRushRoom } from "./data";
import type { Person, RoomSheet } from "./types";

/**
 * `sup-room`, a sheet over the floor board: rush a room for its housekeeper, or hand it to someone
 * with capacity. One tap, and the housekeeper gets a push.
 */
export function RoomScreen() {
  const { room } = useScreenParams("sup-room");
  const query = useRoomSheet(room);
  const sheet = query.data;
  // Who takes it and whether it goes first; until she picks, what the room has now.
  const [pick, setPick] = useState<string | null>(null);
  const [next, setNext] = useState(true);
  const chosen = pick ?? sheet?.assignee ?? sheet?.people[0]?.id ?? null;
  return (
    <SheetScreen dock={sheet ? <RoomDock sheet={sheet} chosen={chosen} next={next} /> : undefined}>
      <QueryView query={query} data={sheet} loading={<RoomLoading />}>
        {(data) => <RoomBody sheet={data} chosen={chosen} onPick={setPick} next={next} onNext={setNext} />}
      </QueryView>
    </SheetScreen>
  );
}

function RoomBody({
  sheet,
  chosen,
  onPick,
  next,
  onNext,
}: {
  sheet: RoomSheet;
  chosen: string | null;
  onPick: (id: string) => void;
  next: boolean;
  onNext: (on: boolean) => void;
}) {
  const owner = sheet.people.find((p) => p.id === chosen);
  return (
    <View className="gap-4">
      <View className="gap-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text role="title2">{`Room ${sheet.room}`}</Text>
          <StatusPill status={sheet.status} label={sheet.statusLabel} />
        </View>
        <Text role="callout" tone="muted">
          {sheet.subtitle}
        </Text>
      </View>
      {sheet.notice ? (
        <Banner tone={sheet.notice.tone} icon={sheet.notice.icon} title={sheet.notice.title} body={sheet.notice.body} />
      ) : null}
      {sheet.mode === "assign" ? (
        <>
          <View className="gap-2">
            <Text role="micro" caps strong tone="muted">
              Who cleans it
            </Text>
            <ListGroup>
              {sheet.people.map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  selected={person.id === chosen}
                  onPress={() => onPick(person.id)}
                />
              ))}
            </ListGroup>
          </View>
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-0.5">
              <Text role="headline">Clean it next</Text>
              <Text role="caption" tone="muted">
                {`Moves ${sheet.room} to the top of ${owner ? `${owner.name.split(" ")[0]}'s` : "her"} list`}
              </Text>
            </View>
            <Toggle value={next} onValueChange={onNext} label="Clean it next" />
          </View>
        </>
      ) : null}
    </View>
  );
}

/** `.sx-mem` with a radio: one housekeeper who can take the room, how far along she is. */
function PersonRow({ person, selected, onPress }: { person: Person; selected: boolean; onPress: () => void }) {
  return (
    <PressArea
      onPress={onPress}
      feedback="native"
      accessibilityRole="radio"
      accessibilityLabel={`${person.name}, ${person.line}`}
      accessibilityState={{ checked: selected }}
      className="overflow-hidden"
    >
      <View className="flex-row items-center gap-3 px-3.5 py-3" style={{ minHeight: metrics.rowMin }}>
        <Avatar size="s" source={person.photo} initials={person.initials} />
        <View className="flex-1 gap-0.5">
          <Text role="headline">{person.name}</Text>
          <Text role="caption" tone="muted">
            {person.line}
          </Text>
        </View>
        <Radio selected={selected} />
      </View>
    </PressArea>
  );
}

function RoomDock({ sheet, chosen, next }: { sheet: RoomSheet; chosen: string | null; next: boolean }) {
  const rush = useRushRoom();
  const toast = useToast();
  if (sheet.mode === "inspect")
    return (
      <Dock note="It stays Clean, not Ready, until you inspect it.">
        <Button icon="CheckDouble" onPress={() => router.dismissTo(href("sup-inspect", { room: sheet.room }))}>
          {`Inspect ${sheet.room}`}
        </Button>
      </Dock>
    );
  if (sheet.mode === "done")
    return (
      <Dock>
        <Button variant="secondary" onPress={goBack}>
          Close
        </Button>
      </Dock>
    );
  const person = sheet.people.find((p) => p.id === chosen);
  const first = person?.name.split(" ")[0] ?? "her";
  const handover = chosen !== sheet.assignee;
  const idle = !handover && !next;
  // A blocked room is cleaned first once maintenance hands it back; any other, now.
  const when =
    sheet.status === "blocked" ? " once maintenance releases it" : sheet.arrival ? `, arrival ${sheet.arrival}` : "";
  const note = idle
    ? "Turn on Clean it next, or pick someone else."
    : handover
      ? `${first} gets a push now: "${sheet.room} is yours${next ? `, clean it next${when}` : ""}".`
      : `${first} gets a push now: "${sheet.room} next${when}".`;
  const submit = () => {
    if (!chosen) return;
    rush.mutate(
      { room: sheet.room, to: chosen, next },
      {
        onSuccess: ({ message }) => {
          toast.show({ icon: handover ? "ArrowRightArrowLeft" : "Thunderbolt", message, haptic: "success" });
          router.dismissTo(href("sup-floor"));
        },
      },
    );
  };
  return (
    <Dock note={note}>
      {handover ? (
        <Button icon="ArrowRightArrowLeft" onPress={submit} isDisabled={rush.isPending}>
          {`Give ${sheet.room} to ${first}`}
        </Button>
      ) : (
        <Button variant="danger" icon="Thunderbolt" onPress={submit} isDisabled={idle || rush.isPending}>
          {`Rush ${sheet.room} for ${first}`}
        </Button>
      )}
    </Dock>
  );
}

function RoomLoading() {
  return (
    <LoadingView label="Loading the room">
      <View className="gap-2">
        <LoadingBone className="h-7 w-40" />
        <LoadingBone className="h-4 w-60" />
      </View>
      <LoadingBone className="h-16 rounded-2xl" />
      <LoadingBone className="h-3 w-24" />
      <LoadingBone className="h-48 rounded-3xl" />
      <LoadingBone className="h-12 rounded-2xl" />
    </LoadingView>
  );
}
