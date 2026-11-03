import { router } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Card,
  Divider,
  Icon,
  IconButton,
  Kpi,
  ListGroup,
  LoadingBone,
  LoadingView,
  metrics,
  PressArea,
  ProgressBar,
  Screen,
  Section,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useDecide, useManagerToday } from "./data";
import type { TodayView } from "./types";
import { ApprovalRow, KpiBones, RowBones } from "./ui";

/**
 * Manager Today (prototype `mgr-today`, N1): the day at a glance in four figures, then the decisions
 * waiting. Room 305's card shows its evidence trail (fixed, inspected) right above Release, which
 * decides it here; the other requests open their detail. The place name opens the switcher (X1).
 */
export function TodayScreen() {
  const query = useManagerToday();
  const decide = useDecide();
  const toast = useToast();
  const openApproval = (id: string) => router.push(href("mgr-approval", { id }));

  const quickDecide = (feature: NonNullable<TodayView["feature"]>, approve: boolean) =>
    decide.mutate(
      { id: feature.id, approve, reason: approve ? undefined : "Kept blocked from Today" },
      {
        onSuccess: () =>
          toast.show({
            icon: approve ? "CircleCheck" : "Lock",
            message: approve ? feature.approvedNote : feature.declinedNote,
          }),
      },
    );

  return (
    <Screen>
      <QueryView
        query={query}
        data={query.data}
        loading={
          <LoadingView label="Loading today" className="px-4 pt-2">
            <LoadingBone className="h-3 w-32" />
            <LoadingBone className="h-6 w-48" />
            <KpiBones />
            <KpiBones />
            <LoadingBone className="h-5 w-24" />
            <LoadingBone className="h-40 rounded-3xl" />
            <RowBones rows={2} />
          </LoadingView>
        }
      >
        {(today) => (
          <View>
            <View className="flex-row items-center gap-2.5 px-4 pb-3 pt-1.5" style={{ minHeight: metrics.header }}>
              <View className="flex-1">
                <Text role="caption" tone="muted">
                  {today.date}
                </Text>
                <PressArea
                  onPress={() => router.push(href("shared-switcher"))}
                  accessibilityRole="button"
                  accessibilityLabel={`${today.place}. Switch place`}
                  className="-my-2 justify-center self-start"
                >
                  <View className="flex-row items-center gap-1">
                    <Text role="title3" strong accessibilityRole="header">
                      {today.place}
                    </Text>
                    <Icon name="ChevronDown" size={16} tone="muted" />
                  </View>
                </PressArea>
              </View>
              <IconButton
                icon="Bell"
                label="Inbox and alerts"
                variant="surface"
                dot={today.unreadAlerts > 0}
                onPress={() => router.navigate(href("mgr-inbox"))}
              />
            </View>

            <View className="gap-2.5 px-4">
              <View className="flex-row gap-2.5">
                <View className="flex-1">
                  <Kpi
                    label="Occupancy tonight"
                    value={today.occupancy.value}
                    caption={today.occupancy.caption}
                    trend={today.occupancy.trend}
                  />
                </View>
                <View className="flex-1">
                  <Kpi
                    label="Revenue today"
                    value={today.revenue.value}
                    unit={today.revenue.unit}
                    caption={today.revenue.caption}
                    trend={today.revenue.trend}
                  />
                </View>
              </View>
              <View className="flex-row gap-2.5">
                <View className="flex-1">
                  <Kpi
                    label="Arrivals"
                    value={today.arrivals.value}
                    unit={today.arrivals.unit}
                    caption={today.arrivals.caption}
                    onPress={() => router.push(href("mgr-flash"))}
                  />
                </View>
                <View className="flex-1">
                  <Kpi
                    label="Rooms ready"
                    value={today.ready.value}
                    unit={today.ready.unit}
                    caption={today.ready.caption}
                  />
                </View>
              </View>
            </View>

            <Section
              title="Needs you"
              action={
                today.waitingCount > 0
                  ? { label: `All ${today.waitingCount}`, onPress: () => router.navigate(href("mgr-approvals")) }
                  : undefined
              }
              className="gap-2 px-4"
            >
              {today.feature ? (
                <FeatureCard
                  feature={today.feature}
                  busy={decide.isPending}
                  onOpen={openApproval}
                  onDecide={quickDecide}
                />
              ) : null}
              {today.next.length > 0 ? (
                <ListGroup>
                  {today.next.map((approval) => (
                    <ApprovalRow key={approval.id} approval={approval} onOpen={() => openApproval(approval.id)} />
                  ))}
                </ListGroup>
              ) : null}
              {today.waitingCount === 0 ? (
                <Card tone="success">
                  <View className="flex-row items-center gap-3">
                    <Icon name="CircleCheck" size={24} />
                    <Text role="callout" strong className="flex-1">
                      Nothing waits on you. New requests show here first.
                    </Text>
                  </View>
                </Card>
              ) : null}
            </Section>

            <Section title="Right now" className="px-4">
              <Card>
                <View className="flex-row items-center justify-between gap-3">
                  <Text role="callout" strong>
                    Housekeeping
                  </Text>
                  <Text role="callout" tone="muted" tabular>
                    {`${today.housekeeping.done} of ${today.housekeeping.total} rooms`}
                  </Text>
                </View>
                <View className="mt-2">
                  <ProgressBar
                    value={Math.round((today.housekeeping.done / today.housekeeping.total) * 100)}
                    tone="success"
                    label="Rooms ready"
                  />
                </View>
                <View className="mt-3">
                  <Divider />
                </View>
                <View className="mt-2 flex-row items-center gap-1.5" style={{ minHeight: metrics.touch }}>
                  <Icon name="Wrench" size={16} tone="warning" />
                  <Text role="callout">{`${today.workOrders} work orders open`}</Text>
                </View>
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-1 flex-row items-center gap-1.5">
                    <Icon name="Comments" size={16} tone="info" />
                    <Text role="callout">{`${today.guestMessages} guest messages waiting`}</Text>
                  </View>
                  <PressArea
                    onPress={() => router.navigate(href("mgr-inbox"))}
                    accessibilityRole="link"
                    accessibilityLabel="Reply to guest messages"
                    className="items-end justify-center"
                  >
                    <Text role="callout" strong tone="accent">
                      Reply
                    </Text>
                  </PressArea>
                </View>
              </Card>
            </Section>
          </View>
        )}
      </QueryView>
    </Screen>
  );
}

/**
 * `.mx-ap`: the decision with its trail. The top opens the full request; the two buttons decide it
 * here, each its own control.
 */
function FeatureCard({
  feature,
  busy,
  onOpen,
  onDecide,
}: {
  feature: NonNullable<TodayView["feature"]>;
  busy: boolean;
  onOpen: (id: string) => void;
  onDecide: (feature: NonNullable<TodayView["feature"]>, approve: boolean) => void;
}) {
  const [first, second] = feature.trail;
  return (
    <Card padding="sm">
      <PressArea
        onPress={() => onOpen(feature.id)}
        accessibilityLabel={`${feature.title} ${feature.kicker}. Open the request`}
      >
        <View className="flex-row items-start gap-2">
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Icon name="Wrench" size={16} tone="muted" />
              <Text role="caption" tone="muted" strong className="shrink">
                {feature.kicker}
              </Text>
            </View>
            <Text role="headline" className="mt-1.5">
              {feature.title}
            </Text>
          </View>
          <Icon name="ChevronRight" size={16} tone="muted" />
        </View>
      </PressArea>
      {first && second ? (
        <View
          accessible
          accessibilityLabel={`${first.label} ${first.at}, then ${second.label.toLowerCase()} ${second.at}`}
          className="mb-3 mt-1 flex-row items-center gap-1.5"
        >
          <Icon name="CircleCheck" size={16} tone="success" />
          <Text role="caption" tone="muted">{`${first.label} ${first.at}`}</Text>
          <View className="h-0.5 flex-1 rounded-full bg-success opacity-55" />
          <Icon name="CircleCheck" size={16} tone="success" />
          <Text role="caption" tone="muted">{`${second.label} ${second.at}`}</Text>
        </View>
      ) : null}
      <View className="flex-row gap-2.5">
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          isDisabled={busy}
          onPress={() => onDecide(feature, false)}
        >
          {feature.declineLabel}
        </Button>
        <Button size="sm" className="flex-1" isDisabled={busy} onPress={() => onDecide(feature, true)}>
          {feature.approveLabel}
        </Button>
      </View>
    </Card>
  );
}
