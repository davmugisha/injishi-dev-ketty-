import { Avatar } from "heroui-native";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PhoneTop } from "@/components/phone";
import { Button, EmptyView, Text } from "@/components/ui";
import { enqueue } from "@/data/outbox";
import { useEmployeeFile } from "@/data/queries/me-work";
import { useToday } from "@/data/queries/today";
import { AsOf, QueryError, QueryView } from "@/data/query-view";
import { OutboxChip } from "@/features/outbox/outbox-chip";
import { serverNow } from "@/lib/clock";
import { kigaliDayLabel, kigaliTime } from "@/lib/kigali";
import { useSession } from "@/lib/session";
import { ShiftCard, ShiftCardLoading, ShiftNotSetUp } from "./shift-card";
import { type ShiftCardState, shiftCardState } from "./shift-state";

/** The clock, on the server's time as the phone knows it, ticking every 20 seconds. */
function useNow(): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), 20_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** "Good morning", by the phone's own clock (the value sourcing's rule). */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The housekeeper's Today (mobile spec 0003, milestone 1, prototype `housekeeper-01-clockin`): the
 * shift card from live data and one big button that clocks in and out, with or without signal, at the
 * time of the tap. Rooms join it in milestone 2; the briefing, the bell and Report a problem stay
 * hidden until their features (AC-18).
 */
export function TodayScreen() {
  const { persona, account } = useSession();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const { file, query: files } = useEmployeeFile();
  const { query, view } = useToday(file?.employeeId);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([files.refetch(), file ? query.refetch() : Promise.resolve()]);
    setRefreshing(false);
  }, [files, file, query]);

  const state = view ? shiftCardState(view, now) : null;
  const place = [file?.jobPositionTitle, file?.branchName].filter(Boolean).join(" · ");
  const firstName = persona?.firstName ?? account?.name.split(" ")[0] ?? "";

  const punch = useCallback(
    (kind: "clock_in" | "clock_out") => {
      if (!account || !file) return;
      // Location rides on every punch from milestone 4 (AC-25); the payload is the punch alone until then.
      enqueue(account.userId, { kind, subjectId: file.employeeId, payload: {} });
    },
    [account, file],
  );

  return (
    <View className="flex-1">
      <PhoneTop>
        <Avatar size="sm" variant="soft" color="accent" alt={persona?.name ?? ""}>
          <Avatar.Fallback>{persona?.initials}</Avatar.Fallback>
        </Avatar>
        <View className="flex-1">
          <Text role="headline">{persona?.name ?? account?.name ?? ""}</Text>
          {place ? (
            <Text role="caption" tone="muted">
              {place}
            </Text>
          ) : null}
        </View>
        <OutboxChip />
      </PhoneTop>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-4 pt-2 pb-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      >
        <View className="gap-1">
          <Text role="micro" tone="muted" caps>
            {kigaliDayLabel(now)}
          </Text>
          <Text role="title1">{firstName ? `${greeting()}, ${firstName}` : greeting()}</Text>
        </View>

        {file === undefined ? (
          files.error ? (
            <QueryError error={files.error} onRetry={() => void files.refetch()} />
          ) : (
            <ShiftCardLoading />
          )
        ) : file === null ? (
          <ShiftNotSetUp />
        ) : (
          <QueryView
            query={query}
            data={state ?? undefined}
            loading={<ShiftCardLoading />}
            outOfDate={
              <EmptyView
                icon="CloudSlash"
                title="Connect to load today"
                body="The copy on this phone is from an earlier day. Connect to load today's shift."
                action={{ label: "Try again", icon: "ArrowRotateRight", onPress: () => void query.refetch() }}
              />
            }
          >
            {(card) => (
              <View className="gap-2">
                <AsOf query={query} />
                <ShiftCard state={card} />
              </View>
            )}
          </QueryView>
        )}
      </ScrollView>

      {state ? (
        <View className="gap-2 border-t border-separator bg-surface px-4 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <PunchButton state={state} now={now} onPunch={punch} />
          <Text role="caption" tone="muted" className="text-center">
            No signal? The time is saved on this phone and sent later.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function PunchButton({
  state,
  now,
  onPunch,
}: {
  state: ShiftCardState;
  now: number;
  onPunch: (kind: "clock_in" | "clock_out") => void;
}) {
  // One tap is one punch: the card changes at once, so a second tap would be a second punch.
  const [busy, setBusy] = useState(false);
  const press = (kind: "clock_in" | "clock_out") => {
    if (busy) return;
    setBusy(true);
    onPunch(kind);
    setTimeout(() => setBusy(false), 1_000);
  };
  if (state.kind === "on_shift") {
    // Start break arrives with milestone 3 (AC-22).
    return (
      <Button variant="secondary" icon="ArrowRightFromSquare" isDisabled={busy} onPress={() => press("clock_out")}>
        Clock out
      </Button>
    );
  }
  return (
    <Button icon="Clock" isDisabled={busy} onPress={() => press("clock_in")}>
      {`Clock in at ${kigaliTime(now)}`}
    </Button>
  );
}
