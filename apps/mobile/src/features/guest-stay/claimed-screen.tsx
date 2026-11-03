import { router } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Dock,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  metrics,
  Photo,
  Screen,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useClaimedStay } from "./data";
import type { ClaimedStay } from "./types";
import { CardBone, ListBones, SuccessMark } from "./ui";

/**
 * Walk-in stay added (G4): what was linked to the account (the stay, its bill, the lodge's messages) and
 * what still happens in person, like the key for a tent. No back arrow: the stay is added either way.
 */
export function ClaimedScreen() {
  const stay = useClaimedStay();
  const data = stay.data;
  return (
    <Screen
      dock={
        data ? (
          <Dock>
            <Button size="lg" onPress={() => router.navigate(href("guest-home-stay"))}>
              Open my stay
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView offlineNote={null} query={stay} data={data} loading={<ClaimedBones />}>
        {(s) => <Added stay={s} />}
      </QueryView>
    </Screen>
  );
}

function Added({ stay }: { stay: ClaimedStay }) {
  return (
    <View className="gap-5 px-4 pt-9">
      <View accessible accessibilityRole="alert" className="items-center gap-4">
        <SuccessMark icon="CircleCheck" size="md" />
        <View className="items-center gap-2">
          <Text role="title1" className="text-center">
            Stay added
          </Text>
          <Text role="body" tone="muted" className="text-center">
            {stay.desk}
          </Text>
        </View>
      </View>
      <View className="gap-3">
        <Photo
          source={stay.photo}
          height={metrics.photo.banner}
          scrim="bottom"
          label={stay.place}
          bottom={
            <View className="gap-0.5">
              <Text role="title3">{stay.place}</Text>
              <Text role="callout">{stay.unit}</Text>
            </View>
          }
        />
        <ListGroup>
          <ListItem icon="Key" title="Key" subtitle={stay.key} />
          <ListItem icon="Receipt" title="Bill" subtitle={stay.bill} onPress={() => router.push(href("guest-bill"))} />
          <ListItem
            icon="Comments"
            title="Message the lodge"
            subtitle={stay.message}
            onPress={() => router.push(href("guest-chat", { thread: "lodge" }))}
          />
        </ListGroup>
      </View>
    </View>
  );
}

function ClaimedBones() {
  return (
    <LoadingView label="Adding the stay" className="items-center px-4 pt-9">
      <LoadingBone className="size-28 rounded-full" />
      <LoadingBone className="h-8 w-2/5" />
      <LoadingBone className="h-4 w-3/4" />
      <CardBone className="mt-2 h-40" />
      <View className="w-full">
        <ListBones rows={3} />
      </View>
    </LoadingView>
  );
}
