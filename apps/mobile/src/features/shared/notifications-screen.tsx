import { type Href, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  EmptyView,
  FilterChips,
  IconButton,
  ListGroup,
  ListItem,
  LiveDot,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  Section,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { type AppKey, href } from "@/proto/screens";
import { useSurface } from "@/proto/surface";
import { useMarkNotifsRead, useNotifications } from "./data";
import type { Notif } from "./types";
import { ListBones, useBackTo } from "./ui";

/** The staff app's home: back from the inbox when it was opened with no history. */
function homeOf(app: AppKey): Href {
  if (app === "supervisor") return href("sup-floor");
  if (app === "technician") return href("tech-jobs");
  return href("hk-today");
}

/** What a row opens, in the app the inbox sits in, and whether that is a tab root (navigate) or pushed. */
function targetOf(n: Notif, app: AppKey): { to: Href; root: boolean } {
  switch (n.opens) {
    case "task":
      return { to: href("hk-task", { room: n.room ?? "204" }), root: false };
    case "rooms":
      return { to: href("hk-rooms"), root: true };
    case "schedule":
      return { to: href("hk-schedule", undefined, { app }), root: true };
    case "payslip":
      return { to: href("hk-me", undefined, { app }), root: true };
    case "roomSheet":
      return { to: href("sup-room", { room: n.room ?? "207" }), root: false };
    case "inspect":
      return { to: href("sup-inspect", { room: n.room ?? "201" }), root: false };
    case "team":
      return { to: href("sup-team"), root: true };
    case "job":
      return { to: href("tech-job"), root: false };
    case "jobs":
      return { to: href("tech-jobs"), root: true };
  }
}

const LIVE_WORD = { danger: "Urgent", success: "Good news", warning: "Needs a look" } as const;

/**
 * Staff inbox (prototype `shared-notifs`, X2): alerts and messages in one feed, today first, filtered
 * by kind, with the unread count on each filter. Each row opens the room, shift or payslip it is
 * about and is marked read; the double tick marks everything read. Mounted in the housekeeper,
 * supervisor and technician apps, each with its own feed and links.
 */
export function NotificationsScreen() {
  const surface = useSurface();
  const query = useNotifications(surface);
  const markRead = useMarkNotifsRead();
  const [filter, setFilter] = useState("all");
  const back = useBackTo(homeOf(surface));

  const open = (n: Notif) => {
    if (n.unread) markRead.mutate({ app: surface, id: n.id });
    const { to, root } = targetOf(n, surface);
    if (root) router.navigate(to);
    else router.push(to, { withAnchor: true });
  };

  return (
    <Screen
      header={
        <NavBar
          title="Inbox"
          onBack={back}
          right={
            <IconButton
              icon="CheckDouble"
              label="Mark all as read"
              variant="plain"
              onPress={() => markRead.mutate({ app: surface })}
            />
          }
        />
      }
    >
      <QueryView
        query={query}
        data={query.data}
        loading={
          <LoadingView label="Loading your inbox" className="px-4 pt-2">
            <View className="flex-row gap-2">
              <LoadingBone className="h-9 w-14 rounded-full" />
              <LoadingBone className="h-9 w-24 rounded-full" />
              <LoadingBone className="h-9 w-24 rounded-full" />
            </View>
            <LoadingBone className="h-5 w-20" />
            <ListBones rows={3} />
            <LoadingBone className="h-5 w-20" />
            <ListBones rows={3} />
          </LoadingView>
        }
      >
        {(view) => {
          if (view.items.length === 0) {
            return (
              <EmptyView
                icon="Bell"
                title="You're all caught up"
                body="Rush rooms, messages from the desk and pay news show here as they arrive."
                action={{ label: "Back to today", icon: "House", onPress: back }}
              />
            );
          }
          const options = view.filters.map((f) => ({
            value: f.value,
            label: f.label,
            count: f.value === "all" ? undefined : view.items.filter((n) => n.category === f.value && n.unread).length,
          }));
          const shown = view.items.filter((n) => filter === "all" || n.category === filter);
          const today = shown.filter((n) => n.section === "today");
          const earlier = shown.filter((n) => n.section === "earlier");
          return (
            <View className="pt-1">
              <FilterChips label="Show" options={options} value={filter} onChange={setFilter} />
              {today.length > 0 ? (
                <Section title="Today">
                  <Rows items={today} onOpen={open} />
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
                    Nothing of this kind yet. Choose All to see everything.
                  </Text>
                </View>
              ) : null}
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}

function Rows({ items, onOpen }: { items: Notif[]; onOpen: (n: Notif) => void }) {
  return (
    <ListGroup className="mx-4">
      {items.map((n) => (
        <ListItem
          key={n.id}
          icon={n.icon}
          tone={n.tone}
          title={n.title}
          subtitle={n.detail}
          trailing={n.unread && n.live ? <LiveDot tone={n.live} label={LIVE_WORD[n.live]} /> : undefined}
          onPress={() => onOpen(n)}
          accessibilityLabel={`${n.unread ? "Unread. " : ""}${n.title}. ${n.detail}`}
        />
      ))}
    </ListGroup>
  );
}
