import { router } from "expo-router";
import { useEffect, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import {
  Banner,
  Button,
  Chip,
  Choice,
  Dock,
  Icon,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  Segmented,
  StepBar,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { usePrearrival, useSubmitPrearrival } from "./data";
import type { IdCardFace, IdDocument, Prearrival } from "./types";
import { backOr, CardBone, HeadingBones, ListBones, TextLink } from "./ui";

type Step = "id" | "arrival";

const DOCUMENTS = [
  { value: "passport", label: "Passport" },
  { value: "national-id", label: "National ID" },
] as const;

/**
 * Check in before you arrive: the ID, then the arrival time, then both go to the desk and the step is
 * done. Says who sees the ID and for how long before asking for it; skipping the ID is always allowed.
 */
export function PrearrivalScreen() {
  const prearrival = usePrearrival();
  const submit = useSubmitPrearrival();
  const toast = useToast();
  const [step, setStep] = useState<Step>("id");
  const [document, setDocument] = useState<IdDocument | null>(null);
  const [arrival, setArrival] = useState<string | null>(null);
  const [idAtDesk, setIdAtDesk] = useState(false);
  const data = prearrival.data;
  const doc = document ?? data?.document ?? "passport";
  const chosen = arrival ?? data?.arrival.chosen ?? "";

  // On the arrival step, back (the arrow or Android's) returns to the ID step first.
  useEffect(() => {
    if (step !== "arrival") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setStep("id");
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const toArrival = (atDesk: boolean) => {
    setIdAtDesk(atDesk);
    setStep("arrival");
  };

  const send = () =>
    submit.mutate(
      { document: doc, arrival: chosen, idAtDesk },
      {
        onSuccess: () => {
          toast.show({ icon: "CircleCheck", message: "Sent to the desk. Check-in is done.", haptic: "success" });
          router.navigate(href("guest-home-before"));
        },
        onError: () => toast.show({ icon: "CloudSlash", message: "Not sent. Try again in a moment.", haptic: "error" }),
      },
    );

  const dock = !data ? undefined : step === "id" ? (
    <Dock>
      <Button size="lg" onPress={() => toArrival(false)}>
        Continue
      </Button>
      <TextLink label="Skip, I'll show it at the desk" onPress={() => toArrival(true)} />
    </Dock>
  ) : (
    <Dock note="Only the desk sees it. You can change it until the day.">
      <Button size="lg" icon="PaperPlane" onPress={send} isDisabled={submit.isPending || !chosen}>
        Send to the desk
      </Button>
    </Dock>
  );

  return (
    <Screen
      dock={dock}
      header={
        <NavBar
          title="Check in before you arrive"
          subtitle={step === "id" ? "Step 2 of 4 · your ID" : "Step 3 of 4 · arrival time"}
          onBack={() => (step === "arrival" ? setStep("id") : backOr(href("guest-home-before")))}
        />
      }
    >
      <QueryView offlineNote={null} query={prearrival} data={data} loading={<PrearrivalBones />}>
        {(d) =>
          step === "id" ? (
            <IdStep data={d} document={doc} onDocument={setDocument} />
          ) : (
            <ArrivalStep data={d} chosen={chosen} onChoose={setArrival} idAtDesk={idAtDesk} />
          )
        }
      </QueryView>
    </Screen>
  );
}

function IdStep({
  data,
  document,
  onDocument,
}: {
  data: Prearrival;
  document: IdDocument;
  onDocument: (next: IdDocument) => void;
}) {
  return (
    <View className="gap-4 px-4 pt-1">
      <StepBar total={4} step={2} />
      {data.sentAt ? (
        <Banner
          tone="success"
          title={`Sent to the desk at ${data.sentAt}`}
          body="They compare your ID with the original when you arrive."
        />
      ) : null}
      <View className="gap-2">
        <Text role="title2">{data.title}</Text>
        <Text role="body" tone="muted">
          {data.body}
        </Text>
      </View>
      <Segmented label="Kind of ID" options={DOCUMENTS} value={document} onChange={onDocument} />
      <IdCard face={data.faces[document]} />
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        {data.uploaded ? (
          <View className="flex-row items-center gap-1.5">
            <Icon name="ShieldCheck" size={16} tone="success" />
            <Text role="callout" strong tone="success">
              Uploaded · encrypted
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-1.5">
            <Icon name="Person" size={16} tone="muted" />
            <Text role="callout" strong tone="muted">
              You show it at the desk
            </Text>
          </View>
        )}
        <Chip tone="warning" icon="Hourglass" label="Waiting for the desk" />
      </View>
      <ListGroup>
        <ListItem icon="Persons" tone="default" title="Who can see it" subtitle={data.who} />
        <ListItem icon="Clock" tone="default" title="How long it's kept" subtitle={data.kept} />
      </ListGroup>
    </View>
  );
}

/** `.gx-id`: a stand-in picture of the document, on a soft green to blue wash, with its lines half hidden. */
function IdCard({ face }: { face: IdCardFace }) {
  const [from, to] = useCSSVariable(["--color-success-soft", "--color-info-soft"]);
  return (
    <View
      accessible
      accessibilityLabel={`${face.heading.toLowerCase()}, uploaded, numbers hidden`}
      className="overflow-hidden rounded-3xl border border-separator p-4"
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" accessible={false}>
        <Defs>
          <LinearGradient id="guest-id-wash" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={String(from)} />
            <Stop offset="1" stopColor={String(to)} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#guest-id-wash)" />
      </Svg>
      <View className="flex-row items-center justify-between gap-2">
        <Text role="micro" strong caps className="shrink">
          {face.heading}
        </Text>
        <Icon name="Globe" size={16} tone="muted" />
      </View>
      <View className="mt-3 flex-row items-start gap-3.5">
        <View className="h-23 w-19 items-center justify-center rounded-xl bg-surface">
          <Icon name="Person" size={40} tone="muted" />
        </View>
        <View className="flex-1 gap-2 pt-1">
          {LINES.map((width) => (
            <View key={width} className="h-2 rounded-full bg-default" style={{ width }} />
          ))}
        </View>
      </View>
      <View className="mt-3">
        {face.mrz.map((line) => (
          <Text key={line} role="caption" tone="muted" tabular numberOfLines={1}>
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** The text lines beside the photo, as the prototype draws them. */
const LINES = ["80%", "56%", "68%", "40%"] as const;

function ArrivalStep({
  data,
  chosen,
  onChoose,
  idAtDesk,
}: {
  data: Prearrival;
  chosen: string;
  onChoose: (value: string) => void;
  idAtDesk: boolean;
}) {
  return (
    <View className="gap-4 px-4 pt-1">
      <StepBar total={4} step={3} />
      <View className="gap-2">
        <Text role="title2">{data.arrival.title}</Text>
        <Text role="body" tone="muted">
          {data.arrival.body}
        </Text>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Arrival time" className="gap-2">
        {data.arrival.windows.map((window) => (
          <Choice
            key={window.value}
            title={window.label}
            subtitle={window.detail}
            selected={chosen === window.value}
            onPress={() => onChoose(window.value)}
          />
        ))}
      </View>
      <Banner
        icon={idAtDesk ? "Person" : "ShieldCheck"}
        title={idAtDesk ? "ID at the desk" : "ID uploaded · encrypted"}
        body={
          idAtDesk
            ? "Bring the original. Checking it takes a minute at the desk."
            : "The desk only compares it with the original when you arrive."
        }
      />
    </View>
  );
}

function PrearrivalBones() {
  return (
    <LoadingView label="Loading check-in" className="px-4 pt-1">
      <LoadingBone className="h-1 w-full" />
      <HeadingBones />
      <LoadingBone className="h-12 w-full rounded-2xl" />
      <CardBone className="h-48" />
      <ListBones rows={2} />
    </LoadingView>
  );
}
