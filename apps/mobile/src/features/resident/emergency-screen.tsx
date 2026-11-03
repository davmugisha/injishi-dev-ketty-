import { router } from "expo-router";
import { useState } from "react";
import { Linking, View } from "react-native";
import {
  Banner,
  Button,
  Choice,
  Icon,
  ListGroup,
  ListItem,
  LoadingBone,
  NavBar,
  PressArea,
  Screen,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useEmergency, useLogEmergencyCall } from "./data";
import type { EmergencyView } from "./types";
import { backOr, CardBone, Eyebrow, Fill, ListBone, Skeleton, useNotify } from "./ui";

/**
 * `res-emergency` (R2): a big call button before any form. Fire or injury points to 112. A call
 * made here is logged for management; then "tell us what happened" opens a repair request already
 * marked urgent, on that kind of problem.
 */
export function EmergencyScreen() {
  const query = useEmergency();
  return (
    <Screen header={<NavBar title="Emergency" onBack={() => backOr(href("res-requests"))} />}>
      <QueryView query={query} data={query.data} loading={<EmergencySkeleton />}>
        {(view) => <Emergency view={view} />}
      </QueryView>
    </Screen>
  );
}

function Emergency({ view }: { view: EmergencyView }) {
  const log = useLogEmergencyCall();
  const notify = useNotify();
  const [picked, setPicked] = useState(view.kinds[0]?.value ?? "");

  /** Opens the phone's dialler; a call to the caretaker or management is also logged. */
  const call = (number: string, who?: string) => {
    Linking.openURL(`tel:${number.replace(/\s/g, "")}`).catch(() =>
      notify.done(`Call ${number} from your phone`, "Handset"),
    );
    if (who) log.mutate(who, { onError: notify.failed });
  };

  return (
    <View className="gap-4 px-4">
      <PressArea
        onPress={() => call(view.caretaker.phone, view.caretaker.name)}
        accessibilityLabel={`Call the caretaker, ${view.caretaker.name}, ${view.caretaker.note}, ${view.caretaker.phone}`}
        className="overflow-hidden rounded-3xl"
      >
        {/* The kit has no solid danger card: `Fill` paints the red and gives its words the measured pair. */}
        <Fill tone="danger" solid className="flex-row items-center gap-3.5 rounded-3xl p-4.5">
          <Fill tone="surface" className="size-14 items-center justify-center rounded-full">
            <Icon name="Handset" size={32} tone="danger" />
          </Fill>
          <View className="flex-1">
            <Text role="title3" strong>
              Call the caretaker
            </Text>
            <Text role="callout">{`${view.caretaker.name} · ${view.caretaker.note}`}</Text>
            <Text role="callout" strong tabular className="mt-0.5">
              {view.caretaker.phone}
            </Text>
          </View>
        </Fill>
      </PressArea>

      {view.lastCall ? <Banner tone="success" icon="CircleCheck" body={view.lastCall} /> : null}

      <ListGroup>
        <ListItem
          icon="Handset"
          tone="default"
          title="Call management"
          subtitle={`${view.management.name} · ${view.management.hours}`}
          onPress={() => call(view.management.phone, view.management.name)}
        />
        <ListItem
          icon="Flame"
          tone="danger"
          title="Fire, gas or injury"
          subtitle="Leave the flat, then call 112"
          trailing={
            <Button size="sm" variant="danger" accessibilityLabel="Call 112" onPress={() => call("112")}>
              112
            </Button>
          }
        />
      </ListGroup>

      <Eyebrow className="mt-1">Then tell us what happened</Eyebrow>
      <View className="gap-2.5">
        {[view.kinds.slice(0, 2), view.kinds.slice(2, 4)].map((pair) => (
          <View key={pair.map((k) => k.value).join("-")} className="flex-row gap-2.5">
            {pair.map((k) => (
              <View key={k.value} className="flex-1">
                <Choice
                  indicator="none"
                  leading={<Icon name={k.icon} tone="accent" />}
                  title={k.label}
                  selected={picked === k.value}
                  onPress={() => {
                    setPicked(k.value);
                    router.push(href("res-repair-new", { kind: k.value, urgent: 1 }));
                  }}
                />
              </View>
            ))}
          </View>
        ))}
      </View>

      <Banner body="Emergency reports go to the caretaker and Solange at once and are marked urgent." />
    </View>
  );
}

function EmergencySkeleton() {
  return (
    <Skeleton label="Loading emergency contacts">
      <LoadingBone className="h-24 rounded-3xl" />
      <ListBone rows={2} />
      <View className="flex-row gap-2.5">
        <LoadingBone className="h-14 flex-1 rounded-2xl" />
        <LoadingBone className="h-14 flex-1 rounded-2xl" />
      </View>
      <CardBone size="sm" />
    </Skeleton>
  );
}
