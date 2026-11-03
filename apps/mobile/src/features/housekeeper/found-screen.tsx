import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  Dock,
  Field,
  FilterChips,
  Icon,
  Input,
  LoadingBone,
  LoadingView,
  metrics,
  Photo,
  PressArea,
  SheetScreen,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { protoImages } from "@/proto/images";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useFound, useLogFound } from "./data";
import type { FoundView } from "./types";
import { backOr, TextLink } from "./ui";

interface Draft {
  what: string;
  place: string;
  photo: boolean;
}

/**
 * `hk-found`, a sheet over the room's task: photo, what and where in one sheet. It goes to Lost and found
 * with her as the first person holding it; valuables go to the supervisor the same day.
 */
export function FoundScreen() {
  const { room } = useScreenParams("hk-found");
  const query = useFound(room);
  const logFound = useLogFound();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const found = query.data;
  const current: Draft | null = draft ?? (found ? { what: found.what, place: found.place, photo: true } : null);
  const change = (patch: Partial<Draft>) => {
    if (current) setDraft({ ...current, ...patch });
  };
  // Closing lands on the room's task, or on Today when the room is not one of hers.
  const close = () => backOr(found?.onList === false ? href("hk-today") : href("hk-task", { room }));

  const log = () => {
    if (!current) return;
    logFound.mutate(
      { room, what: current.what.trim(), place: current.place },
      {
        onSuccess: () => {
          toast.show({ icon: "CircleCheck", message: "Logged for Lost and found. You hold it for now." });
          close();
        },
      },
    );
  };

  return (
    <SheetScreen
      title="Found an item"
      subtitle="It goes to Lost and found with you as the first person holding it."
      right={<Chip tone="accent" label={`Room ${room}`} />}
      onClose={close}
      dock={
        current ? (
          <Dock>
            <Button isDisabled={current.what.trim() === "" || logFound.isPending} onPress={log}>
              Log the item
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} data={found} loading={<FoundLoading />}>
        {(view) => (current ? <FoundForm found={view} draft={current} onChange={change} /> : null)}
      </QueryView>
    </SheetScreen>
  );
}

function FoundForm({
  found,
  draft,
  onChange,
}: {
  found: FoundView;
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const places = found.places.map((p) => ({ value: p, label: p }));
  return (
    <View className="gap-3">
      {draft.photo ? (
        <View className="gap-1">
          <Photo
            source={protoImages[found.photo]}
            height={metrics.photo.banner}
            radius="md"
            label="Photo of the item"
            bottom={
              <View className="flex-row">
                <Chip variant="glass" icon="Camera" label={found.photoNote} />
              </View>
            }
          />
          <View className="flex-row">
            <TextLink label="Retake" accessibilityLabel="Retake the photo" onPress={() => onChange({ photo: false })} />
          </View>
        </View>
      ) : (
        <PressArea
          onPress={() => onChange({ photo: true })}
          accessibilityRole="button"
          accessibilityLabel="Take a photo of the item"
          className="overflow-hidden rounded-2xl"
        >
          <Card tone="flat">
            <View className="items-center gap-2 py-6">
              <Icon name="Camera" size={32} tone="muted" />
              <Text role="callout" strong>
                Take a photo
              </Text>
              <Text role="caption" tone="muted" className="text-center">
                Made small, so it sends on weak signal
              </Text>
            </View>
          </Card>
        </PressArea>
      )}
      <Field label="What is it?">
        <Input
          value={draft.what}
          onChangeText={(what) => onChange({ what })}
          placeholder="A phone charger, a watch, a jacket"
          returnKeyType="done"
        />
      </Field>
      <Field label="Where was it?">
        <FilterChips
          label="Where was it?"
          layout="wrap"
          options={places}
          value={draft.place}
          onChange={(place) => onChange({ place })}
        />
      </Field>
      <Banner icon="ShieldExclamation" body="Money, ID or a phone? Hand it to Beatrice today, not the store." />
    </View>
  );
}

function FoundLoading() {
  return (
    <LoadingView label="Loading">
      <LoadingBone className="h-40 rounded-2xl" />
      <LoadingBone className="h-14 rounded-2xl" />
      <LoadingBone className="h-24 rounded-2xl" />
    </LoadingView>
  );
}
