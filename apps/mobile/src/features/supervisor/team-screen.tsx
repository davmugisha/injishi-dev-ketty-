import { router } from "expo-router";
import { View } from "react-native";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Icon,
  ListGroup,
  LoadingBone,
  LoadingView,
  ProgressBar,
  Screen,
  ScreenHeader,
  Section,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useDecideRequest, useTeamToday } from "./data";
import type { TeamMember, TeamRequest, TeamToday } from "./types";
import { StatTile } from "./ui";

/**
 * `sup-team`, S7: who is in, each person's progress, who has not clocked in, and the swaps and leave
 * waiting for Beatrice's first approval.
 */
export function TeamScreen() {
  const query = useTeamToday();
  return (
    <Screen>
      <QueryView query={query} data={query.data} loading={<TeamLoading />}>
        {(today) => <Team today={today} />}
      </QueryView>
    </Screen>
  );
}

function Team({ today }: { today: TeamToday }) {
  return (
    <View>
      <ScreenHeader eyebrow={today.eyebrow} title="My team today" />
      <View className="flex-row gap-2 px-4">
        {today.stats.map((stat) => (
          <StatTile
            key={stat.label}
            label={stat.label}
            value={stat.value}
            unit={stat.unit}
            tone={stat.tone}
            onPress={stat.tone ? () => router.navigate(href("sup-queue")) : undefined}
          />
        ))}
      </View>
      <Section title="On shift" />
      <ListGroup className="mx-4">
        {today.members.map((member) => (
          <MemberRow key={member.id} member={member} />
        ))}
      </ListGroup>
      {today.requests.length > 0 ? (
        <>
          <Section title="Waiting for your answer" />
          <View className="gap-2 px-4">
            {today.requests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** `.sx-mem`: a person, where she is since when, and her rooms done as a figure and a thin bar. */
function MemberRow({ member }: { member: TeamMember }) {
  const toast = useToast();
  const first = member.name.split(" ")[0];
  return (
    <View className="flex-row items-center gap-3 px-3.5 py-3" accessible={Boolean(member.progress)}>
      <Avatar size="s" source={member.photo} initials={member.initials} tone={member.progress ? "accent" : "default"} />
      <View className="flex-1 gap-1">
        <View className="flex-row items-center justify-between gap-2">
          <Text role="headline" className="shrink">
            {member.name}
          </Text>
          {member.progress ? (
            <Text role="callout" strong tabular>
              {`${member.progress.done}/${member.progress.of}`}
            </Text>
          ) : null}
        </View>
        <Text role="caption" tone="muted">
          {member.line}
        </Text>
        {member.progress ? (
          <ProgressBar
            value={(member.progress.done / member.progress.of) * 100}
            size="thin"
            label={`${member.name}, rooms done`}
            className="mt-1"
          />
        ) : null}
      </View>
      {member.progress ? null : (
        <Button
          size="sm"
          variant="secondary"
          icon="Handset"
          accessibilityLabel={`Call ${member.name}`}
          onPress={() => toast.show({ icon: "Handset", message: `Calling ${first}…` })}
        >
          Call
        </Button>
      )}
    </View>
  );
}

/** A swap or a leave request: Decline or Approve; once answered, what happens next. */
function RequestCard({ request }: { request: TeamRequest }) {
  const decide = useDecideRequest();
  const answer = (decision: "approved" | "declined") => decide.mutate({ id: request.id, decision });
  return (
    <Card>
      <View className="flex-row items-center gap-1.5">
        <Icon name={request.icon} size={12} tone="muted" />
        <Text role="caption" strong tone="muted">
          {request.kind}
        </Text>
      </View>
      <Text role="headline" className="mt-1">
        {request.title}
      </Text>
      <Text role="callout" tone="muted" className="mt-1">
        {request.body}
      </Text>
      {request.decision ? (
        <View className="mt-3 flex-row flex-wrap items-center gap-2">
          <Chip
            label={request.decision === "approved" ? "Approved" : "Declined"}
            tone={request.decision === "approved" ? "success" : "default"}
            icon={request.decision === "approved" ? "CircleCheck" : "Xmark"}
          />
          {request.outcome ? (
            <Text role="caption" tone="muted" className="flex-1">
              {request.outcome}
            </Text>
          ) : null}
        </View>
      ) : (
        <View className="mt-3 flex-row gap-2.5">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            isDisabled={decide.isPending}
            accessibilityLabel={`Decline: ${request.kind}, ${request.title}`}
            onPress={() => answer("declined")}
          >
            Decline
          </Button>
          <Button
            size="sm"
            className="flex-1"
            isDisabled={decide.isPending}
            accessibilityLabel={`Approve: ${request.kind}, ${request.title}`}
            onPress={() => answer("approved")}
          >
            Approve
          </Button>
        </View>
      )}
    </Card>
  );
}

function TeamLoading() {
  return (
    <LoadingView label="Loading your team" className="px-4 pt-2">
      <View className="gap-2">
        <LoadingBone className="h-3 w-44" />
        <LoadingBone className="h-7 w-44" />
      </View>
      <View className="flex-row gap-2">
        <LoadingBone className="h-20 flex-1 rounded-3xl" />
        <LoadingBone className="h-20 flex-1 rounded-3xl" />
        <LoadingBone className="h-20 flex-1 rounded-3xl" />
      </View>
      <LoadingBone className="h-4 w-24" />
      <LoadingBone className="h-80 rounded-3xl" />
    </LoadingView>
  );
}
