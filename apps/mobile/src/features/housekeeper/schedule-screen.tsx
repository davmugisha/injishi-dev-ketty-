import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  IconButton,
  IconTile,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  Screen,
  ScreenHeader,
  Section,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useSurface } from "@/proto/surface";
import { useAskSwap, useMarkScheduleSeen, useSchedule, useTabBadgeSource } from "./data";
import type { ScheduleView, WeekDay } from "./types";
import { Bones, ListBones, useStaffApp } from "./ui";

/** How far the week arrows go: a month back, two months on. */
const WEEKS = { min: -4, max: 8 } as const;

/**
 * `hk-schedule` (also the technician's Schedule tab): the week at a glance, the next shift first, a
 * pending swap flagged and the leave balance in plain numbers.
 */
export function ScheduleScreen() {
  const app = useStaffApp();
  const surface = useSurface();
  const [offset, setOffset] = useState(0);
  const [swapping, setSwapping] = useState(false);
  const query = useSchedule(app, offset);
  const askSwap = useAskSwap();
  const toast = useToast();

  // Looking at the schedule clears the tab's dot.
  const badges = useTabBadgeSource();
  const seen = useMarkScheduleSeen();
  const hasDot = badges.data?.schedule === true;
  useFocusEffect(
    useCallback(() => {
      if (hasDot) seen.mutate();
    }, [hasDot, seen.mutate]),
  );

  const move = (by: number) => {
    setSwapping(false);
    setOffset((now) => Math.min(WEEKS.max, Math.max(WEEKS.min, now + by)));
  };

  return (
    <Screen>
      <ScreenHeader
        eyebrow={query.data?.range ?? "This week"}
        title="My schedule"
        right={
          <>
            <IconButton
              icon="ChevronLeft"
              label="Week before"
              variant="plain"
              isDisabled={offset <= WEEKS.min}
              onPress={() => move(-1)}
            />
            <IconButton
              icon="ChevronRight"
              label="Week after"
              variant="plain"
              isDisabled={offset >= WEEKS.max}
              onPress={() => move(1)}
            />
          </>
        }
      />
      <QueryView query={query} data={query.data} loading={<ScheduleLoading />}>
        {(schedule) => (
          <ScheduleBody
            schedule={schedule}
            swapping={swapping}
            onLeave={() => router.push(href("hk-leave", undefined, { app: surface }))}
            onSwapMode={() => setSwapping((now) => !now)}
            onSwap={(key, title) =>
              askSwap.mutate(key, {
                onSuccess: () => {
                  setSwapping(false);
                  toast.show({ icon: "Hourglass", message: `Swap asked for ${title}. Your supervisor answers first.` });
                },
              })
            }
          />
        )}
      </QueryView>
    </Screen>
  );
}

const DAY_STATE: Record<WeekDay["mark"], string> = {
  work: "working",
  off: "rest day",
  warn: "something to check",
};

function WeekStrip({ week }: { week: WeekDay[] }) {
  return (
    <View className="flex-row gap-1.5 px-4">
      {week.map((d) => (
        <View
          key={d.key}
          accessible
          accessibilityLabel={`${d.day} ${d.date}${d.today ? ", today" : ""}, ${DAY_STATE[d.mark]}`}
          className={`flex-1 items-center gap-0.5 rounded-2xl py-2 ${d.today ? "bg-accent" : "border border-separator bg-surface"}`}
        >
          <Text role="micro" strong tone={d.today ? "onAccent" : "muted"}>
            {d.day}
          </Text>
          <Text role="title3" strong tabular tone={d.today ? "onAccent" : "default"}>
            {d.date}
          </Text>
          <DayMark mark={d.mark} today={d.today} />
        </View>
      ))}
    </View>
  );
}

function DayMark({ mark, today }: { mark: WeekDay["mark"]; today: boolean }) {
  const look =
    mark === "off"
      ? "border border-border"
      : mark === "warn"
        ? "bg-warning"
        : today
          ? "bg-surface"
          : "bg-accent";
  return <View className={`size-1.5 rounded-full ${look}`} importantForAccessibility="no" />;
}

function ScheduleBody({
  schedule,
  swapping,
  onLeave,
  onSwapMode,
  onSwap,
}: {
  schedule: ScheduleView;
  swapping: boolean;
  onLeave: () => void;
  onSwapMode: () => void;
  onSwap: (key: string, title: string) => void;
}) {
  const canSwap = schedule.shifts.some((s) => s.swappable);
  return (
    <View>
      <WeekStrip week={schedule.week} />
      {schedule.next ? (
        <Card raised className="mx-4 mt-4">
          <Text role="micro" tone="muted" caps strong>
            Next shift
          </Text>
          <View className="mt-2 flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text role="title3">{schedule.next.title}</Text>
              <Text role="callout" tone="muted">
                {schedule.next.detail}
              </Text>
            </View>
            <IconTile icon="Calendar" size="lg" />
          </View>
        </Card>
      ) : null}
      <Section title={schedule.listTitle} />
      {swapping ? (
        <Banner tone="info" icon="ArrowRightArrowLeft" className="mx-4 mb-2" body="Tap a shift to offer it for a swap." />
      ) : null}
      <ListGroup className="mx-4">
        {schedule.shifts.map((shift) => (
          <ListItem
            key={shift.key}
            title={shift.title}
            subtitle={shift.detail}
            trailing={shift.chip ? <Chip label={shift.chip.label} tone={shift.chip.tone} icon={shift.chip.icon} /> : null}
            onPress={swapping && shift.swappable ? () => onSwap(shift.key, shift.title) : undefined}
            accessibilityLabel={swapping && shift.swappable ? `Offer ${shift.title} for a swap` : undefined}
          />
        ))}
      </ListGroup>
      <Section title="Leave" />
      <View className="flex-row gap-2.5 px-4">
        <LeaveTile
          label="Annual left"
          value={String(schedule.leave.left)}
          unit={`of ${schedule.leave.total} days`}
          caption={schedule.leave.resets}
        />
        {schedule.leave.booked ? (
          <LeaveTile
            label="Booked"
            value={schedule.leave.booked.value}
            unit={schedule.leave.booked.unit}
            caption={schedule.leave.booked.status}
            captionTone={schedule.leave.booked.tone}
          />
        ) : (
          <LeaveTile label="Booked" value="None" unit="" caption="Nothing asked yet" />
        )}
      </View>
      <View className="mt-3 flex-row gap-2.5 px-4">
        <Button icon="Suitcase" className="flex-1" onPress={onLeave}>
          Ask for leave
        </Button>
        <Button
          variant="secondary"
          icon={swapping ? "Xmark" : "ArrowRightArrowLeft"}
          className="flex-1"
          isDisabled={!canSwap && !swapping}
          onPress={onSwapMode}
        >
          {swapping ? "Cancel swap" : "Swap a shift"}
        </Button>
      </View>
      <Text role="caption" tone="muted" className="mt-3 text-center">
        {schedule.holiday}
      </Text>
    </View>
  );
}

/** `.kpi` for leave: a small label, the figure with its unit, and one line under it (its status). */
function LeaveTile({
  label,
  value,
  unit,
  caption,
  captionTone = "muted",
}: {
  label: string;
  value: string;
  unit: string;
  caption: string;
  captionTone?: "muted" | "success" | "warning";
}) {
  return (
    <View className="flex-1">
      <Card padding="sm" className="grow">
        <View accessible accessibilityLabel={`${label}, ${value} ${unit}, ${caption}`}>
          <Text role="caption" tone="muted" strong>
            {label}
          </Text>
          <View className="mt-0.5 flex-row items-baseline gap-1">
            <Text role="title2" tabular>
              {value}
            </Text>
            {unit ? (
              <Text role="callout" tone="muted" strong>
                {unit}
              </Text>
            ) : null}
          </View>
          <Text role="caption" tone={captionTone} strong={captionTone !== "muted"}>
            {caption}
          </Text>
        </View>
      </Card>
    </View>
  );
}

function ScheduleLoading() {
  return (
    <LoadingView label="Loading your schedule">
      <View className="flex-row gap-1.5 px-4">
        {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => (
          <LoadingBone key={d} className="h-16 flex-1 rounded-2xl" />
        ))}
      </View>
      <Bones>
        <LoadingBone className="h-24 rounded-3xl" />
        <LoadingBone className="mt-2 h-5 w-28" />
        <ListBones rows={4} />
      </Bones>
    </LoadingView>
  );
}
