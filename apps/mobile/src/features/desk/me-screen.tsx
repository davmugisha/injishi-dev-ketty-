import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Avatar,
  Button,
  Dialog,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  Screen,
  ScreenHeader,
  Text,
  Toggle,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useSignOut } from "@/features/auth/use-sign-out";
import { isMock } from "@/lib/data-mode";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { protoSignOut } from "@/proto/session";
import { useDeskMe, useSaveDeskSettings } from "./data";
import type { DeskMe, DeskSettings } from "./types";

type Panel = "receipts" | "notifications";
const isPanel = (value: string | undefined): value is Panel => value === "receipts" || value === "notifications";

/** "By SMS and in the guest's app · no printer". */
function receiptsLine(s: DeskSettings): string {
  const ways = [s.receiptsBySms ? "By SMS" : null, s.receiptsInApp ? "in the guest's app" : null].filter(Boolean);
  if (ways.length === 0) return "Off · guests ask at the desk";
  const said = ways.join(" and ");
  return `${said.charAt(0).toUpperCase()}${said.slice(1)} · no printer`;
}

/** "New bookings, arrivals, guest messages". */
function notificationsLine(s: DeskSettings): string {
  const on = [
    s.notifyBookings ? "New bookings" : null,
    s.notifyArrivals ? "arrivals" : null,
    s.notifyMessages ? "guest messages" : null,
  ].filter((w): w is string => w !== null);
  if (on.length === 0) return "All off";
  const said = on.join(", ");
  return `${said.charAt(0).toUpperCase()}${said.slice(1)}`;
}

/**
 * `desk-me`: places (X1), how receipts reach guests, and what works on weak signal. Receipts and
 * Notifications open their switches here; a link can open one (`?open=receipts`).
 */
export function MeScreen() {
  const { open } = useScreenParams("desk-me");
  const [panel, setPanel] = useState<Panel | null>(isPanel(open) ? open : null);
  const query = useDeskMe();
  const signOut = useSignOut();

  const leave = () => {
    // Sample data has no account to sign out of: the sample session ends and sign in opens, as in
    // the prototype. With the API, the real sign out asks about anything still unsent first.
    if (isMock) {
      protoSignOut();
      router.replace(href("shared-signin"));
      return;
    }
    signOut();
  };

  return (
    <Screen>
      <ScreenHeader title="Me" />
      <QueryView query={query} data={query.data} loading={<MeSkeleton />}>
        {(me) => (
          <>
            <Profile me={me} onPanel={setPanel} onSignOut={leave} />
            <SettingsDialog panel={panel} settings={me.settings} onClose={() => setPanel(null)} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}

function Profile({ me, onPanel, onSignOut }: { me: DeskMe; onPanel: (panel: Panel) => void; onSignOut: () => void }) {
  return (
    <View className="gap-4 px-4">
      <View className="flex-row items-center gap-3.5">
        <Avatar size="xl" name={me.name} />
        <View className="flex-1">
          <Text role="title3" strong>
            {me.name}
          </Text>
          <Text role="callout" tone="muted">
            {me.role}
          </Text>
        </View>
      </View>
      <ListGroup>
        <ListItem
          icon="ArrowRightArrowLeft"
          title="Places"
          subtitle={me.places}
          onPress={() => router.push(href("shared-switcher"))}
        />
        <ListItem
          icon="Receipt"
          title="Receipts"
          subtitle={receiptsLine(me.settings)}
          onPress={() => onPanel("receipts")}
        />
        <ListItem
          icon="CloudSlash"
          title="Weak signal"
          subtitle="Check-ins save on the phone · payments need signal"
          onPress={() => router.push(href("shared-outbox", undefined, { app: "desk" }))}
        />
      </ListGroup>
      <ListGroup>
        <ListItem
          icon="Bell"
          title="Notifications"
          subtitle={notificationsLine(me.settings)}
          onPress={() => onPanel("notifications")}
        />
        <ListItem
          icon="Person"
          title="Account and privacy"
          onPress={() => router.push(href("shared-account", undefined, { app: "desk" }))}
        />
        <ListItem
          icon="CircleQuestion"
          title="Help and support"
          onPress={() => router.push(href("shared-help", undefined, { app: "desk" }))}
        />
        <ListItem icon="ArrowRightFromSquare" tone="default" title="Sign out" onPress={onSignOut} />
      </ListGroup>
    </View>
  );
}

const SWITCHES = {
  receipts: {
    title: "Receipts",
    body: "The fiscal receipt reaches the guest without a printer.",
    rows: [
      { key: "receiptsBySms", title: "By SMS", subtitle: "To the number that paid" },
      { key: "receiptsInApp", title: "In the guest's app", subtitle: "When the stay is claimed with the QR" },
    ],
  },
  notifications: {
    title: "Notifications",
    body: "What this phone tells you while you are on desk.",
    rows: [
      { key: "notifyBookings", title: "New bookings", subtitle: "Made on Injishi for this place" },
      { key: "notifyArrivals", title: "Arrivals", subtitle: "When a guest is on the way" },
      { key: "notifyMessages", title: "Guest messages", subtitle: "Requests sent in the app" },
    ],
  },
} as const satisfies Record<
  Panel,
  { title: string; body: string; rows: readonly { key: keyof DeskSettings; title: string; subtitle: string }[] }
>;

/** Receipts or Notifications: their switches, each saved as it is turned. */
function SettingsDialog({
  panel,
  settings,
  onClose,
}: {
  panel: Panel | null;
  settings: DeskSettings;
  onClose: () => void;
}) {
  const save = useSaveDeskSettings();
  const spec = SWITCHES[panel ?? "receipts"];
  return (
    <Dialog
      isOpen={panel !== null}
      onClose={onClose}
      icon={panel === "notifications" ? "Bell" : "Receipt"}
      title={spec.title}
      body={spec.body}
      actions={<Button onPress={onClose}>Done</Button>}
    >
      <ListGroup>
        {spec.rows.map((row) => (
          <ListItem
            key={row.key}
            title={row.title}
            subtitle={row.subtitle}
            trailing={
              <Toggle
                value={settings[row.key]}
                onValueChange={(next) => save.mutate({ [row.key]: next })}
                label={row.title}
              />
            }
          />
        ))}
      </ListGroup>
    </Dialog>
  );
}

function MeSkeleton() {
  return (
    <LoadingView label="Loading your profile" className="px-4">
      <View className="flex-row items-center gap-3.5">
        <LoadingBone className="size-20 rounded-full" />
        <View className="flex-1 gap-2">
          <LoadingBone className="h-5 w-1/2" />
          <LoadingBone className="h-4 w-4/5" />
        </View>
      </View>
      <LoadingBone className="h-52 rounded-3xl" />
      <LoadingBone className="h-60 rounded-3xl" />
    </LoadingView>
  );
}
