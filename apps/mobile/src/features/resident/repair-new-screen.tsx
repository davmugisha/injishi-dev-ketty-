import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Dock,
  Field,
  FilterChips,
  Icon,
  LoadingBone,
  metrics,
  NavBar,
  Photo,
  PressArea,
  Screen,
  Text,
  TextArea,
  Toggle,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useEmergency, useRepairForm, useSendRepair, useTakeRepairPhoto } from "./data";
import type { RepairCategoryId, RepairPhoto } from "./types";
import { backOr, CardBone, Skeleton, useNotify } from "./ui";

/** Photos a request takes: enough to show the problem, few enough to send on a weak signal. */
const MAX_PHOTOS = 4;

/**
 * `res-repair-new`: the kind of problem, a few words, photos kept small, and "staff may enter" up
 * front. The form is a draft kept on this phone; sending saves offline and goes when there is
 * signal, then opens the request's thread. From Emergency (`?kind=water&urgent=1`) it opens on that
 * kind and is marked urgent.
 */
export function RepairNewScreen() {
  const query = useRepairForm();
  const emergency = useEmergency();
  const { kind, urgent: urgentParam } = useScreenParams("res-repair-new");
  const urgent = urgentParam === "1";
  const fromEmergency = emergency.data?.kinds.find((k) => k.value === kind)?.category;

  const [category, setCategory] = useState<RepairCategoryId | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [photos, setPhotos] = useState<RepairPhoto[] | null>(null);
  const [staffMayEnter, setStaffMayEnter] = useState<boolean | null>(null);
  const take = useTakeRepairPhoto();
  const send = useSendRepair();
  const notify = useNotify();

  const form = query.data;
  const chosen = category ?? fromEmergency ?? form?.category ?? "plumbing";
  // From Emergency the kept draft is about something else: the report starts blank.
  const words = description ?? (urgent ? "" : (form?.description ?? ""));
  const shots = photos ?? (urgent ? [] : (form?.photos ?? []));
  const mayEnter = staffMayEnter ?? form?.staffMayEnter ?? true;
  const ready = words.trim().length > 0;

  const addPhoto = () =>
    take.mutate(undefined, { onSuccess: (photo) => setPhotos([...shots, photo]), onError: notify.failed });
  const submit = () =>
    send.mutate(
      { category: chosen, description: words, photoIds: shots.map((p) => p.id), staffMayEnter: mayEnter, urgent },
      {
        // The thread takes the form's place: back from it goes where the form came from.
        onSuccess: (id) => router.replace(href("res-repair", { id })),
        onError: notify.failed,
      },
    );

  return (
    <Screen
      header={<NavBar title="Request a repair" onBack={() => backOr(href("res-requests"))} />}
      dock={
        form ? (
          <Dock note="Works without signal. It sends when you are back online.">
            <Button size="lg" icon="PaperPlane" isDisabled={!ready || send.isPending} onPress={submit}>
              Send request
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} data={form} loading={<FormSkeleton />}>
        {(data) => (
          <View className="gap-4 px-4">
            {urgent ? (
              <Banner
                tone="danger"
                icon="TriangleExclamation"
                title="Marked urgent"
                body="It goes to the caretaker and Solange at once. If you have not called yet, call first."
              />
            ) : null}
            <Field label="What kind of problem?">
              <FilterChips
                label="What kind of problem?"
                layout="wrap"
                options={data.categories}
                value={chosen}
                onChange={setCategory}
              />
            </Field>
            <Field label="Describe it" hint="Where it is, and since when. A few words is enough.">
              <TextArea
                value={words}
                onChangeText={setDescription}
                placeholder={urgent ? "What happened, and where in the flat?" : "Water drips under the kitchen sink…"}
              />
            </Field>
            <View className="gap-1.5">
              <Text role="callout" strong>
                Photos
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {shots.map((photo, index) => (
                  <ShotTile
                    key={photo.id}
                    photo={photo}
                    index={index}
                    onRemove={() => setPhotos(shots.filter((p) => p.id !== photo.id))}
                  />
                ))}
                {shots.length < MAX_PHOTOS ? (
                  <PressArea
                    onPress={addPhoto}
                    isDisabled={take.isPending}
                    accessibilityLabel="Take a photo"
                    className="overflow-hidden rounded-2xl"
                  >
                    <View
                      className="items-center justify-center rounded-2xl border-2 border-dashed border-border"
                      style={{ width: metrics.photo.thumb, height: metrics.photo.thumb }}
                    >
                      <Icon name="Camera" size={32} tone="muted" />
                    </View>
                  </PressArea>
                ) : null}
              </View>
            </View>
            <Card padding="sm">
              <View className="flex-row items-center gap-3.5">
                <View className="flex-1 gap-1">
                  <Text role="headline">Staff may enter if I am not home</Text>
                  <Text role="caption" tone="muted">
                    They come with management and leave a note
                  </Text>
                </View>
                <Toggle value={mayEnter} onValueChange={setStaffMayEnter} label="Staff may enter if I am not home" />
              </View>
            </Card>
          </View>
        )}
      </QueryView>
    </Screen>
  );
}

/** One photo, 84 square, with a small dark cross to take it out (light on the photo in both themes). */
function ShotTile({ photo, index, onRemove }: { photo: RepairPhoto; index: number; onRemove: () => void }) {
  return (
    <Photo
      source={photo.source}
      width={metrics.photo.thumb}
      height={metrics.photo.thumb}
      radius="md"
      label={`Photo ${index + 1}`}
    >
      <View className="absolute bottom-0 right-0">
        <PressArea
          onPress={onRemove}
          accessibilityLabel={`Remove photo ${index + 1}`}
          className="items-end justify-end p-1.5"
        >
          <View className="size-6 items-center justify-center rounded-full bg-backdrop">
            <Icon name="Xmark" size={12} />
          </View>
        </PressArea>
      </View>
    </Photo>
  );
}

function FormSkeleton() {
  return (
    <Skeleton label="Loading the form">
      <LoadingBone className="h-4 w-2/5" />
      <View className="flex-row flex-wrap gap-2">
        <LoadingBone className="h-9 w-28 rounded-full" />
        <LoadingBone className="h-9 w-28 rounded-full" />
        <LoadingBone className="h-9 w-36 rounded-full" />
      </View>
      <LoadingBone className="h-24 rounded-2xl" />
      <View className="flex-row gap-2">
        <LoadingBone className="size-20 rounded-2xl" />
        <LoadingBone className="size-20 rounded-2xl" />
      </View>
      <CardBone size="sm" />
    </Skeleton>
  );
}
