import { router } from "expo-router";
import { View } from "react-native";
import {
  Button,
  Card,
  EmptyView,
  IconTile,
  Kpi,
  ListGroup,
  ListItem,
  LoadingBone,
  NavBar,
  Screen,
  Text,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { href } from "@/proto/screens";
import { usePayments, useRequestStamp } from "./data";
import type { PaymentsView } from "./types";
import { backOr, CardBone, Eyebrow, ListBone, MONEY_OFFLINE, MonthBlock, Skeleton, useNotify } from "./ui";

/**
 * `res-payments` (R1, in the Pay tab's stack): every verified payment and a yearly statement for a
 * bank or an embassy, with a stamped copy on request. Each row opens its receipt.
 */
export function PaymentsScreen() {
  const query = usePayments();
  return (
    <Screen
      header={
        <NavBar
          title="Payments"
          subtitle={query.data ? `Lease ${query.data.leaseId}` : undefined}
          onBack={() => backOr(href("res-me"))}
        />
      }
    >
      <QueryView query={query} data={query.data} loading={<PaymentsSkeleton />} offlineNote={MONEY_OFFLINE}>
        {(view) => <Payments view={view} />}
      </QueryView>
    </Screen>
  );
}

function Payments({ view }: { view: PaymentsView }) {
  const stamp = useRequestStamp();
  const notify = useNotify();
  const askStamp = () =>
    stamp.mutate(undefined, {
      onSuccess: () => notify.done("Solange stamps it and sends it to you within 2 working days"),
      onError: notify.failed,
    });
  return (
    <View className="gap-4 px-4">
      <View className="flex-row gap-2.5">
        <View className="flex-1">
          <Kpi label="Paid in 2026" value={view.paidThisYear.value} caption={view.paidThisYear.caption} />
        </View>
        <View className="flex-1">
          <Kpi label="Deposit held" value={view.deposit.value} caption={view.deposit.caption} />
        </View>
      </View>

      <Card>
        <View className="flex-row items-center gap-3.5">
          <IconTile icon="FileText" size="lg" />
          <View className="flex-1 gap-1">
            <Text role="headline">{view.statement.title}</Text>
            <Text role="caption" tone="muted">
              {view.statement.detail}
            </Text>
          </View>
        </View>
      </Card>
      <View className="flex-row gap-2.5">
        <Button
          icon="ArrowDownToLine"
          className="flex-1"
          isDisabled={view.history.length === 0}
          onPress={() => notify.done("2026 statement saved as a PDF", "ArrowDownToLine")}
        >
          Download PDF
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          isDisabled={view.stampRequested || view.history.length === 0 || stamp.isPending}
          onPress={askStamp}
        >
          {view.stampRequested ? "Stamp requested" : "Ask for a stamp"}
        </Button>
      </View>

      <Eyebrow className="mt-2">History</Eyebrow>
      {view.history.length === 0 ? (
        <EmptyView
          icon="Wallet"
          title="No payments yet"
          body="Each rent you pay shows here with its receipt and the provider's reference."
          action={{ label: "Pay rent", icon: "Wallet", onPress: () => router.navigate(href("res-pay")) }}
        />
      ) : (
        <ListGroup>
          {view.history.map((row) => (
            <ListItem
              key={row.id}
              leading={<MonthBlock month={row.month} day={row.day} />}
              title={row.title}
              subtitle={row.subtitle}
              value={row.amount.toLocaleString("en-US")}
              onPress={() => router.push(href("res-receipt", { id: row.id }))}
              accessibilityLabel={`${row.title}, ${row.subtitle}, RWF ${row.amount.toLocaleString("en-US")}, paid ${row.day} ${row.month}`}
            />
          ))}
        </ListGroup>
      )}
    </View>
  );
}

function PaymentsSkeleton() {
  return (
    <Skeleton label="Loading your payments">
      <View className="flex-row gap-2.5">
        <LoadingBone className="h-20 flex-1 rounded-3xl" />
        <LoadingBone className="h-20 flex-1 rounded-3xl" />
      </View>
      <CardBone />
      <LoadingBone className="h-12 rounded-full" />
      <ListBone rows={4} />
    </Skeleton>
  );
}
