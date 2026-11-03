import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  Dock,
  Field,
  Icon,
  KeyValue,
  LoadingBone,
  LoadingView,
  metrics,
  NavBar,
  Photo,
  PressArea,
  Screen,
  Text,
  TextArea,
  Timeline,
  type TimelineStep,
  Toggle,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useJob, useResolveJob } from "./data";
import type { JobDetail } from "./types";
import { backTo, useTimerSeconds } from "./ui";

/** The job the prototype draws when none is named. */
const SAMPLE_JOB = "WO-318";

type Form = { note: string; photos: number; askRelease: boolean };

/**
 * `tech-resolve`: records the fix and starts the release chain. Beatrice inspects the room, then only
 * Aline, the manager, puts it back on sale; the technician never can.
 */
export function ResolveScreen() {
  const { job } = useScreenParams("tech-resolve");
  const id = job ?? SAMPLE_JOB;
  const query = useJob(id);
  const data = query.data;
  // What he changed; until then, what the job starts the form with.
  const [edits, setEdits] = useState<Partial<Form>>({});
  const form: Form | null = data
    ? {
        note: edits.note ?? data.fix.note,
        photos: edits.photos ?? data.fix.photos.length,
        askRelease: edits.askRelease ?? Boolean(data.block),
      }
    : null;
  const change = (next: Partial<Form>) => setEdits((now) => ({ ...now, ...next }));
  return (
    <Screen
      header={
        <NavBar
          title={`Resolve ${data?.id ?? id}`}
          subtitle={data?.title}
          onBack={() => backTo("tech-job", { job: id })}
        />
      }
      dock={data && form ? <ResolveDock job={data} form={form} /> : undefined}
    >
      <QueryView query={query} data={data} loading={<ResolveLoading />}>
        {(detail) => (form ? <ResolveForm job={detail} form={form} onChange={change} /> : null)}
      </QueryView>
    </Screen>
  );
}

function ResolveForm({ job, form, onChange }: { job: JobDetail; form: Form; onChange: (next: Partial<Form>) => void }) {
  const seconds = useTimerSeconds(job.timer);
  const shots = [...job.fix.photos, ...job.fix.spare];
  const taken = shots.slice(0, form.photos);
  const parts = job.parts.filter((p) => p.tag.tone === "success").map((p) => p.title);
  const steps: TimelineStep[] = [
    { title: "Fixed by you", detail: "The reporter gets a message", state: "done" },
    ...(job.block && form.askRelease
      ? ([
          {
            title: "Room check by Beatrice",
            detail: "Housekeeping inspects before guests",
            state: "todo",
            icon: "CheckDouble",
          },
          {
            title: "Aline releases the block",
            detail: "Only the manager puts the room back on sale",
            state: "todo",
            icon: "LockOpen",
          },
        ] as const)
      : []),
  ];
  return (
    <View className="gap-4 px-4 pt-2">
      <Field label="What did you do?">
        <TextArea
          value={form.note}
          onChangeText={(note) => onChange({ note })}
          placeholder="What you fixed, and how you checked it"
        />
      </Field>
      <View className="gap-1.5">
        <Text role="callout" strong>
          Photo after
        </Text>
        <View className="flex-row flex-wrap gap-2.5">
          {taken.map((shot, index) => (
            <Photo
              // biome-ignore lint/suspicious/noArrayIndexKey: a photo is its place in the order taken
              key={index}
              source={shot}
              width={metrics.photo.thumb}
              height={metrics.photo.thumb}
              radius="md"
              label={`Photo after the fix, ${index + 1}`}
            />
          ))}
          {form.photos < shots.length ? (
            <PressArea
              onPress={() => onChange({ photos: form.photos + 1 })}
              accessibilityLabel="Take a photo after the fix"
              className="items-center justify-center rounded-2xl bg-default"
              style={{ width: metrics.photo.thumb, height: metrics.photo.thumb }}
            >
              <Icon name="Camera" size={24} tone="muted" />
            </PressArea>
          ) : null}
        </View>
      </View>
      <Card tone="flat" padding="sm">
        <KeyValue
          rows={[
            { label: "Time", value: `${Math.max(1, Math.round(seconds / 60))} min` },
            { label: "Parts", value: parts.length > 0 ? parts.join(", ") : "None" },
          ]}
        />
      </Card>
      {job.block ? (
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 gap-0.5">
            <Text role="headline">Ask to release the block</Text>
            <Text role="caption" tone="muted">
              Room goes back on sale after checks
            </Text>
          </View>
          <Toggle
            value={form.askRelease}
            onValueChange={(askRelease) => onChange({ askRelease })}
            label="Ask to release the block"
          />
        </View>
      ) : null}
      <Card>
        <Timeline steps={steps} />
      </Card>
    </View>
  );
}

function ResolveDock({ job, form }: { job: JobDetail; form: Form }) {
  const resolve = useResolveJob();
  const toast = useToast();
  if (job.state === "done")
    return (
      <Dock note={`Resolved, ${job.resolved ?? ""}`}>
        <Button variant="secondary" onPress={() => router.dismissTo(href("tech-jobs"))}>
          Back to my jobs
        </Button>
      </Dock>
    );
  const empty = !form.note.trim();
  const note = empty
    ? "Say what you did first."
    : job.block && job.room
      ? `You cannot put ${job.room} back on sale yourself.`
      : undefined;
  const submit = () =>
    resolve.mutate(
      { job: job.id, note: form.note.trim(), photos: form.photos, askRelease: form.askRelease },
      {
        onSuccess: ({ message }) => {
          toast.show({ icon: "CircleCheck", message, haptic: "success" });
          router.dismissTo(href("tech-jobs"));
        },
      },
    );
  return (
    <Dock note={note}>
      <Button icon="CircleCheck" onPress={submit} isDisabled={empty || resolve.isPending}>
        Mark resolved
      </Button>
    </Dock>
  );
}

function ResolveLoading() {
  return (
    <LoadingView label="Loading the work order" className="px-4 pt-2">
      <LoadingBone className="h-4 w-32" />
      <LoadingBone className="h-24 rounded-2xl" />
      <LoadingBone className="h-4 w-24" />
      <View className="flex-row gap-2.5">
        <LoadingBone className="rounded-2xl" style={{ width: metrics.photo.thumb, height: metrics.photo.thumb }} />
        <LoadingBone className="rounded-2xl" style={{ width: metrics.photo.thumb, height: metrics.photo.thumb }} />
      </View>
      <LoadingBone className="h-20 rounded-3xl" />
      <LoadingBone className="h-12 rounded-2xl" />
      <LoadingBone className="h-40 rounded-3xl" />
    </LoadingView>
  );
}
