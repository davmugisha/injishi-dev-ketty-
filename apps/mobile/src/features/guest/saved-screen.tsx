import { router } from "expo-router";
import { Share, View } from "react-native";
import {
  Button,
  Card,
  IconButton,
  LoadingBone,
  LoadingView,
  metrics,
  NavBar,
  Photo,
  PressArea,
  Screen,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { useSaved } from "./data";
import type { SavedData, SavedStay } from "./types";
import { Rating, SaveButton } from "./ui";

/** `.gx-pcard .ph-im` in the saved grid: a shorter photo, two to a row. */
const GRID_PHOTO = metrics.photo.banner - metrics.rowInset - metrics.liveDot;

function addStays() {
  router.navigate(href("guest-explore"));
}

function back() {
  if (router.canGoBack()) router.back();
  else router.navigate(href("guest-trips"));
}

/**
 * Saved (prototype `guest-saved`): the account's list of stays, on every device the guest signs in
 * to, and ideas to add to it. A heart takes a stay off the list or puts an idea on it.
 */
export function SavedScreen() {
  const query = useSaved();
  return (
    <Screen
      header={
        <NavBar
          title="Saved"
          onBack={back}
          right={<IconButton icon="Plus" label="Add stays to this list" variant="plain" onPress={addStays} />}
        />
      }
    >
      <QueryView query={query} data={query.data} offlineNote={null} loading={<SavedBones />}>
        {(d) => <SavedBody saved={d} />}
      </QueryView>
    </Screen>
  );
}

function SavedBody({ saved }: { saved: SavedData }) {
  const { list, ideas } = saved;
  const count = list.stays.length === 1 ? "1 stay" : `${list.stays.length} stays`;
  return (
    <View className="px-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text role="title3">{list.title}</Text>
          <Text role="callout" tone="muted">
            {count} · on every device you sign in to
          </Text>
        </View>
        {list.stays.length > 0 ? (
          <IconButton
            icon="ArrowShapeTurnUpRight"
            label="Share this list"
            variant="plain"
            onPress={() =>
              void Share.share({
                title: list.title,
                message: `${list.title}: ${list.stays.map((s) => s.name).join(", ")}`,
              }).catch(() => {})
            }
          />
        ) : null}
      </View>

      {list.stays.length > 0 ? (
        <Grid stays={list.stays} className="mt-3" />
      ) : (
        <Card tone="flat" className="mt-3">
          <Text role="callout" strong>
            Nothing saved yet
          </Text>
          <Text role="callout" tone="muted" className="mt-1">
            Tap the heart on any stay to keep it here, on your phone and on the web.
          </Text>
          <View className="mt-3 items-start">
            <Button size="sm" icon="Magnifier" onPress={addStays}>
              Find stays to save
            </Button>
          </View>
        </Card>
      )}

      {ideas.length > 0 ? (
        <>
          <Text role="title3" accessibilityRole="header" className="mt-6">
            Ideas
          </Text>
          <Grid stays={ideas} className="mt-3" />
        </>
      ) : null}
    </View>
  );
}

/** Two stays to a row. */
function Grid({ stays, className }: { stays: readonly SavedStay[]; className?: string }) {
  const rows: SavedStay[][] = [];
  for (let i = 0; i < stays.length; i += 2) rows.push(stays.slice(i, i + 2));
  return (
    <View className={["gap-4", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <View key={row.map((s) => s.slug).join("|")} className="flex-row gap-3">
          {row.map((stay) => (
            <SavedCard key={stay.slug} stay={stay} />
          ))}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}

function SavedCard({ stay }: { stay: SavedStay }) {
  // A saved stay shows its cheapest room; an idea says what it is instead.
  const from = stay.saved ? stay.fromRwf : null;
  return (
    <View className="flex-1">
      <PressArea
        onPress={() => router.push(href("guest-property", { slug: stay.slug }))}
        accessibilityRole="link"
        accessibilityLabel={[stay.name, stay.note, from === null ? null : `from ${rwf(from)}`].filter(Boolean).join(", ")}
        className="gap-2"
      >
        <Photo source={stay.photo} height={GRID_PHOTO} radius="lg" />
        <View className="gap-1 px-0.5">
          <Text role="callout" strong numberOfLines={1}>
            {stay.name}
          </Text>
          {stay.note ? (
            <Text role="caption" tone="muted" numberOfLines={1}>
              {stay.note}
            </Text>
          ) : (
            <Rating rating={stay.rating} reviewCount={stay.reviewCount} />
          )}
          {from === null ? null : (
            <Text role="callout" tone="muted" tabular>
              <Text role="callout" strong tabular>
                {rwf(from)}
              </Text>{" "}
              from
            </Text>
          )}
        </View>
      </PressArea>
      <View className="absolute right-0.5 top-0.5">
        <SaveButton slug={stay.slug} name={stay.name} saved={stay.saved} />
      </View>
    </View>
  );
}

function SavedBones() {
  return (
    <LoadingView label="Loading your saved stays" className="px-4">
      <LoadingBone className="h-6 w-1/2" />
      <LoadingBone className="h-4 w-2/3" />
      <View className="flex-row gap-3">
        <LoadingBone className="h-36 flex-1 rounded-3xl" />
        <LoadingBone className="h-36 flex-1 rounded-3xl" />
      </View>
      <LoadingBone className="h-6 w-1/4" />
      <View className="flex-row gap-3">
        <LoadingBone className="h-36 flex-1 rounded-3xl" />
        <LoadingBone className="h-36 flex-1 rounded-3xl" />
      </View>
    </LoadingView>
  );
}
