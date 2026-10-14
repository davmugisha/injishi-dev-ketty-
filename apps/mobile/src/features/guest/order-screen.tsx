import type { Persona } from "@injishi/data";
import type { BasketLine, MenuCategory, MenuItem, RoomServiceOrder, ServiceHour } from "@injishi/data/fixtures/outlets";
import { useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Chip,
  Description,
  Label,
  Radio,
  RadioGroup,
  Separator,
  TextArea,
  TextField,
} from "heroui-native";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody, PhoneTop } from "@/components/phone";
import { useSession } from "@/lib/session";
import { getCollection } from "@/lib/store";
import {
  CountStepper,
  formatRwf,
  GuestTimeline,
  InitialsAvatar,
  includes,
  KeyValue,
  LineTabs,
  PhotoFrame,
  param,
  Segmented,
  StatusAlert,
  StatusDot,
} from "./ui";

export type QrStep = "menu" | "item" | "basket" | "tracking";
const STEPS = ["menu", "item", "basket", "tracking"] as const;

const TITLES: Record<QrStep, string> = {
  menu: "Order to your room",
  item: "Choose options",
  basket: "Your basket",
  tracking: "Order status",
};

/** Guest QR ordering for room 204. `?step=` opens menu, item, basket (default) or tracking. */
export default function QrOrderScreen() {
  const { persona } = useSession();
  const stepParam = param(useLocalSearchParams<{ step?: string }>().step);
  const initial: QrStep = includes(STEPS, stepParam) ? stepParam : "basket";
  const items = getCollection<MenuItem>("outlets.menuItems");
  const categories = getCollection<MenuCategory>("outlets.menuCategories").filter((item) => item.menu === "room");
  const basket = getCollection<BasketLine>("outlets.basketLines");
  const orders = getCollection<RoomServiceOrder>("outlets.roomServiceOrders");
  const hours = getCollection<ServiceHour>("outlets.serviceHours");

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const tilapia = itemsById.get("tilapia");
  const sides = tilapia?.optionGroups?.find((group) => group.id === "side")?.options ?? [];
  const spices = tilapia?.optionGroups?.find((group) => group.id === "spice")?.options ?? [];
  const earlier = orders.find((order) => order.state === "placed");
  const fresh = orders.find((order) => order.state === "draft");

  const [step, setStep] = useState<QrStep>(initial);
  const [cat, setCat] = useState(categories.find((item) => item.id === "room-popular")?.id ?? categories[0]?.id ?? "");
  const [side, setSide] = useState(sides.find((option) => option.id === "plantain")?.id ?? sides[0]?.id ?? "");
  const [spice, setSpice] = useState(spices.find((option) => option.id === "mild")?.id ?? spices[0]?.id ?? "");
  const [lines, setLines] = useState<BasketLine[]>(basket);
  const [nextId, setNextId] = useState(basket.length + 1);
  const [dupOk, setDupOk] = useState(false);
  const [track, setTrack] = useState<"new" | "earlier">("new");
  const [allergy, setAllergy] = useState("");

  if (!persona) return null;

  const count = lines.reduce((sum, line) => sum + line.qty, 0);
  const total = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const sideOpt = sides.find((option) => option.id === side);
  const itemPrice = (tilapia?.price ?? 0) + (sideOpt?.price ?? 0);
  const category = categories.find((item) => item.id === cat);
  const menu = (category?.items ?? []).map((id) => itemsById.get(id)).filter((item): item is MenuItem => Boolean(item));

  const addPlain = (item: MenuItem) => {
    setLines((current) => [
      ...current,
      { id: `b-${nextId}`, item: item.id, name: item.name, mods: item.guestNote ?? "", qty: 1, price: item.price },
    ]);
    setNextId((n) => n + 1);
  };
  const addTilapia = () => {
    if (!tilapia || !sideOpt) return;
    setLines((current) => [
      ...current,
      {
        id: `b-${nextId}`,
        item: tilapia.id,
        name: tilapia.name,
        mods: `${sideOpt.label} · ${spice}`,
        qty: 1,
        price: itemPrice,
      },
    ]);
    setNextId((n) => n + 1);
    setDupOk(false);
    setStep("menu");
  };
  const setQty = (id: string, qty: number) => {
    setLines((current) =>
      qty <= 0
        ? current.filter((line) => line.id !== id)
        : current.map((line) => (line.id === id ? { ...line, qty } : line)),
    );
  };

  const viewingNew = track === "new";
  const order = viewingNew ? fresh : earlier;
  const progress = order?.steps ?? [];
  const trackItems = viewingNew ? lines.map((line) => `${line.qty} × ${line.name}`).join(", ") : (earlier?.items ?? "");
  const trackAmount = viewingNew ? total : (earlier?.amount ?? 0);

  const cta = (() => {
    if (step === "menu") {
      return {
        label: count ? `View basket · ${count} items · ${formatRwf(total)}` : "Basket is empty",
        icon: "ShoppingBasket",
        disabled: !count,
        hint: "",
        go: () => setStep("basket"),
      };
    }
    if (step === "item") {
      return {
        label: `Add to basket · ${formatRwf(itemPrice)}`,
        icon: "Plus",
        disabled: false,
        hint: "",
        go: addTilapia,
      };
    }
    if (step === "basket") {
      return {
        label: "Place order · charge room 204",
        icon: "PaperPlane",
        disabled: !count || !dupOk,
        hint: dupOk ? "You can cancel until the kitchen starts preparing" : "Answer the question above to continue",
        go: () => {
          setTrack("new");
          setStep("tracking");
        },
      };
    }
    return {
      label: "Order something else",
      icon: "Plus",
      disabled: false,
      hint: "",
      go: () => {
        setLines([]);
        setDupOk(false);
        setStep("menu");
      },
    };
  })();

  const back = () => setStep(step === "item" || step === "basket" ? "menu" : "basket");

  return (
    <View className="flex-1">
      <PhoneTop>
        {step !== "menu" ? (
          <Button variant="ghost" isIconOnly accessibilityLabel="Back" onPress={back}>
            <Icon name="ChevronLeft" />
          </Button>
        ) : null}
        <View className="min-w-0 flex-1">
          <Text className="text-[16px] leading-[22px] font-semibold text-foreground">{TITLES[step]}</Text>
          <Text className="text-xs leading-4 text-muted">Isangano Terrace · in-room dining</Text>
        </View>
        <InitialsAvatar initials={persona.initials} label={persona.name} />
      </PhoneTop>

      <PhoneBody>
        <View className="gap-[14px]">
          {step === "menu" ? (
            <MenuStep
              persona={persona}
              categories={categories}
              cat={cat}
              onCat={setCat}
              menu={menu}
              onAdd={(item) => (item.optionGroups?.length ? setStep("item") : addPlain(item))}
            />
          ) : null}

          {step === "item" && tilapia ? (
            <>
              <PhotoFrame image="grilledTilapia" className="h-[150px] w-full rounded-[18px]" />
              <View className="gap-0.5">
                <Text accessibilityRole="header" className="text-[20px] leading-[26px] font-semibold text-foreground">
                  {tilapia.name}
                </Text>
                <Text className="text-[13px] leading-[18px] text-muted">
                  {tilapia.guestDescription} About 35 minutes to your room.
                </Text>
                <Text className="font-semibold text-foreground">{formatRwf(tilapia.price)}</Text>
              </View>
              <View className="gap-2">
                <Label>Side · choose one</Label>
                <RadioGroup accessibilityLabel="Side" value={side} onValueChange={setSide} className="gap-2">
                  {sides.map((option) => (
                    <RadioGroup.Item
                      key={option.id}
                      value={option.id}
                      className={`min-h-12 w-full flex-row items-center gap-3 rounded-2xl border bg-surface px-3.5 py-3 ${side === option.id ? "border-accent" : "border-separator"}`}
                    >
                      <Text className="flex-1 font-medium text-foreground">{option.label}</Text>
                      <Text className="text-[13px] text-muted">
                        {option.price ? `+ ${formatRwf(option.price)}` : "Included"}
                      </Text>
                      <Radio />
                    </RadioGroup.Item>
                  ))}
                </RadioGroup>
              </View>
              <View className="gap-2">
                <Label>Spice</Label>
                <Segmented
                  label="Spice"
                  value={spice}
                  onChange={setSpice}
                  items={spices.map((option) => ({ id: option.id, label: option.label }))}
                />
              </View>
              <TextField>
                <Label>Allergies or requests</Label>
                <TextArea
                  value={allergy}
                  onChangeText={setAllergy}
                  numberOfLines={2}
                  placeholder="For example: no peanuts, sauce on the side"
                  accessibilityLabel="Allergies or requests"
                />
                <Description>The kitchen sees allergies highlighted on its screen.</Description>
              </TextField>
            </>
          ) : null}

          {step === "basket" ? (
            <>
              <View className="gap-2">
                {lines.map((line) => (
                  <Card key={line.id} className="flex-row items-center gap-2 px-3.5 py-3">
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text className="font-semibold text-foreground">{line.name}</Text>
                      <Text className="text-xs text-muted">{line.mods}</Text>
                      <Text className="text-[13px] text-foreground">{formatRwf(line.qty * line.price)}</Text>
                    </View>
                    <CountStepper
                      label={line.name}
                      value={line.qty}
                      min={0}
                      max={9}
                      onChange={(qty) => setQty(line.id, qty)}
                      lessLabel={`Remove one ${line.name}`}
                      moreLabel={`Add one more ${line.name}`}
                    />
                  </Card>
                ))}
                {lines.length === 0 ? (
                  <Card className="items-center gap-2 p-6">
                    <Icon name="ShoppingBasket" size={28} tone="muted" />
                    <Text className="font-semibold text-foreground">Your basket is empty</Text>
                    <Text className="text-center text-sm text-muted">Add something from the menu.</Text>
                  </Card>
                ) : null}
              </View>
              <Card variant="secondary" className="gap-2 p-3.5">
                <Text accessibilityRole="header" className="text-sm font-semibold text-foreground">
                  Payment
                </Text>
                <View className="flex-row items-start gap-2.5">
                  <Icon name="Key" tone="accent" />
                  <View className="flex-1">
                    <Text className="font-semibold text-foreground">Charge to room 204 · {persona.name}</Text>
                    <Text className="text-xs leading-4 text-muted">
                      Added to your room bill. Your tax receipt comes with your final invoice at checkout.
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-[13px] text-muted">Delivery to room 204</Text>
                  <Text className="text-[13px] text-foreground">Free · about 35 min</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold text-foreground">Total</Text>
                  <Text className="text-[17px] font-semibold text-foreground">{formatRwf(total)}</Text>
                </View>
                <Text className="text-xs text-muted">Prices include VAT.</Text>
              </Card>
              {!dupOk && lines.length > 0 ? (
                <StatusAlert
                  status="warning"
                  icon="Copy"
                  title="A similar order was placed 2 min ago · place again?"
                  description="RS-0213 at 19:52: grilled tilapia and 2 Rwandan tea, already with the kitchen."
                >
                  <View className="mt-2 items-start gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => {
                        setTrack("earlier");
                        setStep("tracking");
                      }}
                    >
                      <Button.Label>Track that order</Button.Label>
                    </Button>
                    <Button variant="ghost" size="sm" onPress={() => setDupOk(true)}>
                      <Button.Label>Yes, this is a new order</Button.Label>
                    </Button>
                  </View>
                </StatusAlert>
              ) : null}
              {dupOk ? (
                <View className="flex-row items-center gap-1.5">
                  <Icon name="CircleCheck" tone="success" />
                  <Text className="text-[13px] text-foreground">Confirmed as a separate order.</Text>
                </View>
              ) : null}
              <Text className="text-xs leading-4 text-muted">
                To avoid mistakes, up to 3 orders can be placed every 10 minutes from this room.
              </Text>
            </>
          ) : null}

          {step === "tracking" && order ? (
            <>
              <Card className="gap-2.5 p-4">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text accessibilityRole="header" className="text-[18px] leading-6 font-semibold text-foreground">
                      Order {order.id}
                    </Text>
                    <Text className="text-xs text-muted">{order.meta}</Text>
                  </View>
                  <Chip variant="soft" color="accent">
                    <Chip.Label>{order.eta}</Chip.Label>
                  </Chip>
                </View>
                <GuestTimeline
                  label="Order progress"
                  items={progress.map((item, index) => ({
                    id: `${order.id}-${index}`,
                    status: item.status === "complete" ? "success" : item.status === "active" ? "current" : "default",
                    icon: item.status === "complete" ? "Check" : item.status === "active" ? "Clock" : "Minus",
                    title: item.title,
                    detail: item.detail,
                  }))}
                />
                <Separator />
                <View className="gap-0.5">
                  <Text className="text-[13px] text-foreground">{trackItems}</Text>
                  <Text className="text-[13px] text-muted">
                    Charged to room 204 · {formatRwf(trackAmount)} · shows on your bill
                  </Text>
                </View>
                <Button variant="secondary" isDisabled>
                  <Button.Label>Cancel order</Button.Label>
                </Button>
                <Text className="text-xs leading-4 text-muted">
                  The kitchen has started, so this order can no longer be cancelled here. Call reception on 0 for
                  changes.
                </Text>
              </Card>
              <Card variant="secondary" className="gap-1.5 p-3.5">
                <Text accessibilityRole="header" className="text-sm font-semibold text-foreground">
                  Opening hours today
                </Text>
                <KeyValue items={hours.map((hour) => ({ label: hour.label, value: hour.hours }))} />
              </Card>
              {viewingNew && earlier ? (
                <Button
                  variant="ghost"
                  onPress={() => {
                    setTrack("earlier");
                    setStep("tracking");
                  }}
                >
                  <Button.Label>
                    Also tracking {earlier.id} · {earlier.progress}
                  </Button.Label>
                </Button>
              ) : null}
            </>
          ) : null}
        </View>
      </PhoneBody>

      <View className="gap-1.5 border-t border-separator bg-surface px-4 py-2.5">
        <Button size="lg" className="min-h-12" isDisabled={cta.disabled} onPress={cta.go}>
          <Icon name={cta.icon} tone={cta.disabled ? "muted" : "accent-foreground"} />
          <Button.Label>{cta.label}</Button.Label>
        </Button>
        {cta.hint ? <Text className="text-center text-xs text-muted">{cta.hint}</Text> : null}
      </View>
    </View>
  );
}

function MenuStep({
  persona,
  categories,
  cat,
  onCat,
  menu,
  onAdd,
}: {
  persona: Persona;
  categories: MenuCategory[];
  cat: string;
  onCat: (id: string) => void;
  menu: MenuItem[];
  onAdd: (item: MenuItem) => void;
}) {
  return (
    <>
      <Card variant="secondary" className="flex-row items-start gap-3 p-3.5">
        <Icon name="Key" tone="accent" />
        <View className="min-w-0 flex-1">
          <Text className="font-semibold text-foreground">Room 204 · {persona.name}</Text>
          <Text className="text-xs leading-4 text-muted">
            Signed in to your stay until 14 Oct. Orders go to your room bill.
          </Text>
        </View>
      </Card>
      <View className="flex-row items-center gap-2">
        <StatusDot tone="success" />
        <Text className="flex-1 text-[13px] text-foreground">
          Open now · room service 06:30 to 22:30 · last kitchen orders 22:00
        </Text>
      </View>
      <LineTabs
        label="Menu categories"
        value={cat}
        onChange={onCat}
        items={categories.map((item) => ({ id: item.id, label: item.label }))}
      />
      {cat === "room-drinks" ? (
        <Text className="text-xs text-muted">Drinks come from Lake Bar, open 16:00 to 23:30.</Text>
      ) : null}
      <View className="gap-2.5">
        {menu.map((item) => (
          <Card key={item.id} className={`p-3.5 ${item.soldOut ? "opacity-60" : ""}`}>
            <View className="flex-row items-center gap-2.5">
              <View className="min-w-0 flex-1 gap-0.5">
                <Text className="font-semibold text-foreground">{item.name}</Text>
                {item.guestNote ? <Text className="text-xs leading-4 text-muted">{item.guestNote}</Text> : null}
                <Text className="text-[13px] font-medium text-foreground">{formatRwf(item.price)}</Text>
              </View>
              {item.soldOut ? (
                <Chip size="sm" variant="soft">
                  <Chip.Label>Sold out tonight</Chip.Label>
                </Chip>
              ) : (
                <Button
                  variant="secondary"
                  size="lg"
                  isIconOnly
                  accessibilityLabel={`Add ${item.name}`}
                  className="size-12"
                  onPress={() => onAdd(item)}
                >
                  <Icon name="Plus" />
                </Button>
              )}
            </View>
          </Card>
        ))}
      </View>
      <StatusAlert
        icon="CircleInfo"
        title="Looking for coffee?"
        description="Ikawa Corner in the lobby is a separate business and cannot charge your room. Pay at the café, 07:00 to 19:00."
      />
    </>
  );
}
