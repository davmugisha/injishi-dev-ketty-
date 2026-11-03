import { router } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Card,
  Chip,
  EmptyView,
  Icon,
  IconTile,
  ListGroup,
  ListItem,
  metrics,
  Photo,
  Screen,
  ScreenHeader,
  Section,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useRequests } from "./data";
import type { RepairSummary, RequestsView } from "./types";
import { CardBone, ListBone, Skeleton } from "./ui";

/**
 * `res-requests` (the Requests tab): emergency first, then one big "Request a repair". Open
 * requests show who is coming and when, with their unread messages; done ones stay below.
 */
export function RequestsScreen() {
  const query = useRequests();
  return (
    <Screen>
      <ScreenHeader title="Requests" />
      <View className="gap-3 px-4">
        <Card
          tone="danger"
          padding="sm"
          onPress={() => router.push(href("res-emergency"))}
          accessibilityLabel="Water, power, lock or safety? Call the caretaker first, then report it"
        >
          <View className="flex-row items-center gap-3.5">
            <IconTile icon="TriangleExclamation" tone="danger" />
            <View className="flex-1 gap-1">
              <Text role="headline">Water, power, lock or safety?</Text>
              <Text role="caption" tone="muted">
                Call the caretaker first, then report it
              </Text>
            </View>
            <Icon name="ChevronRight" size={16} tone="danger" />
          </View>
        </Card>
        <Button size="lg" icon="Plus" onPress={() => router.push(href("res-repair-new"))}>
          Request a repair
        </Button>
      </View>
      <QueryView query={query} data={query.data} loading={<RequestsSkeleton />}>
        {(view) => <Requests view={view} />}
      </QueryView>
    </Screen>
  );
}

function Requests({ view }: { view: RequestsView }) {
  if (view.open.length === 0 && view.done.length === 0) {
    return (
      <EmptyView
        icon="Wrench"
        title="No repair requests"
        body="When something in your home breaks, report it here. You see who is coming, when, and every message."
        action={{ label: "Request a repair", icon: "Plus", onPress: () => router.push(href("res-repair-new")) }}
      />
    );
  }
  return (
    <>
      {view.open.length > 0 ? (
        <Section title="Open">
          <ListGroup className="mx-4">
            {view.open.map((r) => (
              <OpenRow key={r.id} repair={r} />
            ))}
          </ListGroup>
        </Section>
      ) : null}
      {view.done.length > 0 ? (
        <Section title="Done">
          <ListGroup className="mx-4">
            {view.done.map((r) => (
              <ListItem
                key={r.id}
                icon="CircleCheck"
                tone="success"
                title={r.title}
                subtitle={r.subtitle}
                onPress={() => router.push(href("res-repair", { id: r.id }))}
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}
    </>
  );
}

/** `.li.big`: the request's first photo, who comes when, its state and its unread messages. */
function OpenRow({ repair }: { repair: RepairSummary }) {
  const unread = repair.unread > 0 ? `${repair.unread} new message${repair.unread === 1 ? "" : "s"}` : null;
  return (
    <ListItem
      size="lg"
      leading={
        repair.photo ? (
          <Photo source={repair.photo} width={metrics.thumb} height={metrics.thumb} radius="sm" />
        ) : (
          <IconTile icon="Wrench" tone={repair.status.tone} size="lg" />
        )
      }
      title={repair.title}
      subtitle={repair.subtitle}
      meta={
        <>
          <Chip label={repair.status.label} tone={repair.status.tone} icon={repair.status.icon} />
          {unread ? (
            <Text role="caption" tone="muted">
              {unread}
            </Text>
          ) : null}
        </>
      }
      onPress={() => router.push(href("res-repair", { id: repair.id }))}
      accessibilityLabel={[repair.title, repair.subtitle, repair.status.label, unread].filter(Boolean).join(", ")}
    />
  );
}

function RequestsSkeleton() {
  return (
    <Skeleton label="Loading your requests">
      <View className="mt-3 gap-2">
        <CardBone size="sm" />
      </View>
      <ListBone rows={2} />
    </Skeleton>
  );
}
