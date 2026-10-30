import { Redirect, router } from "expo-router";
import { Card } from "heroui-native";
import { type ReactNode, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Chip, Icon, IconButton, Row, RowIcon, Text } from "@/components/ui";
import { dismiss, type OutboxRow, sendOutbox, sentToday, useOutboxRows } from "@/data/outbox";
import { kinds } from "@/data/outbox/kinds";
import { isUnsent, STILL_TRYING_AFTER } from "@/data/outbox/rules";
import { clockOffsetMs } from "@/lib/clock";
import { kigaliTime } from "@/lib/kigali";
import { useSession } from "@/lib/session";

function label(row: OutboxRow): string {
  return kinds[row.kind]?.label(row) ?? "A change";
}

/**
 * What is on this phone (mobile spec 0003, AC-8, prototype `shared-05-outbox`): what is waiting to
 * send and what others still see meanwhile, what was refused and why, and what was sent today.
 */
export function OutboxScreen() {
  const { account } = useSession();
  const insets = useSafeAreaInsets();
  const rows = useOutboxRows(account?.userId);
  const [trying, setTrying] = useState(false);
  const offset = clockOffsetMs();
  const { waiting, refused, sent } = useMemo(
    () => ({
      waiting: rows.filter(isUnsent),
      refused: rows.filter((row) => row.state === "refused"),
      sent: rows.filter((row) => sentToday(row, offset)).reverse(),
    }),
    [rows, offset],
  );

  if (!account) return <Redirect href="/" />;

  const tryNow = async () => {
    setTrying(true);
    await sendOutbox("try_now");
    setTrying(false);
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center gap-3 px-4 pb-2" style={{ paddingTop: Math.max(insets.top, 12) + 8 }}>
        <IconButton icon="ArrowLeft" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
        <View className="flex-1">
          <Text role="title3">On this phone</Text>
          <Text role="caption" tone="muted">
            {waiting.length > 0 ? "Waiting for signal" : "Everything has reached Injishi"}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pt-2" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {waiting.length > 0 ? (
          <Card variant="secondary" className="bg-warning-soft">
            <Card.Body className="flex-row gap-3">
              <Icon name="CloudSlash" size={24} tone="warning" />
              <View className="flex-1 gap-1">
                <Text role="headline">
                  {waiting.length === 1 ? "1 thing waiting to send" : `${waiting.length} things waiting to send`}
                </Text>
                <Text role="callout" tone="muted">
                  They send by themselves when signal is back. Closing the app loses nothing.
                </Text>
              </View>
            </Card.Body>
          </Card>
        ) : null}

        {waiting.length > 0 ? (
          <Section title="Waiting to send">
            {waiting.map((row) => (
              <Row
                key={row.id}
                leading={<RowIcon name="Clock" tone="warning" />}
                title={label(row)}
                subtitle={waitingWords(row)}
                trailing={
                  <Chip
                    label={row.attempts >= STILL_TRYING_AFTER ? "Still trying" : row.state === "sending" ? "Sending" : "Waiting"}
                    tone="warning"
                  />
                }
              />
            ))}
          </Section>
        ) : null}

        {waiting.length > 0 || refused.length > 0 ? (
          <Button icon="ArrowRotateRight" isDisabled={trying} onPress={() => void tryNow()}>
            {trying ? "Sending…" : "Try sending now"}
          </Button>
        ) : null}

        {refused.length > 0 ? (
          <Section title="Not sent">
            {refused.map((row) => (
              <View key={row.id}>
                <Row
                  leading={<RowIcon name="CircleExclamation" tone="danger" />}
                  title={label(row)}
                  subtitle={`Saved ${kigaliTime(row.createdAt + offset)} · ${row.serverMessage ?? "Injishi couldn't accept this."}`}
                />
                <View className="flex-row justify-end px-4 pb-3">
                  <Button variant="ghost" size="md" onPress={() => dismiss(row.id)} accessibilityLabel={`Dismiss ${label(row)}`}>
                    Dismiss
                  </Button>
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        <Section title="Sent today">
          {sent.length > 0 ? (
            sent.map((row) => (
              <Row
                key={row.id}
                leading={<RowIcon name="CircleCheck" tone="success" />}
                title={label(row)}
                subtitle={[
                  `Done ${kigaliTime(row.createdAt + offset)}`,
                  `sent ${kigaliTime((row.sentAt ?? row.createdAt) + offset)}`,
                  row.serverMessage,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))
          ) : (
            <Row title="Nothing yet" subtitle="What you do today shows here once it reaches Injishi." />
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

/** "Saved 07:02 · your manager doesn't see you clocked in yet", or why it is still trying. */
function waitingWords(row: OutboxRow): string {
  const others = kinds[row.kind]?.othersSee(row);
  const saved = `Saved ${kigaliTime(row.createdAt + clockOffsetMs())}`;
  const reason = row.state === "waiting_retry" && row.serverMessage ? row.serverMessage : null;
  return [saved, reason, others?.toLowerCase()].filter(Boolean).join(" · ");
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text role="micro" tone="muted" caps>
        {title}
      </Text>
      <Card className="overflow-hidden p-0">{children}</Card>
    </View>
  );
}
