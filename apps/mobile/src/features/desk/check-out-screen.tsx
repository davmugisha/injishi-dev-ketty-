import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Choice,
  Dock,
  KeyValue,
  ListGroup,
  ListItem,
  NavBar,
  Screen,
  Text,
  Toggle,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { useScreenParams } from "@/proto/params";
import { href } from "@/proto/screens";
import { useCheckout, useRequestCheckout } from "./data";
import type { DeskCheckout, PayMethod } from "./types";
import { backOr, PAYMENT_OFFLINE, PushedSkeleton, toToday } from "./ui";

/**
 * `desk-checkout`: the bill nets off what was prepaid on Injishi, so the desk only collects the
 * difference. The key's return and telling housekeeping are ticked in the same step.
 */
export function CheckOutScreen() {
  const { guest } = useScreenParams("desk-checkout");
  const query = useCheckout(guest);
  const bill = query.data;
  const [method, setMethod] = useState<PayMethod>("mtn");
  const [keyReturned, setKeyReturned] = useState(true);
  const [tellHousekeeping, setTellHousekeeping] = useState(true);
  const request = useRequestCheckout();
  const toast = useToast();

  const submit = (b: DeskCheckout) =>
    request.mutate(
      { stayId: b.stayId, method, keyReturned, tellHousekeeping },
      {
        onSuccess: (next) => {
          if (next.next === "wait") router.push(href("desk-walkin-pay", { pay: next.payId }));
          else if (next.next === "paid") router.replace(href("desk-paid", { pay: next.payId }));
          else {
            toast.show({ icon: "CircleCheck", message: `${b.name} checked out of ${b.tent}`, haptic: "success" });
            toToday(href("desk-today"));
          }
        },
      },
    );

  const action = (b: DeskCheckout) =>
    b.due === 0 ? `Check out ${b.tent}` : method === "cash" ? `Take ${rwf(b.due)} in cash` : `Request ${rwf(b.due)}`;

  return (
    <Screen
      header={
        <NavBar
          title={bill ? `Check-out · ${bill.tent}` : "Check-out"}
          subtitle={bill?.subtitle}
          onBack={backOr(href("desk-today"))}
        />
      }
      dock={
        bill && !bill.gone ? (
          <Dock note={bill.due > 0 ? bill.receiptNote : undefined}>
            <Button isDisabled={request.isPending} onPress={() => submit(bill)}>
              {action(bill)}
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <QueryView
        query={query}
        offlineNote={PAYMENT_OFFLINE}
        data={bill}
        loading={<PushedSkeleton label="Loading the bill" />}
      >
        {(b) => (
          <Bill
            bill={b}
            method={method}
            onMethod={setMethod}
            keyReturned={keyReturned}
            onKeyReturned={setKeyReturned}
            tellHousekeeping={tellHousekeeping}
            onTellHousekeeping={setTellHousekeeping}
          />
        )}
      </QueryView>
    </Screen>
  );
}

function Bill({
  bill,
  method,
  onMethod,
  keyReturned,
  onKeyReturned,
  tellHousekeeping,
  onTellHousekeeping,
}: {
  bill: DeskCheckout;
  method: PayMethod;
  onMethod: (m: PayMethod) => void;
  keyReturned: boolean;
  onKeyReturned: (v: boolean) => void;
  tellHousekeeping: boolean;
  onTellHousekeeping: (v: boolean) => void;
}) {
  return (
    <View className="gap-4 px-4">
      {bill.gone ? (
        <Banner tone="success" title={`${bill.name} has checked out`} body={`${bill.tent} is with housekeeping now.`} />
      ) : null}
      <Card padding="sm">
        <KeyValue
          rows={bill.lines}
          total={
            bill.gone
              ? { label: "Balance", value: "Settled" }
              : bill.due === 0
                ? { label: "To pay", value: "Nothing · paid in full" }
                : { label: "To pay", value: rwf(bill.due) }
          }
        />
      </Card>
      {bill.due > 0 && !bill.gone ? (
        <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel={bill.ask}>
          <Text role="callout" strong>
            {bill.ask}
          </Text>
          {bill.methods.map((m) => (
            <Choice
              key={m.value}
              title={m.title}
              subtitle={m.subtitle}
              selected={m.value === method}
              onPress={() => onMethod(m.value)}
            />
          ))}
        </View>
      ) : null}
      {bill.gone ? null : (
        <ListGroup>
          <ListItem
            icon="Key"
            tone="default"
            title="Tent key returned"
            trailing={<Checkbox checked={keyReturned} onChange={onKeyReturned} label="Tent key returned" />}
          />
          <ListItem
            icon="BroomMotion"
            tone="default"
            title="Tell housekeeping"
            subtitle={bill.housekeepingLine}
            trailing={<Toggle value={tellHousekeeping} onValueChange={onTellHousekeeping} label="Tell housekeeping" />}
          />
        </ListGroup>
      )}
    </View>
  );
}
