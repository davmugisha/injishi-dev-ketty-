import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Avatar,
  Button,
  Chip,
  Dialog,
  Icon,
  IconButton,
  ListGroup,
  ListItem,
  LoadingBone,
  metrics,
  Photo,
  PressArea,
  Screen,
  ScreenHeader,
  Section,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { useBuilding, useMarkNoticeRead } from "./data";
import type { BuildingView, Notice } from "./types";
import { CardBone, ListBone, Skeleton, useNotify } from "./ui";

/**
 * `res-building` (R3, the Building tab): notices, visitors and household together, the part of the
 * app residents open most between rent days. A notice opens in full and stops being new; visitors
 * open their code (or, for a trade, the repair they come for); the household row opens Household.
 */
export function BuildingScreen() {
  const query = useBuilding();
  return (
    <Screen>
      <ScreenHeader
        eyebrow={query.data?.name ?? "Your building"}
        title="Building"
        right={
          <IconButton
            icon="QrCode"
            label="Make a visitor code"
            variant="surface"
            onPress={() => router.push(href("res-visitor"))}
          />
        }
      />
      <QueryView query={query} data={query.data} loading={<BuildingSkeleton />}>
        {(view) => <Building view={view} />}
      </QueryView>
    </Screen>
  );
}

function Building({ view }: { view: BuildingView }) {
  const [open, setOpen] = useState<Notice | null>(null);
  const { mutate: markRead } = useMarkNoticeRead();
  const notify = useNotify();
  const read = (notice: Notice) => {
    setOpen(notice);
    if (notice.isNew) markRead(notice.id, { onError: notify.failed });
  };
  return (
    <>
      <View className="px-4">
        <Photo
          source={view.photo}
          height={metrics.photo.tile}
          radius="lg"
          label={`${view.name}, the shared garden`}
          bottom={<Chip variant="glass" icon="Persons" label={view.homes} />}
        />
      </View>

      <Section title="Notices">
        {view.notices.length === 0 ? (
          <Text role="callout" tone="muted" className="px-4">
            No notices from management right now.
          </Text>
        ) : (
          <ListGroup className="mx-4">
            {view.notices.map((n) => (
              <ListItem
                key={n.id}
                icon={n.icon}
                tone={n.tone}
                title={n.title}
                subtitle={n.subtitle}
                trailing={n.isNew ? <Chip label="New" tone="warning" /> : undefined}
                chevron={false}
                onPress={() => read(n)}
              />
            ))}
          </ListGroup>
        )}
      </Section>

      <Section title="Visitors" action={{ label: "New code", onPress: () => router.push(href("res-visitor")) }}>
        {view.visitors.length === 0 ? (
          <Text role="callout" tone="muted" className="px-4">
            Nobody expected. Make a code for each visit; it stops working by itself.
          </Text>
        ) : (
          <ListGroup className="mx-4">
            {view.visitors.map((v) => (
              <ListItem
                key={v.id}
                icon={v.icon}
                tone={v.tone}
                title={v.name}
                subtitle={v.subtitle}
                trailing={<Chip label={v.status.label} tone={v.status.tone} />}
                onPress={() =>
                  v.repairId
                    ? router.push(href("res-repair", { id: v.repairId }))
                    : router.push(href("res-visitor", { id: v.id }))
                }
              />
            ))}
          </ListGroup>
        )}
      </Section>

      <Section title="Household" action={{ label: "Manage", onPress: () => router.push(href("res-household")) }} />
      <PressArea
        onPress={() => router.push(href("res-household"))}
        accessibilityLabel={`Household: ${view.household.summary}`}
        feedback="native"
        className="mx-4 overflow-hidden rounded-2xl"
      >
        <View className="flex-row items-center gap-2 py-1">
          {view.household.people.map((p) => (
            <Avatar key={p.initials + p.name} initials={p.initials} tone={p.tone} />
          ))}
          <Text role="callout" tone="muted" className="flex-1">
            {view.household.summary}
          </Text>
          <Icon name="ChevronRight" size={16} tone="muted" />
        </View>
      </PressArea>

      <Dialog
        isOpen={open !== null}
        onClose={() => setOpen(null)}
        icon={open?.icon}
        tone={open?.tone === "default" ? "accent" : open?.tone}
        title={open?.title ?? ""}
        body={open ? `${open.body}\n\n${open.postedBy}` : undefined}
        actions={<Button onPress={() => setOpen(null)}>Got it</Button>}
      />
    </>
  );
}

function BuildingSkeleton() {
  return (
    <Skeleton label="Loading your building">
      <CardBone />
      <LoadingBone className="h-5 w-1/4" />
      <ListBone rows={3} />
      <LoadingBone className="h-5 w-1/4" />
      <ListBone rows={2} />
    </Skeleton>
  );
}
