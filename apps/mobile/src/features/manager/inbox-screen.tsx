import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  Dialog,
  EmptyView,
  FilterChips,
  IconButton,
  ListGroup,
  ListItem,
  LiveDot,
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
import { useManagerInbox, useMarkInboxRead, useResolveInboxItem } from "./data";
import type { InboxItem, InboxTag } from "./types";
import { RowBones } from "./ui";

type Filter = "all" | InboxTag;

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "alerts", label: "Alerts" },
  { value: "guests", label: "Guests" },
  { value: "team", label: "Team" },
];

const LIVE_WORD = { danger: "Urgent", warning: "Needs a look" } as const;

/**
 * Manager inbox and alerts (prototype `mgr-inbox`, X2): alerts that need action sit above ordinary
 * messages, with the unread count on each filter. A failed night audit, a complaint and an expired
 * MoMo prompt each open their record, with the one thing to do about it; doing it moves the row down,
 * saying what happened. The double tick marks everything read.
 */
export function InboxScreen() {
  const query = useManagerInbox();
  const markRead = useMarkInboxRead();
  const resolve = useResolveInboxItem();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  // The row last opened stays in the dialog while it fades out; `showing` opens and closes it.
  const [openId, setOpenId] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const close = () => setShowing(false);

  const open = (item: InboxItem) => {
    if (item.unread) markRead.mutate(item.id);
    setOpenId(item.id);
    setShowing(true);
  };

  return (
    <Screen>
      <ScreenHeader
        title="Inbox"
        right={
          <IconButton
            icon="CheckDouble"
            label="Mark all as read"
            variant="plain"
            onPress={() => markRead.mutate(undefined)}
          />
        }
      />
      <QueryView
        query={query}
        data={query.data}
        loading={
          <LoadingView label="Loading your inbox" className="px-4 pt-1">
            <View className="flex-row gap-2">
              <LoadingBone className="h-9 w-14 rounded-full" />
              <LoadingBone className="h-9 w-24 rounded-full" />
              <LoadingBone className="h-9 w-20 rounded-full" />
            </View>
            <LoadingBone className="h-5 w-28" />
            <RowBones rows={3} />
            <LoadingBone className="h-5 w-20" />
            <RowBones rows={3} />
          </LoadingView>
        }
      >
        {(inbox) => {
          if (inbox.items.length === 0) {
            return (
              <EmptyView
                icon="Comments"
                title="Nothing new"
                body="Alerts that need you, guest complaints and messages from the team land here."
                action={{
                  label: "Back to today",
                  icon: "ChartColumn",
                  onPress: () => router.navigate(href("mgr-today")),
                }}
              />
            );
          }
          // Only alerts carry a count: they are what needs action.
          const unreadAlerts = inbox.items.filter((i) => i.unread && i.tags.includes("alerts")).length;
          const options = FILTERS.map((f) => ({ ...f, count: f.value === "alerts" ? unreadAlerts : undefined }));
          const shown = inbox.items.filter((i) => filter === "all" || i.tags.includes(filter));
          const action = shown.filter((i) => i.section === "action");
          const earlier = shown.filter((i) => i.section === "earlier");
          const opened = inbox.items.find((i) => i.id === openId) ?? null;
          return (
            <View>
              <FilterChips label="Show" options={options} value={filter} onChange={setFilter} />
              {action.length > 0 ? (
                <Section title="Needs action">
                  <Rows items={action} onOpen={open} />
                </Section>
              ) : null}
              {earlier.length > 0 ? (
                <Section title="Earlier">
                  <Rows items={earlier} onOpen={open} />
                </Section>
              ) : null}
              {shown.length === 0 ? (
                <View className="px-8 pt-12">
                  <Text role="callout" tone="muted" className="text-center">
                    Nothing of this kind. Choose All to see everything.
                  </Text>
                </View>
              ) : null}
              <Dialog
                isOpen={showing && opened !== null}
                onClose={close}
                icon={opened?.icon}
                tone={opened?.tone === "default" ? "accent" : opened?.tone}
                title={opened?.title ?? ""}
                body={opened?.body}
                actions={
                  opened?.action ? (
                    <>
                      <Button
                        isDisabled={resolve.isPending}
                        onPress={() => {
                          const done = opened.action?.doneTitle ?? "";
                          resolve.mutate(opened.id, {
                            onSuccess: () => {
                              close();
                              toast.show({ icon: "CircleCheck", message: done });
                            },
                          });
                        }}
                      >
                        {opened.action.label}
                      </Button>
                      <Button variant="ghost" onPress={close}>
                        Later
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" onPress={close}>
                      Close
                    </Button>
                  )
                }
              />
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}

function Rows({ items, onOpen }: { items: InboxItem[]; onOpen: (item: InboxItem) => void }) {
  return (
    <ListGroup className="mx-4">
      {items.map((item) => (
        <ListItem
          key={item.id}
          icon={item.icon}
          tone={item.tone}
          title={item.title}
          subtitle={item.detail}
          trailing={item.unread && item.live ? <LiveDot tone={item.live} label={LIVE_WORD[item.live]} /> : undefined}
          onPress={() => onOpen(item)}
          accessibilityLabel={`${item.unread ? "Unread. " : ""}${item.title}. ${item.detail}`}
        />
      ))}
    </ListGroup>
  );
}
