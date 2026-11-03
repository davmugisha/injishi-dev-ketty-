import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bubble,
  Button,
  Card,
  Chip,
  Choice,
  Dialog,
  Dock,
  Field,
  Icon,
  IconButton,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  metrics,
  NavBar,
  PhotoHero,
  Screen,
  Section,
  Text,
  TextArea,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useAddNote, useJob, useRequestPart, useToggleTimer } from "./data";
import type { JobDetail } from "./types";
import { backTo, clock, useTimerSeconds } from "./ui";

/** The job the prototype draws when none is named. */
const SAMPLE_JOB = "WO-318";

/**
 * `tech-job`: one work order. The reporter's photo and words, a running repair timer, the block
 * request waiting on the manager, and the parts the store has issued.
 */
export function JobScreen() {
  const { job } = useScreenParams("tech-job");
  const query = useJob(job ?? SAMPLE_JOB);
  const data = query.data;
  const [dialog, setDialog] = useState<"note" | "store" | null>(null);
  return (
    <Screen
      // The photo runs under the status bar once there is one; until then (loading, an error) a plain bar
      // keeps the way back.
      bleed={Boolean(data)}
      header={data ? undefined : <NavBar title="Work order" onBack={() => backTo("tech-jobs")} />}
      dock={data ? <JobDock job={data} onNote={() => setDialog("note")} /> : undefined}
    >
      <QueryView query={query} data={data} loading={<JobLoading />}>
        {(detail) => (
          <>
            <Job job={detail} onStore={() => setDialog("store")} />
            <NoteDialog job={detail.id} isOpen={dialog === "note"} onClose={() => setDialog(null)} />
            <StoreDialog job={detail} isOpen={dialog === "store"} onClose={() => setDialog(null)} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}

function Job({ job, onStore }: { job: JobDetail; onStore: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View>
      <PhotoHero
        source={job.photo}
        height={metrics.photo.card + insets.top}
        scrim="top"
        label={`Photo of the fault: ${job.title}`}
        top={
          <>
            <IconButton icon="ChevronLeft" label="Back" variant="glass" onPress={() => backTo("tech-jobs")} />
            <Chip variant="glass" icon="Camera" label={job.photoNote} />
          </>
        }
      />
      <View className="gap-2 px-4 pt-3">
        <View className="flex-row flex-wrap items-center gap-1.5">
          <Chip label={job.priority.label} tone={job.priority.tone} />
          <Chip label={job.id} />
          <Text role="caption" tone="muted">
            {`opened ${job.opened}`}
          </Text>
        </View>
        <Text role="title1">{job.title}</Text>
      </View>
      <RepairTimer job={job} />
      {job.block ? (
        <Card tone="warning" padding="sm" className="mx-4 mt-3">
          <View className="flex-row items-start gap-3">
            <Icon name="Lock" size={20} />
            <View className="flex-1 gap-1">
              <Text role="callout" strong>
                {job.block.title}
              </Text>
              <Text role="callout" tone="muted">
                {job.block.body}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}
      <Section title={job.report.heading} />
      <View className="gap-2 px-4">
        <Bubble from={job.report.mine ? "me" : "them"} text={job.report.text} />
        {job.notes.map((note) => (
          <Bubble key={note.id} from="me" text={note.text} time={note.time} />
        ))}
      </View>
      <Section
        title="Parts used"
        action={job.state === "done" ? undefined : { label: "Add from store", onPress: onStore }}
      />
      {job.parts.length > 0 ? (
        <ListGroup className="mx-4">
          {job.parts.map((part) => (
            <ListItem
              key={part.id}
              icon="Box"
              tone={part.tag.tone === "success" ? "success" : "warning"}
              title={part.title}
              subtitle={part.detail}
              trailing={<Chip label={part.tag.label} tone={part.tag.tone} icon={part.tag.icon} />}
            />
          ))}
        </ListGroup>
      ) : (
        <Text role="callout" tone="muted" className="px-4">
          No parts yet. Ask Patrick at the store for what this job needs.
        </Text>
      )}
    </View>
  );
}

/** The repair time, running from when he started, with a pause; the figure is the job's clock. */
function RepairTimer({ job }: { job: JobDetail }) {
  const toggle = useToggleTimer();
  const seconds = useTimerSeconds(job.timer);
  const running = Boolean(job.timer.since);
  const caption =
    job.state === "done"
      ? `Resolved · ${job.resolved ?? ""}`
      : running
        ? `Started ${job.timer.started ?? ""} · running`
        : job.timer.started
          ? `Started ${job.timer.started} · paused`
          : "Not started";
  return (
    <Card className="mx-4 mt-3">
      <View className="flex-row items-center gap-3.5">
        <View className="flex-1 gap-1" accessible accessibilityLabel={`Repair time ${clock(seconds)}, ${caption}`}>
          <Text role="micro" caps strong tone="muted">
            Repair time
          </Text>
          <Text role="display" tabular>
            {clock(seconds)}
          </Text>
          <Text role="caption" tone="muted">
            {caption}
          </Text>
        </View>
        {job.state === "done" ? null : (
          <IconButton
            icon={running ? "CirclePause" : "CirclePlay"}
            label={running ? "Pause the repair timer" : "Start the repair timer"}
            variant="surface"
            onPress={() => toggle.mutate(job.id)}
          />
        )}
      </View>
    </Card>
  );
}

function JobDock({ job, onNote }: { job: JobDetail; onNote: () => void }) {
  if (job.state === "done")
    return (
      <Dock note={`Resolved, ${job.resolved ?? ""}`}>
        <Button variant="secondary" icon="Wrench" onPress={() => router.dismissTo(href("tech-jobs"))}>
          Back to my jobs
        </Button>
      </Dock>
    );
  return (
    <Dock>
      <View className="flex-row gap-2.5">
        <Button variant="secondary" size="md" icon="Comments" className="flex-1" onPress={onNote}>
          Add note
        </Button>
        <Button
          icon="CircleCheck"
          size="md"
          className="flex-1"
          onPress={() => router.push(href("tech-resolve", { job: job.id }))}
        >
          Resolve
        </Button>
      </View>
    </Dock>
  );
}

function NoteDialog({ job, isOpen, onClose }: { job: string; isOpen: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const add = useAddNote();
  const save = () =>
    add.mutate(
      { job, text },
      {
        onSuccess: () => {
          setText("");
          onClose();
        },
      },
    );
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      icon="Comments"
      title="Add a note"
      body="The reporter and the supervisor see it on this job."
      actions={
        <>
          <Button onPress={save} isDisabled={!text.trim() || add.isPending}>
            Save note
          </Button>
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <Field label="Note">
        <TextArea value={text} onChangeText={setText} placeholder="What you found, what you did" />
      </Field>
    </Dialog>
  );
}

function StoreDialog({ job, isOpen, onClose }: { job: JobDetail; isOpen: boolean; onClose: () => void }) {
  const [part, setPart] = useState<string | null>(null);
  const request = useRequestPart();
  const toast = useToast();
  const ask = () => {
    if (!part) return;
    request.mutate(
      { job: job.id, part },
      {
        onSuccess: ({ message }) => {
          toast.show({ icon: "Box", message });
          setPart(null);
          onClose();
        },
      },
    );
  };
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      icon="Box"
      title="Add from store"
      body="Patrick brings what is in stock, and orders what is not."
      actions={
        <>
          <Button onPress={ask} isDisabled={!part || request.isPending}>
            Ask Patrick
          </Button>
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <View className="gap-2">
        {job.store.map((item) => (
          <Choice
            key={item.id}
            title={item.name}
            subtitle={item.stock}
            selected={part === item.id}
            onPress={() => setPart(item.id)}
          />
        ))}
      </View>
    </Dialog>
  );
}

function JobLoading() {
  return (
    <LoadingView label="Loading the work order" className="px-4">
      <LoadingBone className="rounded-3xl" style={{ height: metrics.photo.banner }} />
      <View className="gap-4">
        <View className="flex-row gap-2">
          <LoadingBone className="h-6 w-16 rounded-full" />
          <LoadingBone className="h-6 w-16 rounded-full" />
        </View>
        <LoadingBone className="h-8 w-64" />
        <LoadingBone className="h-28 rounded-3xl" />
        <LoadingBone className="h-20 rounded-3xl" />
        <LoadingBone className="h-16 w-4/5 rounded-2xl" />
      </View>
    </LoadingView>
  );
}
