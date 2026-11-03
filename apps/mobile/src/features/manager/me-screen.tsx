import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Avatar,
  Button,
  Choice,
  Dialog,
  Divider,
  KeyValue,
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
import { href } from "@/proto/screens";
import { useManagerMe, useSetAlerts, useSetConfirmWith } from "./data";
import type { ConfirmWith, ManagerMe } from "./types";
import { RowBones } from "./ui";

type Panel = "limits" | "confirm" | "alerts" | null;

const CONFIRM_WORDS: Record<ConfirmWith, string> = {
  fingerprint: "Fingerprint, PIN as backup",
  pin: "PIN only",
};

function alertWords({ urgent, flash }: ManagerMe["alerts"]): string {
  if (urgent && flash) return "Push for urgent, a 07:30 flash report";
  if (urgent) return "Push for urgent only";
  if (flash) return "A 07:30 flash report only";
  return "Off: you check the inbox yourself";
}

/**
 * Manager Me (prototype `mgr-me`): Aline, her places (X1), her approval limits and how approvals are
 * confirmed, her alerts and the flash report, the dark look the manager app keeps, then account,
 * help and sign out.
 */
export function MeScreen() {
  const query = useManagerMe();
  const signOut = useSignOut();
  const [panel, setPanel] = useState<Panel>(null);

  const leave = () => {
    signOut();
    // Sample data: the prototype lands on sign in. Api mode: the session decides where to go.
    if (isMock) router.replace(href("shared-signin"));
  };

  return (
    <Screen>
      <ScreenHeader title="Me" />
      <QueryView
        query={query}
        data={query.data}
        loading={
          <LoadingView label="Loading your settings" className="px-4 pt-1">
            <View className="flex-row items-center gap-3.5">
              <LoadingBone className="h-20 w-20 rounded-full" />
              <View className="flex-1 gap-2">
                <LoadingBone className="h-5 w-2/5" />
                <LoadingBone className="h-4 w-4/5" />
              </View>
            </View>
            <RowBones rows={3} />
            <RowBones rows={3} />
            <RowBones rows={3} />
          </LoadingView>
        }
      >
        {(me) => (
          <View className="gap-4 px-4 pt-1">
            <View className="flex-row items-center gap-3.5">
              <Avatar size="xl" name={me.name} initials={me.initials} />
              <View className="flex-1 gap-0.5">
                <Text role="title3">{me.name}</Text>
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
                icon="ShieldCheck"
                title="My approval limits"
                subtitle={me.limitsSummary}
                onPress={() => setPanel("limits")}
              />
              <ListItem
                icon="Fingerprint"
                title="Confirm approvals with"
                subtitle={CONFIRM_WORDS[me.confirmWith]}
                onPress={() => setPanel("confirm")}
              />
            </ListGroup>
            <ListGroup>
              <ListItem
                icon="Bell"
                title="Alerts"
                subtitle={alertWords(me.alerts)}
                onPress={() => setPanel("alerts")}
              />
              <ListItem
                icon="ChartColumn"
                title="Flash report"
                subtitle="Yesterday's numbers"
                onPress={() => router.push(href("mgr-flash"), { withAnchor: true })}
              />
              {/* The manager app is drawn dark by its layout; the switch says so and stays on. */}
              <ListItem
                icon="Moon"
                title="Appearance"
                subtitle="Dark"
                trailing={<Toggle value onValueChange={() => {}} label="Dark appearance" isDisabled />}
              />
            </ListGroup>
            <ListGroup>
              <ListItem
                icon="Person"
                title="Account and privacy"
                onPress={() => router.push(href("shared-account", undefined, { app: "manager" }))}
              />
              <ListItem
                icon="CircleQuestion"
                title="Help and support"
                onPress={() => router.push(href("shared-help", undefined, { app: "manager" }))}
              />
              <ListItem icon="ArrowRightFromSquare" tone="default" title="Sign out" onPress={leave} />
            </ListGroup>
            <MePanel panel={panel} me={me} onClose={() => setPanel(null)} />
          </View>
        )}
      </QueryView>
    </Screen>
  );
}

function MePanel({ panel, me, onClose }: { panel: Panel; me: ManagerMe; onClose: () => void }) {
  const setConfirmWith = useSetConfirmWith();
  const setAlerts = useSetAlerts();
  const done = (
    <Button variant="secondary" onPress={onClose}>
      Done
    </Button>
  );
  return (
    <>
      <Dialog
        isOpen={panel === "limits"}
        onClose={onClose}
        icon="ShieldCheck"
        title="My approval limits"
        body="Set by the owner. Anything above them goes to him and shows under Waiting on others."
        actions={done}
      >
        <KeyValue className="self-stretch" rows={me.limits} />
      </Dialog>
      <Dialog
        isOpen={panel === "confirm"}
        onClose={onClose}
        icon="Fingerprint"
        title="Confirm approvals with"
        body="Every approval and release asks for it, so nobody approves from your unlocked phone."
        actions={done}
      >
        <View className="gap-2 self-stretch">
          <Choice
            title="Fingerprint"
            subtitle="Your PIN when the sensor can't read it"
            selected={me.confirmWith === "fingerprint"}
            onPress={() => setConfirmWith.mutate("fingerprint")}
          />
          <Choice
            title="PIN only"
            subtitle="Six digits, every time"
            selected={me.confirmWith === "pin"}
            onPress={() => setConfirmWith.mutate("pin")}
          />
        </View>
      </Dialog>
      <Dialog isOpen={panel === "alerts"} onClose={onClose} icon="Bell" title="Alerts" actions={done}>
        <View className="self-stretch">
          <AlertRow
            title="Urgent alerts"
            detail="A failed audit, a complaint, a payment that failed"
            value={me.alerts.urgent}
            onChange={(urgent) => setAlerts.mutate({ urgent })}
          />
          <Divider />
          <AlertRow
            title="Flash report at 07:30"
            detail="Yesterday's numbers for both properties"
            value={me.alerts.flash}
            onChange={(flash) => setAlerts.mutate({ flash })}
          />
        </View>
      </Dialog>
    </>
  );
}

function AlertRow({
  title,
  detail,
  value,
  onChange,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View className="flex-row items-center gap-3 py-2">
      <View className="flex-1">
        <Text role="callout" strong>
          {title}
        </Text>
        <Text role="caption" tone="muted">
          {detail}
        </Text>
      </View>
      <Toggle value={value} onValueChange={onChange} label={title} />
    </View>
  );
}
