import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Dialog,
  Dock,
  Field,
  Input,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  ProgressBar,
  Screen,
  ScreenHeader,
  TestMoneyTag,
  Text,
  TextArea,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { useCloseShift, useMoney } from "./data";
import type { DeskMoney, MoneyEntry } from "./types";
import { PAYMENT_OFFLINE } from "./ui";

/** "432,000": an amount in a column of amounts, the currency said once above them. */
const figure = (amount: number) => rwf(amount).replace("RWF ", "");

/**
 * `desk-money`: today's takings by method and the cash the drawer should hold, so the shift closes
 * from the phone. A counted drawer that differs needs a note.
 */
export function MoneyScreen() {
  const query = useMoney();
  const money = query.data;
  const [counting, setCounting] = useState(false);
  return (
    <Screen
      dock={
        money && !money.closed ? (
          <Dock note={`The drawer should hold ${rwf(money.drawer)}. A difference needs a note.`}>
            <Button variant="deep" icon="Lock" onPress={() => setCounting(true)}>
              Count cash and close shift
            </Button>
          </Dock>
        ) : undefined
      }
    >
      <ScreenHeader title="Money" subtitle={money?.subtitle ?? "Today"} right={<TestMoneyTag />} />
      <QueryView query={query} offlineNote={PAYMENT_OFFLINE} data={money} loading={<MoneySkeleton />}>
        {(m) => <Takings money={m} />}
      </QueryView>
      {money ? <CloseShift isOpen={counting} drawer={money.drawer} onClose={() => setCounting(false)} /> : null}
    </Screen>
  );
}

function Takings({ money }: { money: DeskMoney }) {
  return (
    <View className="gap-4 px-4">
      {money.closed ? (
        <Banner
          tone="success"
          icon="Lock"
          title={`Shift closed at ${money.closed.at}`}
          body={`Drawer counted ${rwf(money.closed.counted)}${money.closed.note ? ` · ${money.closed.note}` : " · as expected"}`}
        />
      ) : null}
      <Card>
        <Text role="micro" tone="muted" caps strong>
          Taken today
        </Text>
        <Text role="display" tabular className="mt-1">
          {rwf(money.total)}
        </Text>
        <Text role="callout" tone="muted" className="mt-1">
          {money.countLine}
        </Text>
        <View className="mt-3">
          {money.methods.map((m) => (
            <View key={m.key} className="flex-row items-center gap-2.5 py-1.5">
              <Text role="callout" className="w-24">
                {m.label}
              </Text>
              <View className="flex-1">
                <ProgressBar
                  value={m.share}
                  tone={m.key === "cash" ? "warning" : "accent"}
                  label={`${m.label}, ${m.share}% of today`}
                />
              </View>
              <Text role="callout" strong tabular>
                {figure(m.amount)}
              </Text>
            </View>
          ))}
        </View>
      </Card>
      {money.entries.length > 0 ? (
        <ListGroup>
          {money.entries.map((entry) => (
            <Entry key={entry.key} entry={entry} />
          ))}
        </ListGroup>
      ) : (
        <Card tone="flat">
          <Text role="callout" tone="muted">
            No payments yet this shift. Walk-ins and bills paid at the desk appear here once confirmed.
          </Text>
        </Card>
      )}
    </View>
  );
}

function Entry({ entry }: { entry: MoneyEntry }) {
  const opens = entry.opens;
  return (
    <ListItem
      icon={entry.method === "cash" ? "Sack" : "Smartphone"}
      tone={entry.method === "cash" ? "warning" : "success"}
      title={entry.name}
      subtitle={entry.detail}
      trailing={
        <Text role="callout" strong tabular>
          {figure(entry.amount)}
        </Text>
      }
      accessibilityLabel={`${entry.name}, ${entry.detail}, ${rwf(entry.amount)}`}
      onPress={() =>
        opens.to === "paid"
          ? router.push(href("desk-paid", { pay: opens.payId }))
          : router.push(href("desk-checkout", { guest: opens.stayId }))
      }
    />
  );
}

/** The shift close: count the drawer; a count that differs from what it should hold asks why. */
function CloseShift({ isOpen, drawer, onClose }: { isOpen: boolean; drawer: number; onClose: () => void }) {
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const close = useCloseShift();
  const toast = useToast();
  const digits = counted.replace(/\D/g, "");
  const amount = Number(digits);
  const difference = digits === "" ? 0 : amount - drawer;
  const ready = digits !== "" && (difference === 0 || note.trim().length >= 3);

  const submit = () =>
    close.mutate(
      { counted: amount, note },
      {
        onSuccess: () => {
          onClose();
          toast.show({ icon: "Lock", message: "Shift closed", haptic: "success" });
        },
      },
    );

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      icon="Lock"
      title="Count the cash drawer"
      body={`It should hold ${rwf(drawer)}, the cash taken this shift.`}
      actions={
        <>
          <Button variant="deep" isDisabled={!ready || close.isPending} onPress={submit}>
            Close shift
          </Button>
          <Button variant="ghost" onPress={onClose}>
            Not yet
          </Button>
        </>
      }
    >
      <View className="gap-3">
        <Field
          label="Cash in the drawer"
          hint={difference === 0 ? undefined : `${difference > 0 ? "Over" : "Short"} by ${rwf(Math.abs(difference))}`}
        >
          <Input
            value={counted}
            onChangeText={setCounted}
            keyboardType="number-pad"
            placeholder={String(drawer)}
            leading={
              <Text role="callout" tone="muted">
                RWF
              </Text>
            }
          />
        </Field>
        {difference !== 0 ? (
          <Field label="What happened?">
            <TextArea value={note} onChangeText={setNote} placeholder="A refund paid in cash, change given…" />
          </Field>
        ) : null}
      </View>
    </Dialog>
  );
}

function MoneySkeleton() {
  return (
    <LoadingView label="Loading today's takings" className="px-4">
      <LoadingBone className="h-56 rounded-3xl" />
      <LoadingBone className="h-48 rounded-3xl" />
    </LoadingView>
  );
}
