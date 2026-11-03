import { router } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Icon,
  IconTile,
  KeyValue,
  ListGroup,
  ListItem,
  NavBar,
  ProgressBar,
  Screen,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useLease } from "./data";
import type { LeaseDocument, LeaseView } from "./types";
import { backOr, CardBone, ListBone, Skeleton, useNotify } from "./ui";

/**
 * `res-lease`: where the lease stands at a glance, the pending renewal, the key terms and the
 * signed documents. Notice to move out is a quiet secondary action at the foot.
 */
export function LeaseScreen() {
  const query = useLease();
  return (
    <Screen header={<NavBar title="My lease" subtitle={query.data?.id} onBack={() => backOr(href("res-me"))} />}>
      <QueryView
        query={query}
        data={query.data}
        loading={
          <Skeleton label="Loading your lease">
            <CardBone size="lg" />
            <CardBone size="sm" />
            <CardBone size="lg" />
            <ListBone rows={3} />
          </Skeleton>
        }
      >
        {(view) => <Lease view={view} />}
      </QueryView>
    </Screen>
  );
}

function Lease({ view }: { view: LeaseView }) {
  const notify = useNotify();
  const openDocument = (doc: LeaseDocument) => {
    if (doc.opens === "movein") router.push(href("res-movein"));
    // The lease and its rules are files: in mock mode, "opening" one keeps a copy on the phone.
    else notify.done(`${doc.title} saved to this phone as a PDF`, "ArrowDownToLine");
  };
  return (
    <View className="gap-4 px-4">
      <Card tone="accent" padding="lg">
        <View className="flex-row items-center justify-between gap-3">
          <Text role="micro" tone="muted" caps strong className="shrink">
            {view.unitLine}
          </Text>
          <Chip label={view.status.label} variant="glass" />
        </View>
        <Text role="title2" className="mt-2">
          {view.term}
        </Text>
        <ProgressBar className="mt-3" value={view.progress} size="thin" label={`${view.day}, ${view.left}`} />
        <View className="mt-2 flex-row justify-between gap-3">
          <Text role="caption" tone="muted">
            {view.day}
          </Text>
          <Text role="caption" tone="muted">
            {view.left}
          </Text>
        </View>
      </Card>

      {view.renewal ? <RenewalCard renewal={view.renewal} /> : null}

      <Card padding="sm">
        <KeyValue rows={view.terms} />
      </Card>

      <ListGroup>
        {view.documents.map((doc) => (
          <ListItem
            key={doc.id}
            icon={doc.icon}
            tone={doc.tone}
            title={doc.title}
            subtitle={doc.subtitle}
            onPress={() => openDocument(doc)}
          />
        ))}
      </ListGroup>

      <Button variant="outline" onPress={() => router.push(href("res-moveout"))}>
        Give notice to move out
      </Button>
    </View>
  );
}

/** The renewal offer waiting for an answer, or the signed renewal waiting for the landlord. */
function RenewalCard({ renewal }: { renewal: NonNullable<LeaseView["renewal"]> }) {
  const offered = renewal.state === "offered";
  const open = () => router.push(href("res-renewal"));
  return (
    <Card
      tone={offered ? "accentSoft" : "success"}
      onPress={open}
      accessibilityLabel={`${renewal.title}. ${renewal.detail}`}
    >
      <View className="flex-row items-center gap-3.5">
        <IconTile icon={offered ? "ArrowsRotateRight" : "FileCheck"} tone={offered ? "accent" : "success"} />
        <View className="flex-1 gap-1">
          <Text role="headline">{renewal.title}</Text>
          <Text role="caption" tone="muted">
            {renewal.detail}
          </Text>
        </View>
        {offered ? (
          <Button size="sm" variant="deep" onPress={open}>
            Review
          </Button>
        ) : (
          <Icon name="ChevronRight" size={16} tone="muted" />
        )}
      </View>
    </Card>
  );
}
