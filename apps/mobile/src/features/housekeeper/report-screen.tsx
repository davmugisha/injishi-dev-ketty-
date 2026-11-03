import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Chip,
  Dock,
  Field,
  FilterChips,
  LoadingBone,
  LoadingView,
  metrics,
  NavBar,
  OfflineBar,
  OptionTile,
  Photo,
  Screen,
  Segmented,
  TextArea,
  TileGrid,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { protoImages } from "@/proto/images";
import { href } from "@/proto/screens";
import { useReport, useSaveReport } from "./data";
import type { ReportInput, ReportView, Urgency } from "./types";
import { Bones, backOr } from "./ui";

const URGENCY = [
  { value: "wait", label: "Can wait" },
  { value: "today", label: "Today" },
  { value: "urgent", label: "Urgent" },
] as const;

const URGENCY_HINT: Record<Urgency, string> = {
  wait: "Can wait: fix it this week, no guest is bothered.",
  today: "Today: a guest would notice it.",
  urgent: "Urgent: it is unsafe, or a guest cannot use the room.",
};

/**
 * `hk-report`, with no signal: six big categories, three urgency levels and a photo made small for weak
 * signal. Saved on the phone when offline; it sends to maintenance on its own.
 */
export function ReportScreen() {
  const query = useReport();
  const save = useSaveReport();
  const [draft, setDraft] = useState<ReportInput | null>(null);
  const report = query.data;
  const current: ReportInput | null =
    draft ??
    (report
      ? {
          place: report.place,
          category: report.category,
          urgency: report.urgency,
          note: report.note,
          photo: report.photo !== null,
        }
      : null);
  const change = (patch: Partial<ReportInput>) => {
    if (current) setDraft({ ...current, ...patch });
  };
  const saveIt = () => {
    if (!current) return;
    save.mutate({ ...current, note: current.note.trim() }, { onSuccess: () => router.replace(href("hk-report-saved")) });
  };

  return (
    <Screen
      header={<NavBar title="Report a problem" onBack={() => backOr(href("hk-today"))} />}
      dock={
        current ? (
          <Dock note="Sends to maintenance automatically when there is signal.">
            <Button icon="FloppyDisk" isDisabled={save.isPending} onPress={saveIt}>
              Save report on phone
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView query={query} data={report} loading={<ReportLoading />}>
        {(view) => (current ? <ReportForm report={view} draft={current} onChange={change} /> : null)}
      </QueryView>
    </Screen>
  );
}

function ReportForm({
  report,
  draft,
  onChange,
}: {
  report: ReportView;
  draft: ReportInput;
  onChange: (patch: Partial<ReportInput>) => void;
}) {
  const places = report.places.map((p) => ({ value: p, label: p }));
  const isRoom = /^\d+$/.test(draft.place);
  return (
    <View>
      {report.offline ? <OfflineBar message={report.offline} /> : null}
      <View className="mt-4 gap-4 px-4">
        <Field label="Where">
          <FilterChips
            label="Where"
            layout="wrap"
            options={places}
            value={draft.place}
            onChange={(place) => onChange({ place })}
          />
        </Field>
        <Field label="What is wrong?">
          <TileGrid columns={3}>
            {report.categories.map((c) => (
              <OptionTile
                key={c.value}
                icon={c.icon}
                label={c.label}
                selected={draft.category === c.value}
                onPress={() => onChange({ category: c.value })}
              />
            ))}
          </TileGrid>
        </Field>
        <Field label="How urgent?" hint={URGENCY_HINT[draft.urgency]}>
          <Segmented
            label="How urgent?"
            options={URGENCY}
            value={draft.urgency}
            onChange={(urgency) => onChange({ urgency })}
          />
        </Field>
        {report.photo ? (
          <Field label="Photo">
            <Photo
              source={protoImages[report.photo.image]}
              height={metrics.photo.banner}
              radius="md"
              label="Photo of the problem"
              bottom={
                <View className="flex-row">
                  <Chip variant="glass" icon="Camera" label={report.photo.note} />
                </View>
              }
            />
          </Field>
        ) : null}
        <Field label="What did you see?" hint="A few words is enough.">
          <TextArea
            value={draft.note}
            onChangeText={(note) => onChange({ note })}
            placeholder="What is wrong, and where exactly"
          />
        </Field>
        <Banner
          body={
            isRoom
              ? `Maintenance decides if room ${draft.place} must be blocked. Until then it stays on sale.`
              : "Corridors are not sold, so there is nothing to block."
          }
        />
      </View>
    </View>
  );
}

function ReportLoading() {
  return (
    <LoadingView label="Loading">
      <Bones>
        <LoadingBone className="h-10 rounded-xl" />
        <LoadingBone className="h-4 w-16" />
        <LoadingBone className="h-10 rounded-full" />
        <LoadingBone className="h-4 w-28" />
        <LoadingBone className="h-48 rounded-2xl" />
        <LoadingBone className="h-12 rounded-2xl" />
      </Bones>
    </LoadingView>
  );
}
