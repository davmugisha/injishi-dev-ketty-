import { type Href, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  CountBadge,
  Dialog,
  Divider,
  KeyValue,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  Text,
  Toggle,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { useSignOut } from "@/features/auth/use-sign-out";
import { isMock } from "@/lib/data-mode";
import { type AppKey, href } from "@/proto/screens";
import { useSurface } from "@/proto/surface";
import { useAccount, useRequestDataExport, useSetNotifications, useSignOutDevice } from "./data";
import type { AccountView } from "./types";
import { Footnote, ListBones, ProfileHead, useBackTo } from "./ui";

/** Each app's Me screen, where Account is opened from. */
function meOf(app: AppKey): Href {
  switch (app) {
    case "resident":
      return href("res-me");
    case "manager":
      return href("mgr-me");
    case "desk":
      return href("desk-me");
    case "guest":
      return href("guest-me");
    default:
      return href("hk-me", undefined, { app });
  }
}

type Panel = "details" | "payment" | "notifications" | "devices" | "export" | null;

function notificationWords({ push, email }: AccountView["notifications"]): string {
  if (push && email) return "Push and email";
  if (push) return "Push only";
  if (email) return "Email only";
  return "Off";
}

/**
 * Account and privacy (prototype `shared-account`, X5): the person, then their details, saved ID,
 * payment numbers, language and notifications; devices, a copy of their data and help; sign out
 * and account deletion, which both stores require. Mounted in the guest, resident, manager and desk
 * apps, each showing its own person.
 */
export function AccountScreen() {
  const surface = useSurface();
  const query = useAccount(surface);
  const back = useBackTo(meOf(surface));
  const signOut = useSignOut();
  const [panel, setPanel] = useState<Panel>(null);

  const leave = () => {
    signOut();
    // Sample data: the prototype lands on sign in. Api mode: the session decides where to go.
    if (isMock) router.replace(href("shared-signin"));
  };

  return (
    <Screen header={<NavBar title="Account" onBack={back} />}>
      <QueryView
        query={query}
        data={query.data}
        loading={
          <LoadingView label="Loading your account" className="px-4 pt-2">
            <View className="flex-row items-center gap-3.5">
              <LoadingBone className="h-20 w-20 rounded-full" />
              <View className="flex-1 gap-2">
                <LoadingBone className="h-5 w-2/5" />
                <LoadingBone className="h-4 w-3/5" />
              </View>
            </View>
            <ListBones rows={5} />
            <ListBones rows={3} />
          </LoadingView>
        }
      >
        {(account) => (
          <View className="gap-4 px-4 pt-2">
            <ProfileHead person={account.person} />
            <ListGroup>
              <ListItem
                icon="Person"
                title="Personal details"
                subtitle="Name as on ID, phone, nationality"
                onPress={() => setPanel("details")}
              />
              {account.savedId && surface === "guest" ? (
                <ListItem
                  icon="ShieldCheck"
                  title="Saved ID"
                  subtitle={account.savedId}
                  onPress={() => router.push(href("guest-prearrival"))}
                />
              ) : null}
              <ListItem
                icon="Wallet"
                title="Payment numbers"
                subtitle={account.payment}
                onPress={() => setPanel("payment")}
              />
              <ListItem icon="Globe" title="Language" subtitle={account.language} value="More soon" />
              <ListItem
                icon="Bell"
                title="Notifications"
                subtitle={notificationWords(account.notifications)}
                onPress={() => setPanel("notifications")}
              />
            </ListGroup>
            <ListGroup>
              <ListItem
                icon="Smartphone"
                title="Signed-in devices"
                subtitle={account.devices.length > 1 ? "This Pixel 9 and a laptop browser" : "Only this Pixel 9"}
                trailing={<CountBadge count={account.devices.length} tone="default" />}
                onPress={() => setPanel("devices")}
              />
              <ListItem
                icon="FileText"
                title="Download my data"
                subtitle="Trips, messages and receipts as a file"
                onPress={() => setPanel("export")}
              />
              <ListItem
                icon="CircleQuestion"
                title="Help and support"
                onPress={() => router.push(href("shared-help", undefined, { app: surface }))}
              />
            </ListGroup>
            <ListGroup>
              <ListItem icon="ArrowRightFromSquare" tone="default" title="Sign out" onPress={leave} />
              <ListItem
                icon="TrashBin"
                tone="danger"
                title="Delete my account"
                titleTone="danger"
                onPress={() => router.push(href("shared-delete"))}
              />
            </ListGroup>
            <Footnote>{account.version}</Footnote>
            <AccountPanel panel={panel} account={account} onClose={() => setPanel(null)} />
          </View>
        )}
      </QueryView>
    </Screen>
  );
}

/** The detail behind a row, in a dialog over the account. */
function AccountPanel({ panel, account, onClose }: { panel: Panel; account: AccountView; onClose: () => void }) {
  const setNotifications = useSetNotifications();
  const signOutDevice = useSignOutDevice();
  const exportData = useRequestDataExport();
  const toast = useToast();
  const done = (
    <Button variant="secondary" onPress={onClose}>
      Done
    </Button>
  );

  return (
    <>
      <Dialog
        isOpen={panel === "details"}
        onClose={onClose}
        icon="Person"
        title="Personal details"
        body="As on your ID. The hotel checks them against it on arrival."
        actions={done}
      >
        <KeyValue className="self-stretch" rows={account.details} />
      </Dialog>
      <Dialog
        isOpen={panel === "payment"}
        onClose={onClose}
        icon="Wallet"
        title="Payment numbers"
        body="MoMo prompts go to this number. You can pay from another one at checkout."
        actions={done}
      >
        <KeyValue className="self-stretch" rows={[{ label: "Default", value: account.payment }]} />
      </Dialog>
      <Dialog isOpen={panel === "notifications"} onClose={onClose} icon="Bell" title="Notifications" actions={done}>
        <View className="self-stretch">
          <SwitchRow
            title="Push"
            detail="Arrivals, keys and payments, on this phone"
            value={account.notifications.push}
            onChange={(push) => setNotifications.mutate({ push })}
          />
          <Divider />
          <SwitchRow
            title="Email"
            detail={`Receipts and booking changes, to ${account.person.email}`}
            value={account.notifications.email}
            onChange={(email) => setNotifications.mutate({ email })}
          />
        </View>
      </Dialog>
      <Dialog
        isOpen={panel === "devices"}
        onClose={onClose}
        icon="Smartphone"
        title="Signed-in devices"
        body="Signing a device out ends its session at once."
        actions={done}
      >
        <View className="self-stretch">
          {account.devices.map((device, index) => (
            <View key={device.id}>
              {index > 0 ? <Divider /> : null}
              <View className="flex-row items-center gap-3 py-2">
                <View className="flex-1">
                  <Text role="callout" strong>
                    {device.name}
                  </Text>
                  <Text role="caption" tone="muted">
                    {device.current ? `${device.detail} · this phone` : device.detail}
                  </Text>
                </View>
                {device.current ? null : (
                  <Button
                    size="sm"
                    variant="dangerSoft"
                    onPress={() => signOutDevice.mutate(device.id)}
                    accessibilityLabel={`Sign out ${device.name}`}
                  >
                    Sign out
                  </Button>
                )}
              </View>
            </View>
          ))}
        </View>
      </Dialog>
      <Dialog
        isOpen={panel === "export"}
        onClose={onClose}
        icon="FileText"
        title="Download my data"
        body={`We put your trips, messages and receipts into one file and email it to ${account.person.email} within a day.`}
        actions={
          <>
            <Button
              onPress={() =>
                exportData.mutate(undefined, {
                  onSuccess: () => {
                    onClose();
                    toast.show({ icon: "Envelope", message: `Your file is on its way to ${account.person.email}` });
                  },
                })
              }
            >
              Email me the file
            </Button>
            <Button variant="ghost" onPress={onClose}>
              Cancel
            </Button>
          </>
        }
      />
    </>
  );
}

function SwitchRow({
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
