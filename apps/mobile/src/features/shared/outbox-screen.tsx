import { type Href, Redirect } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Card,
  Chip,
  type ChipTone,
  Icon,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { isMock } from "@/lib/data-mode";
import { type AppKey, href } from "@/proto/screens";
import { useSurface } from "@/proto/surface";
import { useDismissOutboxItem, useOutbox, useSendOutboxNow } from "./data";
import type { OutboxItem, OutboxItemState } from "./types";
import { Eyebrow, ListBones, useBackTo } from "./ui";

/** Back from the outbox when it was opened with no history: the app's own screen that links here. */
function homeOf(app: AppKey): Href {
  if (app === "desk") return href("desk-me");
  if (app === "housekeeper") return href("hk-today");
  return "/";
}

const STATE_CHIP: Record<Exclude<OutboxItemState, "sent" | "refused">, { label: string; tone: ChipTone }> = {
  waiting: { label: "Waiting", tone: "warning" },
  sending: { label: "Sending", tone: "warning" },
  trying: { label: "Still trying", tone: "warning" },
};

function things(n: number): string {
  return n === 1 ? "1 thing" : `${n} things`;
}

/**
 * Outbox, saved on this phone (prototype `shared-outbox`, X3; mobile spec 0003, AC-8): what waits for
 * signal and what others still see meanwhile ("front desk still sees Dirty"), what Injishi refused and
 * why, and what was sent today. Sample data shows the prototype's rows and "Try sending now" sends
 * them; api mode shows the signed in account's real rows and sends them with the real outbox.
 */
export function OutboxScreen() {
  const surface = useSurface();
  const query = useOutbox();
  const sendNow = useSendOutboxNow();
  const dismiss = useDismissOutboxItem();
  const back = useBackTo(homeOf(surface));
  const waitingCount = query.data?.waiting.length ?? 0;

  return (
    <Screen
      header={
        <NavBar
          title="On this phone"
          subtitle={
            query.data ? (waitingCount > 0 ? "Waiting for signal" : "Everything has reached Injishi") : undefined
          }
          onBack={back}
        />
      }
    >
      <QueryView
        query={query}
        data={query.data}
        loading={
          <LoadingView label="Loading what is on this phone" className="px-4 pt-2">
            <LoadingBone className="h-24 rounded-3xl" />
            <ListBones rows={2} />
            <LoadingBone className="h-12 rounded-full" />
            <LoadingBone className="h-3 w-24" />
            <ListBones rows={3} />
          </LoadingView>
        }
      >
        {(view) => {
          // Api mode with nobody signed in: these rows belong to no one here.
          if (!isMock && !view.signedIn) return <Redirect href="/" />;
          const waiting = view.waiting.length;
          return (
            <View className="gap-4 px-4 pt-2">
              {waiting > 0 ? (
                <Card tone="warning">
                  <View className="flex-row items-center gap-3.5">
                    <Icon name="CloudSlash" size={32} />
                    <View className="flex-1 gap-1">
                      <Text role="headline">{`${things(waiting)} waiting to send`}</Text>
                      <Text role="callout">
                        They send by themselves when signal is back. Closing the app loses nothing.
                      </Text>
                    </View>
                  </View>
                </Card>
              ) : (
                <Card tone="success">
                  <View className="flex-row items-center gap-3.5">
                    <Icon name="CloudCheck" size={32} />
                    <View className="flex-1 gap-1">
                      <Text role="headline">Everything is sent</Text>
                      <Text role="callout">
                        What you do without signal waits here, and sends itself when signal is back.
                      </Text>
                    </View>
                  </View>
                </Card>
              )}

              {waiting > 0 ? (
                <ListGroup>
                  {view.waiting.map((item) => (
                    <WaitingRow key={item.id} item={item} />
                  ))}
                </ListGroup>
              ) : null}

              {waiting > 0 || view.refused.length > 0 ? (
                <Button icon="ArrowRotateRight" isDisabled={sendNow.isPending} onPress={() => sendNow.mutate()}>
                  {sendNow.isPending ? "Sending…" : "Try sending now"}
                </Button>
              ) : null}

              {view.refused.length > 0 ? (
                <View className="gap-2">
                  <Eyebrow className="mt-2">Not sent</Eyebrow>
                  <ListGroup>
                    {view.refused.map((item) => (
                      <ListItem
                        key={item.id}
                        icon={item.icon}
                        tone="danger"
                        title={item.title}
                        subtitle={item.detail}
                        trailing={
                          <Button
                            size="sm"
                            variant="ghost"
                            onPress={() => dismiss.mutate(item.id)}
                            accessibilityLabel={`Dismiss ${item.title}`}
                          >
                            Dismiss
                          </Button>
                        }
                      />
                    ))}
                  </ListGroup>
                </View>
              ) : null}

              <View className="gap-2">
                <Eyebrow className="mt-2">Sent today</Eyebrow>
                <ListGroup>
                  {view.sent.length > 0 ? (
                    view.sent.map((item) => (
                      <ListItem
                        key={item.id}
                        icon={item.icon}
                        tone="success"
                        title={item.title}
                        subtitle={item.detail}
                      />
                    ))
                  ) : (
                    <ListItem
                      icon="Clock"
                      tone="default"
                      title="Nothing yet"
                      subtitle="What you do today shows here once it reaches Injishi."
                    />
                  )}
                </ListGroup>
              </View>
            </View>
          );
        }}
      </QueryView>
    </Screen>
  );
}

function WaitingRow({ item }: { item: OutboxItem }) {
  const chip = item.state === "sent" || item.state === "refused" ? STATE_CHIP.waiting : STATE_CHIP[item.state];
  return (
    <ListItem
      icon={item.icon}
      tone="warning"
      title={item.title}
      subtitle={item.detail}
      trailing={<Chip label={chip.label} tone={chip.tone} />}
    />
  );
}
