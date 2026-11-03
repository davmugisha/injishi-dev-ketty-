import { router } from "expo-router";
import { View } from "react-native";
import {
  Avatar,
  Chip,
  IconButton,
  ListGroup,
  ListItem,
  LoadingBone,
  Screen,
  ScreenHeader,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useResidentMe } from "./data";
import type { MeView } from "./types";
import { ListBone, Skeleton } from "./ui";

/**
 * `res-me` (the Me tab): the lease, payments, household and the move-in record, then account,
 * notifications and help (X5), and the place switcher (X1). Account and help open inside this tab.
 */
export function MeScreen() {
  const query = useResidentMe();
  return (
    <Screen>
      <ScreenHeader title="Me" />
      <QueryView query={query} data={query.data} loading={<MeSkeleton />}>
        {(view) => <Me view={view} />}
      </QueryView>
    </Screen>
  );
}

function Me({ view }: { view: MeView }) {
  const account = href("shared-account", undefined, { app: "resident" });
  return (
    <View className="gap-4 px-4">
      <View className="flex-row items-center gap-3.5">
        <Avatar size="l" name={view.name} />
        <View className="flex-1">
          <Text role="title3">{view.name}</Text>
          <Text role="callout" tone="muted">
            {view.line}
          </Text>
        </View>
        <IconButton
          icon="ArrowRightArrowLeft"
          label="Switch place or role"
          variant="surface"
          onPress={() => router.push(href("shared-switcher"))}
        />
      </View>

      <ListGroup>
        <ListItem
          icon="FileText"
          title="My lease"
          subtitle={view.lease.subtitle}
          trailing={view.lease.chip ? <Chip label={view.lease.chip.label} tone={view.lease.chip.tone} /> : undefined}
          onPress={() => router.push(href("res-lease"))}
        />
        <ListItem
          icon="Wallet"
          title="Payments and statements"
          subtitle="Receipts and 2026 statement"
          onPress={() => router.push(href("res-payments"), { withAnchor: true })}
        />
        <ListItem
          icon="Persons"
          title="Household"
          subtitle={view.household}
          onPress={() => router.push(href("res-household"))}
        />
        <ListItem
          icon="Picture"
          title="Move-in record"
          subtitle={view.moveIn}
          onPress={() => router.push(href("res-movein"))}
        />
      </ListGroup>

      <ListGroup>
        <ListItem icon="Person" title="Account and privacy" onPress={() => router.push(account)} />
        <ListItem icon="Bell" title="Notifications" subtitle={view.reminders} onPress={() => router.push(account)} />
        <ListItem
          icon="CircleQuestion"
          title="Help and support"
          onPress={() => router.push(href("shared-help", undefined, { app: "resident" }))}
        />
      </ListGroup>
    </View>
  );
}

function MeSkeleton() {
  return (
    <Skeleton label="Loading your profile">
      <View className="flex-row items-center gap-3.5">
        <LoadingBone className="size-14 rounded-full" />
        <View className="flex-1 gap-2">
          <LoadingBone className="h-5 w-1/2" />
          <LoadingBone className="h-4 w-2/3" />
        </View>
      </View>
      <ListBone rows={4} />
      <ListBone rows={3} />
    </Skeleton>
  );
}
