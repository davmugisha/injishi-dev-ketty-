import { router } from "expo-router";
import { View } from "react-native";
import {
  Banner,
  Button,
  Dock,
  KeyValue,
  LoadingBone,
  LoadingView,
  SheetScreen,
  TestMoneyBanner,
  TestMoneyTag,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { useSendTestPayment, useTestPayment } from "./data";

/**
 * The test money label (prototype `shared-testmoney`, ADR-066 criterion 4): until a real gateway is
 * live every payment wears it. Shown as the guest's bill sheet: the TEST MONEY tag by the title, the
 * beta banner, the amount and the MoMo number. Sending runs the rehearsal and says nothing moved.
 */
export function TestMoneyScreen() {
  const query = useTestPayment();
  const send = useSendTestPayment();
  const sent = send.isSuccess;
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <SheetScreen
      title={query.data?.title ?? "Pay your bill"}
      right={<TestMoneyTag />}
      dock={
        <Dock>
          {sent ? (
            <Button size="lg" variant="secondary" onPress={close}>
              Done
            </Button>
          ) : (
            <Button size="lg" isDisabled={!query.data || send.isPending} onPress={() => send.mutate()}>
              {send.isPending ? "Sending…" : "Send test payment"}
            </Button>
          )}
        </Dock>
      }
    >
      <QueryView
        query={query}
        data={query.data}
        loading={
          <LoadingView label="Loading the bill">
            <LoadingBone className="h-20 rounded-2xl" />
            <LoadingBone className="h-5 w-full" />
            <LoadingBone className="h-5 w-full" />
          </LoadingView>
        }
      >
        {(payment) => (
          <View className="gap-3">
            {sent ? (
              <Banner
                tone="success"
                icon="CircleCheck"
                title="Test payment sent"
                body={`No money moved. On a live payment, the prompt for ${rwf(payment.amount)} would be on your phone now.`}
              />
            ) : (
              <TestMoneyBanner detail="The MoMo prompt and receipt are a rehearsal of the real thing." />
            )}
            <KeyValue
              rows={[
                { label: "Amount", value: rwf(payment.amount) },
                { label: "From", value: payment.from },
              ]}
            />
          </View>
        )}
      </QueryView>
    </SheetScreen>
  );
}
