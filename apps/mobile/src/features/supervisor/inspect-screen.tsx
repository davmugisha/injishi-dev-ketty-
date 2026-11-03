import { router } from "expo-router";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Dock,
  Icon,
  type IconName,
  ListGroup,
  LoadingBone,
  LoadingView,
  metrics,
  NavBar,
  Photo,
  PressArea,
  ProgressBar,
  Screen,
  Text,
  type TextTone,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useAddFailPhoto, useInspection, useMarkCheck, useReleaseRoom, useReturnRoom } from "./data";
import type { CheckResult, Inspection, InspectionCheck } from "./types";
import { backTo } from "./ui";

/**
 * `sup-inspect`: pass or fail each check, with a photo on every fail. A room with a failed check
 * cannot be released; it goes back to the housekeeper who cleaned it.
 */
export function InspectScreen() {
  const { room } = useScreenParams("sup-inspect");
  const query = useInspection(room);
  const data = query.data;
  return (
    <Screen
      header={
        <NavBar title={`Inspect ${data?.room ?? room}`} subtitle={data?.subtitle} onBack={() => backTo("sup-queue")} />
      }
      dock={data ? <InspectDock inspection={data} /> : undefined}
    >
      <QueryView query={query} data={data} loading={<InspectLoading />}>
        {(inspection) => <Checks inspection={inspection} />}
      </QueryView>
    </Screen>
  );
}

function tally(checks: readonly InspectionCheck[]) {
  const passed = checks.filter((c) => c.result === "pass").length;
  const failed = checks.filter((c) => c.result === "fail");
  const open = checks.length - passed - failed.length;
  return { passed, failed, open };
}

function Checks({ inspection }: { inspection: Inspection }) {
  const { passed, failed, open } = tally(inspection.checks);
  const summary = [`${passed} passed`, `${failed.length} failed`, open > 0 ? `${open} to check` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <View>
      <View className="gap-2 px-4 pt-1">
        <View className="flex-row items-center justify-between">
          <Text role="callout" strong>
            {summary}
          </Text>
          <Text role="callout" tone="muted">
            {`${inspection.checks.length} checks`}
          </Text>
        </View>
        <ProgressBar
          value={(passed / Math.max(1, inspection.checks.length)) * 100}
          tone="success"
          label="Checks passed"
        />
      </View>
      <ListGroup className="mx-4 mt-3">
        {inspection.checks.map((check) => (
          <CheckRow
            key={check.id}
            room={inspection.room}
            check={check}
            to={inspection.cleanedBy}
            locked={inspection.state !== "open"}
          />
        ))}
      </ListGroup>
    </View>
  );
}

/** Each answer's look when chosen: a tint with a line in its colour, and its own glyph and word. */
const VERDICT: Record<CheckResult, { icon: IconName; on: string; tone: TextTone; word: string }> = {
  fail: { icon: "Xmark", on: "border-danger bg-danger-soft", tone: "danger", word: "Fail" },
  pass: { icon: "Check", on: "border-success bg-success-soft", tone: "success", word: "Pass" },
};

/** `.sx-insp`: one check with its fail and pass answers; a failed check shows its photo and note. */
function CheckRow({ room, check, to, locked }: { room: string; check: InspectionCheck; to: string; locked: boolean }) {
  const mark = useMarkCheck();
  const photo = useAddFailPhoto();
  const failed = check.result === "fail";
  return (
    <View className="flex-row items-center gap-3 py-1 pl-3.5 pr-2" style={{ minHeight: metrics.rowMin }}>
      <View className="flex-1 gap-2">
        <Text role="callout">{check.label}</Text>
        {failed ? (
          // The evidence the housekeeper gets with the room: the photo and what is wrong.
          <Card tone="danger" padding="sm">
            {check.photo ? (
              <View className="flex-row items-center gap-2.5">
                <Photo source={check.photo} width={metrics.avatarSize.l} height={metrics.avatarSize.l} radius="sm" />
                <Text role="caption" strong className="flex-1">
                  {check.note ?? `Photo added for ${to}`}
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-2">
                <Text role="caption" strong className="flex-1">
                  {`Add a photo for ${to}`}
                </Text>
                <Button
                  size="sm"
                  variant="danger"
                  icon="Camera"
                  onPress={() => photo.mutate({ room, id: check.id })}
                  accessibilityLabel={`Add a photo of: ${check.label}`}
                >
                  Photo
                </Button>
              </View>
            )}
          </Card>
        ) : null}
      </View>
      <View className="flex-row">
        {(["fail", "pass"] as const).map((result) => {
          const look = VERDICT[result];
          const on = check.result === result;
          return (
            <PressArea
              key={result}
              onPress={() => mark.mutate({ room, id: check.id, result })}
              isDisabled={locked}
              feedback="none"
              accessibilityRole="radio"
              accessibilityLabel={`${look.word}: ${check.label}`}
              accessibilityState={{ checked: on, disabled: locked }}
              className="items-center justify-center"
              style={{ width: metrics.touch }}
            >
              <View
                className={`items-center justify-center rounded-full border-2 ${on ? look.on : "border-border"}`}
                style={{ width: metrics.iconButton, height: metrics.iconButton }}
              >
                <Icon name={look.icon} size={16} tone={on ? look.tone : "muted"} />
              </View>
            </PressArea>
          );
        })}
      </View>
    </View>
  );
}

function InspectDock({ inspection }: { inspection: Inspection }) {
  const release = useReleaseRoom();
  const giveBack = useReturnRoom();
  const toast = useToast();
  const { failed, open } = tally(inspection.checks);
  const busy = release.isPending || giveBack.isPending;
  const room = inspection.room;

  if (inspection.state !== "open")
    return (
      <Dock note={inspection.state === "released" ? "Front desk can give it out now." : undefined}>
        <Banner
          tone={inspection.state === "released" ? "success" : "warning"}
          title={
            inspection.state === "released" ? `${room} released · Ready` : `${room} returned to ${inspection.cleanedBy}`
          }
          body={
            inspection.state === "released"
              ? "You inspected it and it is on sale."
              : "Inspect it again once she marks it clean."
          }
        />
      </Dock>
    );

  const releaseRoom = () =>
    release.mutate(room, {
      onSuccess: ({ message }) => {
        toast.show({ icon: "CheckDouble", message, haptic: "success" });
        router.dismissTo(href("sup-queue"));
      },
    });
  const returnRoom = () => giveBack.mutate(room, { onSuccess: () => router.replace(href("sup-return", { room })) });

  if (failed.length > 0) {
    const missing = failed.some((c) => !c.photo);
    return (
      <Dock>
        <Banner
          tone="danger"
          icon="Ban"
          title="A failed check cannot be released."
          body={
            missing ? "Add a photo to each failed check first." : `Return it to ${inspection.cleanedBy} with the photo.`
          }
        />
        <View className="flex-row gap-2.5">
          {/* Two side by side are the prototype's `.btns2`: the regular height, so both labels fit. */}
          <Button variant="secondary" size="md" className="flex-1" isDisabled onPress={releaseRoom}>
            Release
          </Button>
          <Button
            variant="danger"
            size="md"
            icon="ArrowUturnCcwLeft"
            className="flex-1"
            isDisabled={missing || busy}
            onPress={returnRoom}
          >
            {`Return to ${inspection.cleanedBy}`}
          </Button>
        </View>
      </Dock>
    );
  }
  return (
    <Dock
      note={
        open > 0
          ? `Pass or fail every check first · ${open} left`
          : "Front desk can give it out as soon as you release it."
      }
    >
      <Button icon="CheckDouble" isDisabled={open > 0 || busy} onPress={releaseRoom}>
        {`Release ${room}`}
      </Button>
    </Dock>
  );
}

function InspectLoading() {
  return (
    <LoadingView label="Loading the inspection" className="px-4 pt-1">
      <View className="gap-2">
        <LoadingBone className="h-4 w-40" />
        <LoadingBone className="h-2 rounded-full" />
      </View>
      <LoadingBone className="h-96 rounded-3xl" />
    </LoadingView>
  );
}
