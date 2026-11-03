import { router } from "expo-router";
import { Fragment, useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Divider,
  Dock,
  EmptyView,
  FilterChips,
  Icon,
  LoadingBone,
  LoadingView,
  NavBar,
  Photo,
  PressArea,
  Screen,
  Stepper,
  TestMoneyTag,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { haptic } from "@/lib/haptics";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { useMenu, usePlaceOrder } from "./data";
import type { Menu, MenuCategory, MenuItem } from "./types";
import { backOr } from "./ui";

/** The most of one dish a room orders in one go; more is a call to the kitchen. */
const MAX_EACH = 9;

/**
 * Order to your room: photos, prices with VAT and sold-out dishes stay visible, and the café that cannot
 * charge the room says so up front. Ordering charges the room and opens the order's status.
 */
export function OrderScreen() {
  const menu = useMenu();
  const place = usePlaceOrder();
  const toast = useToast();
  const [category, setCategory] = useState<MenuCategory>("popular");
  const [cart, setCart] = useState<Record<string, number> | null>(null);
  const data = menu.data;
  const picked = cart ?? data?.cart ?? {};
  const { count, total } = data ? sum(data.items, picked) : { count: 0, total: 0 };

  const order = () =>
    place.mutate(picked, {
      onSuccess: () => {
        haptic.success();
        // The status replaces the menu, so back from it goes home, as the prototype's does.
        router.replace(href("guest-order-status"));
      },
      onError: () => toast.show({ icon: "CloudSlash", message: "Not ordered. Try again in a moment.", haptic: "error" }),
    });

  const dock =
    data && data.items.length > 0 ? (
      <Dock>
        <View className="flex-row items-center justify-between gap-3">
          <Text role="callout" tone="muted" className="shrink">
            {`${count} ${count === 1 ? "item" : "items"} · ${data.delivery}`}
          </Text>
          <TestMoneyTag />
        </View>
        <Button size="lg" onPress={order} isDisabled={count === 0 || place.isPending}>
          {count > 0 ? `Order · charge room ${data.room} · ${rwf(total)}` : "Pick something to order"}
        </Button>
      </Dock>
    ) : undefined;

  return (
    <Screen
      dock={dock}
      header={
        <NavBar title="Order to your room" subtitle={data?.outlet} onBack={() => backOr(href("guest-home-stay"))} />
      }
    >
      <QueryView offlineNote={null} query={menu} data={data} loading={<OrderBones />}>
        {(m) =>
          m.items.length === 0 ? (
            <EmptyView
              icon="Cup"
              title="The kitchen is closed"
              body="Room service runs from 07:00 to 22:00. The desk can still bring you something."
              action={{ label: "Message the desk", icon: "Comments", onPress: () => router.push(href("guest-chat")) }}
            />
          ) : (
            <MenuList
              menu={m}
              category={category}
              onCategory={setCategory}
              picked={picked}
              onQty={(id, qty) => setCart({ ...picked, [id]: qty })}
            />
          )
        }
      </QueryView>
    </Screen>
  );
}

function sum(items: MenuItem[], picked: Record<string, number>) {
  let count = 0;
  let total = 0;
  for (const item of items) {
    const qty = item.soldOut ? 0 : (picked[item.id] ?? 0);
    count += qty;
    total += qty * item.price;
  }
  return { count, total };
}

function MenuList({
  menu,
  category,
  onCategory,
  picked,
  onQty,
}: {
  menu: Menu;
  category: MenuCategory;
  onCategory: (next: MenuCategory) => void;
  picked: Record<string, number>;
  onQty: (id: string, qty: number) => void;
}) {
  const shown = menu.items.filter((item) => item.categories.includes(category));
  return (
    <View className="pt-1">
      <FilterChips label="Menu" options={menu.categories} value={category} onChange={onCategory} />
      <View className="mt-2 px-4">
        {shown.map((item, index) => (
          <Fragment key={item.id}>
            {index > 0 ? <Divider /> : null}
            <MenuRow item={item} qty={picked[item.id] ?? 0} onQty={(qty) => onQty(item.id, qty)} />
          </Fragment>
        ))}
        <View className="mt-2">
          <Banner body={menu.note} />
        </View>
      </View>
    </View>
  );
}

/** `.gx-menu`: the dish's photo, its words and price, and an add button that becomes a quantity. */
function MenuRow({ item, qty, onQty }: { item: MenuItem; qty: number; onQty: (qty: number) => void }) {
  return (
    <View className={`flex-row items-center gap-3 py-3 ${item.soldOut ? "opacity-50" : ""}`}>
      <View className="size-18 overflow-hidden rounded-2xl bg-surface-tertiary">
        {item.photo ? (
          <Photo source={item.photo} aspect={1} radius="none" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon name="Cup" size={24} tone="muted" />
          </View>
        )}
      </View>
      <View className="flex-1 gap-0.5">
        <Text role="callout" strong>
          {item.name}
        </Text>
        <Text role="caption" tone="muted">
          {item.description}
        </Text>
        <Text role="callout" strong tabular className="mt-1">
          {item.soldOut ? "Sold out tonight" : rwf(item.price)}
        </Text>
      </View>
      {item.soldOut ? null : qty > 0 ? (
        <Stepper label={item.name} value={qty} onChange={onQty} min={0} max={MAX_EACH} />
      ) : (
        <PressArea
          onPress={() => {
            haptic.selection();
            onQty(1);
          }}
          accessibilityLabel={`Add ${item.name}, ${rwf(item.price)}`}
          className="items-center justify-center"
        >
          <View className="size-9 items-center justify-center rounded-full bg-accent">
            <Icon name="Plus" size={16} tone="onAccent" />
          </View>
        </PressArea>
      )}
    </View>
  );
}

function OrderBones() {
  return (
    <LoadingView label="Loading the menu" className="px-4 pt-1">
      <View className="flex-row gap-2">
        <LoadingBone className="h-9 w-20 rounded-full" />
        <LoadingBone className="h-9 w-16 rounded-full" />
        <LoadingBone className="h-9 w-16 rounded-full" />
        <LoadingBone className="h-9 w-20 rounded-full" />
      </View>
      {[0, 1, 2, 3].map((row) => (
        <View key={row} className="flex-row items-center gap-3">
          <LoadingBone className="size-18 rounded-2xl" />
          <View className="flex-1 gap-2">
            <LoadingBone className="h-3.5 w-3/5" />
            <LoadingBone className="h-3 w-4/5" />
            <LoadingBone className="h-3.5 w-1/4" />
          </View>
        </View>
      ))}
    </LoadingView>
  );
}
