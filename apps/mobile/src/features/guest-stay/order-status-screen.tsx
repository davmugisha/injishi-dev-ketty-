import { rnSpace } from "@injishi/design-tokens";
import { router } from "expo-router";
import { View } from "react-native";
import {
  Card,
  Icon,
  KeyValue,
  LoadingBone,
  LoadingView,
  metrics,
  NavBar,
  Ring,
  Screen,
  Text,
  Timeline,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { useRoomOrder } from "./data";
import type { RoomOrder } from "./types";
import { backOr, CardBone, TextLink } from "./ui";

/**
 * A room service order: a single arrival time first, then the steps, then what goes on the bill. It says
 * plainly when cancelling closed, and the desk is one tap away.
 */
export function OrderStatusScreen() {
  const order = useRoomOrder();
  const data = order.data;
  return (
    <Screen
      header={
        <NavBar
          title={data ? `Order ${data.ref}` : "Your order"}
          subtitle={data?.room}
          onBack={() => backOr(href("guest-home-stay"))}
        />
      }
    >
      <QueryView offlineNote={null} query={order} data={data} loading={<OrderStatusBones />}>
        {(o) => <OrderStatus order={o} />}
      </QueryView>
    </Screen>
  );
}

function OrderStatus({ order }: { order: RoomOrder }) {
  return (
    <View className="gap-4 px-4 pt-1">
      <Card tone="accent" padding="lg">
        <View className="flex-row items-center gap-3.5">
          <View
            accessible
            accessibilityLabel={`Arriving about ${order.eta}. ${order.stage}`}
            className="flex-1 gap-0.5"
          >
            <Text role="callout" tone="muted">
              Arriving about
            </Text>
            <Text role="title1" tabular>
              {order.eta}
            </Text>
            <Text role="callout" tone="muted" className="mt-1">
              {order.stage}
            </Text>
          </View>
          <Ring value={order.progress} size={ORDER_RING} label="Order progress">
            <Icon name="Cup" size={24} />
          </Ring>
        </View>
      </Card>
      <Card>
        <Timeline steps={order.steps} />
      </Card>
      <Card>
        <KeyValue
          rows={order.lines.map((line) => ({ key: line.label, label: line.label, value: rwf(line.amount) }))}
          total={{ label: "On your bill", value: rwf(order.total) }}
        />
      </Card>
      <View className="items-center">
        <Text role="caption" tone="muted" className="text-center">
          {`${order.cancelNote} Need something?`}
        </Text>
        <TextLink label="Message the desk" onPress={() => router.push(href("guest-chat"))} />
      </View>
    </View>
  );
}

/** The prototype's 84 ring on the accent card: the kit's ring, a grid step larger. */
const ORDER_RING = metrics.ring.size + rnSpace[2];

function OrderStatusBones() {
  return (
    <LoadingView label="Loading your order" className="px-4 pt-1">
      <CardBone className="h-32" />
      <CardBone className="h-56" />
      <CardBone className="h-32" />
      <LoadingBone className="h-3 w-2/3 self-center" />
    </LoadingView>
  );
}
