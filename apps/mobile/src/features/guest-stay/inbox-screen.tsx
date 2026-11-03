import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Avatar,
  CountBadge,
  EmptyView,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  metrics,
  PressArea,
  Screen,
  ScreenHeader,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { haptic } from "@/lib/haptics";
import { href } from "@/proto/screens";
import { useInbox, useMarkUpdatesSeen } from "./data";
import type { Inbox, InboxThread, InboxUpdate } from "./types";
import { Eyebrow, ListBones, openScreen, RoundIcon } from "./ui";

type Tab = "messages" | "updates";

/**
 * Inbox (X2): one inbox for every desk at the hotel and Injishi support, the threads of this stay first.
 * Updates the app posts itself (key ready, payment confirmed) sit in their own tab. The guest tab root.
 */
export function InboxScreen() {
  const inbox = useInbox();
  const seen = useMarkUpdatesSeen();
  const [tab, setTab] = useState<Tab>("messages");
  const choose = (next: Tab) => {
    setTab(next);
    if (next === "updates" && inbox.data?.newUpdates) seen.mutate();
  };
  return (
    <Screen>
      <ScreenHeader title="Inbox" />
      <QueryView offlineNote={null} query={inbox} data={inbox.data} loading={<InboxBones />}>
        {(data) =>
          data.groups.length === 0 ? (
            <EmptyView
              icon="Comments"
              title="No messages yet"
              body="Messages from the places you stay will show here, and staff answer them themselves."
              action={{ label: "Find a stay", icon: "Magnifier", onPress: () => router.navigate(href("guest-explore")) }}
            />
          ) : (
            <View className="gap-5">
              <View className="px-4">
                <InboxTabs value={tab} onChange={choose} count={data.newUpdates} />
              </View>
              {tab === "messages" ? <Messages inbox={data} /> : <Updates updates={data.updates} />}
            </View>
          )
        }
      </QueryView>
    </Screen>
  );
}

function Messages({ inbox }: { inbox: Inbox }) {
  const open = (thread: InboxThread) => {
    if (thread.opens === "help") openScreen(href("shared-help"));
    else router.push(href("guest-chat", { thread: thread.id }));
  };
  return (
    <View className="gap-5">
      {inbox.groups.map((group) => (
        <View key={group.title} className="gap-2">
          <Eyebrow className="px-4">{group.title}</Eyebrow>
          <ListGroup className="mx-4">
            {group.threads.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} onPress={() => open(thread)} />
            ))}
          </ListGroup>
        </View>
      ))}
      <Text role="caption" tone="muted" className="px-4 text-center">
        {inbox.footnote}
      </Text>
    </View>
  );
}

/** `.gx-thread`: who, when, the last line; unread threads in the page's ink with an accent count. */
function ThreadRow({ thread, onPress }: { thread: InboxThread; onPress: () => void }) {
  const unread = thread.unread > 0;
  const label = [thread.name, thread.preview, thread.time, unread ? `${thread.unread} unread` : null]
    .filter(Boolean)
    .join(", ");
  return (
    <PressArea onPress={onPress} feedback="native" accessibilityLabel={label} className="overflow-hidden">
      <View className="flex-row items-center gap-3 p-3.5" style={{ minHeight: metrics.rowLarge }}>
        {thread.lead.kind === "photo" ? (
          <Avatar size="m" source={thread.lead.photo} />
        ) : (
          <RoundIcon icon={thread.lead.icon} />
        )}
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-baseline justify-between gap-2">
            <Text role="callout" strong numberOfLines={1} className="shrink">
              {thread.name}
            </Text>
            <Text role="caption" strong={unread} tone={unread ? "accent" : "muted"}>
              {thread.time}
            </Text>
          </View>
          <Text role="callout" strong={unread} tone={unread ? "default" : "muted"} numberOfLines={1}>
            {thread.preview}
          </Text>
        </View>
        {unread ? <CountBadge count={thread.unread} tone="accent" /> : null}
      </View>
    </PressArea>
  );
}

function Updates({ updates }: { updates: InboxUpdate[] }) {
  const open = (update: InboxUpdate) => {
    if (update.opens === "key") router.push(href("guest-key"));
    else if (update.opens === "order") router.push(href("guest-order-status"));
    else router.push(href("guest-bill"));
  };
  return (
    <View className="gap-2">
      <Eyebrow className="px-4">From Injishi and the hotel</Eyebrow>
      <ListGroup className="mx-4">
        {updates.map((update) => (
          <ListItem
            key={update.id}
            icon={update.icon}
            tone={update.tone}
            title={update.title}
            subtitle={`${update.detail} · ${update.time}`}
            onPress={() => open(update)}
          />
        ))}
      </ListGroup>
      <Text role="caption" tone="muted" className="mt-3 px-4 text-center">
        Updates are sent by the app. To ask something, message the desk.
      </Text>
    </View>
  );
}

/** `.seg` with a count on Updates: the kit's `Segmented` has no count, so this draws its look with one. */
function InboxTabs({ value, onChange, count }: { value: Tab; onChange: (tab: Tab) => void; count: number }) {
  const tabs: { value: Tab; label: string; count: number }[] = [
    { value: "messages", label: "Messages", count: 0 },
    { value: "updates", label: "Updates", count },
  ];
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Inbox" className="flex-row rounded-2xl bg-default">
      {tabs.map((t) => {
        const on = t.value === value;
        return (
          <PressArea
            key={t.value}
            feedback="none"
            onPress={() => {
              if (on) return;
              haptic.selection();
              onChange(t.value);
            }}
            accessibilityRole="tab"
            accessibilityLabel={t.count > 0 ? `${t.label}, ${t.count} new` : t.label}
            accessibilityState={{ selected: on }}
            className="flex-1 justify-center p-1"
          >
            <View
              className={`flex-row items-center justify-center gap-1.5 rounded-xl px-2 ${on ? "bg-surface shadow-surface" : ""}`}
              style={{ minHeight: metrics.segment }}
            >
              <Text role="callout" strong tone={on ? "default" : "muted"} maxScale={1.5}>
                {t.label}
              </Text>
              {t.count > 0 ? <CountBadge count={t.count} tone="accent" /> : null}
            </View>
          </PressArea>
        );
      })}
    </View>
  );
}

function InboxBones() {
  return (
    <LoadingView label="Loading your messages" className="px-4">
      <LoadingBone className="h-12 w-full rounded-2xl" />
      <LoadingBone className="mt-1 h-3 w-1/2" />
      <ListBones rows={3} />
      <LoadingBone className="mt-1 h-3 w-1/4" />
      <ListBones rows={1} />
    </LoadingView>
  );
}
