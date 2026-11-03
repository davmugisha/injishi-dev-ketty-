import { router } from "expo-router";
import { Linking, View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  Dock,
  IconButton,
  KeyValue,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  metrics,
  PhotoHero,
  Screen,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { protoImages } from "@/proto/images";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useArrival } from "./data";
import type { DeskArrival } from "./types";
import { backOr } from "./ui";

/**
 * `desk-arrival`: everything the desk needs as the guest walks in: the stay, what is paid and still
 * owed, the guest's own request from the app, and what is missing before a key (the ID).
 */
export function ArrivalScreen() {
  const { guest } = useScreenParams("desk-arrival");
  const query = useArrival(guest);
  const arrival = query.data;
  return (
    <Screen bleed dock={arrival ? <ArrivalDock arrival={arrival} /> : undefined}>
      <QueryView query={query} data={arrival} loading={<ArrivalSkeleton />}>
        {(a) => <Arrival arrival={a} />}
      </QueryView>
    </Screen>
  );
}

function Arrival({ arrival }: { arrival: DeskArrival }) {
  return (
    <>
      <PhotoHero
        source={protoImages[arrival.photo]}
        height={metrics.photo.card}
        scrim="fade"
        top={
          <>
            <IconButton icon="ChevronLeft" label="Back" variant="glass" onPress={backOr(href("desk-today"))} />
            <IconButton
              icon="Handset"
              label={`Call ${arrival.name}`}
              variant="glass"
              onPress={() => void Linking.openURL(`tel:${arrival.dial}`)}
            />
          </>
        }
      />
      {/* The tags ride the photo's faded foot, as on the prototype. */}
      <View className="-mt-8 gap-4 px-4">
        <View>
          <View className="mb-2 flex-row flex-wrap gap-1.5">
            {arrival.tags.map((tag) => (
              <Chip key={tag.label} label={tag.label} tone={tag.tone} />
            ))}
          </View>
          <Text role="title2">{arrival.name}</Text>
          <Text role="callout" tone="muted" className="mt-1">
            {arrival.meta}
          </Text>
        </View>
        <Card padding="sm">
          <KeyValue rows={arrival.lines} />
        </Card>
        {arrival.request ? (
          <Banner tone="info" icon="Comments" title={arrival.request.title} body={arrival.request.body} />
        ) : null}
        <ListGroup>
          {arrival.checks.map((check) => (
            <ListItem
              key={check.key}
              icon={check.icon}
              tone={check.tone}
              title={check.title}
              subtitle={check.subtitle}
            />
          ))}
        </ListGroup>
      </View>
    </>
  );
}

function ArrivalDock({ arrival }: { arrival: DeskArrival }) {
  if (arrival.inHouse) {
    return (
      <Dock>
        <Button
          variant="secondary"
          icon="QrCode"
          onPress={() => router.push(href("desk-checkin-room", { guest: arrival.stayId }))}
        >
          {`Show guest QR · ${arrival.tent ?? "tent"}`}
        </Button>
      </Dock>
    );
  }
  return (
    <Dock>
      <Button icon="ArrowRight" onPress={() => router.push(href("desk-checkin", { guest: arrival.stayId }))}>
        Start check-in
      </Button>
    </Dock>
  );
}

function ArrivalSkeleton() {
  return (
    <LoadingView label="Loading the arriving guest">
      <LoadingBone className="h-52 rounded-none" />
      <View className="gap-4 px-4">
        <LoadingBone className="h-6 w-1/2" />
        <LoadingBone className="h-4 w-3/4" />
        <LoadingBone className="h-48 rounded-3xl" />
        <LoadingBone className="h-20 rounded-2xl" />
        <LoadingBone className="h-32 rounded-3xl" />
      </View>
    </LoadingView>
  );
}
