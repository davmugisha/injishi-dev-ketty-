"use client";

import { ChevronLeft, CircleCheck, CircleInfo, Copy, Key, PaperPlane, Plus, ShoppingBasket } from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Chip, Description, Label, Separator, Tabs, TextArea } from "@heroui/react";
import { EmptyState, ItemCard, RadioButtonGroup, Segment, Stepper } from "@heroui-pro/react";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { KeyValueList, PhoneBody, PhoneTop, Photo, StatusDot } from "@injishi/ui";
import { useMemo, useState } from "react";
import type { BasketLine, MenuCategory, MenuItem, RoomServiceOrder, ServiceHour } from "../../model/outlets.ts";
import type { Persona } from "../../model/shared.ts";
import { useOutletsMedia } from "../mount.tsx";
import { money } from "../parts.tsx";

export type QrStep = "menu" | "item" | "basket" | "tracking";

interface QrOrderData {
  items: MenuItem[];
  /** Room-service categories, in menu order. */
  categories: MenuCategory[];
  basket: BasketLine[];
  orders: RoomServiceOrder[];
  hours: ServiceHour[];
}

const TITLES: Record<QrStep, string> = {
  menu: "Order to your room",
  item: "Choose options",
  basket: "Your basket",
  tracking: "Order status",
};

/** Guest QR ordering for room 204 (artifact: QROrder). `?step=` opens menu, item, basket or tracking. */
export function QrOrderView({ persona, step: initial, data }: { persona: Persona; step: QrStep; data: QrOrderData }) {
  const { photo } = useOutletsMedia();
  const itemsById = useMemo(() => new Map(data.items.map((m) => [m.id, m])), [data.items]);
  const tilapia = itemsById.get("tilapia");
  const sides = tilapia?.optionGroups?.find((g) => g.id === "side")?.options ?? [];
  const spices = tilapia?.optionGroups?.find((g) => g.id === "spice")?.options ?? [];
  const earlier = data.orders.find((o) => o.state === "placed");
  const fresh = data.orders.find((o) => o.state === "draft");

  const [step, setStep] = useState<QrStep>(initial);
  const [cat, setCat] = useState(
    data.categories.find((c) => c.id === "room-popular")?.id ?? data.categories[0]?.id ?? "",
  );
  const [side, setSide] = useState(sides.find((o) => o.id === "plantain")?.id ?? sides[0]?.id ?? "");
  const [spice, setSpice] = useState(spices.find((o) => o.id === "mild")?.id ?? spices[0]?.id ?? "");
  const [lines, setLines] = useState<BasketLine[]>(data.basket);
  const [nextId, setNextId] = useState(data.basket.length + 1);
  const [dupOk, setDupOk] = useState(false);
  const [track, setTrack] = useState<"new" | "earlier">("new");

  const count = lines.reduce((a, l) => a + l.qty, 0);
  const total = lines.reduce((a, l) => a + l.qty * l.price, 0);
  const sideOpt = sides.find((o) => o.id === side);
  const itemPrice = (tilapia?.price ?? 0) + (sideOpt?.price ?? 0);
  const category = data.categories.find((c) => c.id === cat);
  const menu = (category?.items ?? []).map((id) => itemsById.get(id)).filter((m): m is MenuItem => Boolean(m));

  const addPlain = (m: MenuItem) => {
    setLines((ls) => [
      ...ls,
      { id: `b-${nextId}`, item: m.id, name: m.name, mods: m.guestNote ?? "", qty: 1, price: m.price },
    ]);
    setNextId((n) => n + 1);
  };
  const addTilapia = () => {
    if (!tilapia || !sideOpt) return;
    setLines((ls) => [
      ...ls,
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
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.id !== id) : ls.map((l) => (l.id === id ? { ...l, qty } : l))));
  };

  const viewingNew = track === "new";
  const order = viewingNew ? fresh : earlier;
  const steps = order?.steps ?? [];
  const active = Math.max(
    0,
    steps.findIndex((s) => s.status === "active"),
  );
  const trackItems = viewingNew ? lines.map((l) => `${l.qty} × ${l.name}`).join(", ") : (earlier?.items ?? "");
  const trackAmount = viewingNew ? total : (earlier?.amount ?? 0);

  const cta = (() => {
    if (step === "menu") {
      return {
        label: count ? `View basket · ${count} items · ${money(total)}` : "Basket is empty",
        icon: <ShoppingBasket className="size-4" />,
        disabled: !count,
        hint: "",
        go: () => setStep("basket"),
      };
    }
    if (step === "item") {
      return {
        label: `Add to basket · ${money(itemPrice)}`,
        icon: <Plus className="size-4" />,
        disabled: false,
        hint: "",
        go: addTilapia,
      };
    }
    if (step === "basket") {
      return {
        label: "Place order · charge room 204",
        icon: <PaperPlane className="size-4" />,
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
      icon: <Plus className="size-4" />,
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
    <div className="flex min-h-0 flex-1 flex-col">
      <PhoneTop>
        {step !== "menu" ? (
          <Button variant="ghost" isIconOnly aria-label="Back" onPress={back}>
            <ChevronLeft className="size-4" />
          </Button>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[16px] leading-[22px] font-semibold">{TITLES[step]}</span>
          <span className="text-[12px] leading-4 text-muted">Isangano Terrace · in-room dining</span>
        </div>
        <Avatar size="sm" variant="soft" color="accent">
          <Avatar.Fallback>{persona.initials}</Avatar.Fallback>
        </Avatar>
      </PhoneTop>

      <PhoneBody>
        {step === "menu" ? (
          <>
            <ItemCard variant="secondary">
              <ItemCard.Icon>
                <Key />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title>Room 204 · {persona.name}</ItemCard.Title>
                <ItemCard.Description className="whitespace-normal">
                  Signed in to your stay until 14 Oct. Orders go to your room bill.
                </ItemCard.Description>
              </ItemCard.Content>
            </ItemCard>
            <div className="flex items-center gap-2 text-[13px]">
              <StatusDot tone="success" />
              <span>Open now · room service 06:30 to 22:30 · last kitchen orders 22:00</span>
            </div>
            <Tabs variant="secondary" selectedKey={cat} onSelectionChange={(k) => setCat(String(k))}>
              <Tabs.ListContainer>
                <Tabs.List aria-label="Menu categories">
                  {data.categories.map((c) => (
                    <Tabs.Tab key={c.id} id={c.id} className="h-11 w-auto whitespace-nowrap">
                      {c.label}
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
            {cat === "room-drinks" ? (
              <p className="text-[12px] text-muted">Drinks come from Lake Bar, open 16:00 to 23:30.</p>
            ) : null}
            <div className="flex flex-col gap-2.5">
              {menu.map((m) => (
                <Card key={m.id} className={`p-3.5 ${m.soldOut ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-semibold">{m.name}</span>
                      {m.guestNote ? <span className="text-[12px] leading-4 text-muted">{m.guestNote}</span> : null}
                      <span className="text-[13px] font-medium tabular">{money(m.price)}</span>
                    </div>
                    {m.soldOut ? (
                      <Chip size="sm" variant="soft">
                        <Chip.Label>Sold out tonight</Chip.Label>
                      </Chip>
                    ) : (
                      <Button
                        variant="secondary"
                        size="lg"
                        isIconOnly
                        aria-label={`Add ${m.name}`}
                        className="size-12"
                        onPress={() => (m.optionGroups?.length ? setStep("item") : addPlain(m))}
                      >
                        <Plus className="size-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
            <Alert status="default">
              <Alert.Indicator>
                <CircleInfo />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Looking for coffee?</Alert.Title>
                <Alert.Description>
                  Ikawa Corner in the lobby is a separate business and cannot charge your room. Pay at the café, 07:00
                  to 19:00.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          </>
        ) : null}

        {step === "item" && tilapia ? (
          <>
            <div className="relative h-[150px] overflow-hidden rounded-[18px] bg-surface-secondary">
              <Photo image={photo("grilledTilapia")} fill sizes="390px" alt={photo("grilledTilapia").alt} />
            </div>
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[20px] leading-[26px] font-semibold">{tilapia.name}</h2>
              <span className="text-[13px] leading-[18px] text-muted">
                {tilapia.guestDescription} About 35 minutes to your room.
              </span>
              <span className="font-semibold tabular">{money(tilapia.price)}</span>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Side · choose one</Label>
              <RadioButtonGroup
                aria-label="Side"
                value={side}
                onChange={(v) => v && setSide(v)}
                className="flex-col gap-2"
              >
                {sides.map((o) => (
                  <RadioButtonGroup.Item
                    key={o.id}
                    value={o.id}
                    className="min-h-12 flex-row items-center px-3.5 py-3 text-left"
                  >
                    <RadioButtonGroup.ItemContent className="flex-1">
                      <Label className="font-medium">{o.label}</Label>
                    </RadioButtonGroup.ItemContent>
                    <span className="mr-[26px] text-[13px] text-muted tabular">
                      {o.price ? `+ ${money(o.price)}` : "Included"}
                    </span>
                    <RadioButtonGroup.Indicator className="top-3.5">
                      <CircleCheck className="size-4" />
                    </RadioButtonGroup.Indicator>
                  </RadioButtonGroup.Item>
                ))}
              </RadioButtonGroup>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Spice</Label>
              <Segment
                aria-label="Spice"
                selectedKey={spice}
                onSelectionChange={(k) => setSpice(String(k))}
                className="w-full"
              >
                {spices.map((o) => (
                  <Segment.Item key={o.id} id={o.id} className="h-10 flex-1">
                    {o.label}
                  </Segment.Item>
                ))}
              </Segment>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="allergy">Allergies or requests</Label>
              <TextArea id="allergy" rows={2} fullWidth placeholder="For example: no peanuts, sauce on the side" />
              <Description>The kitchen sees allergies highlighted on its screen.</Description>
            </div>
          </>
        ) : null}

        {step === "basket" ? (
          <>
            <div className="flex flex-col gap-2">
              {lines.map((l) => (
                <Card key={l.id} className="flex-row items-center gap-2 px-3.5 py-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">{l.name}</span>
                    <span className="text-[12px] text-muted">{l.mods}</span>
                    <span className="text-[13px] tabular">{money(l.qty * l.price)}</span>
                  </div>
                  <NumberStepper
                    size="lg"
                    aria-label={l.name}
                    value={l.qty}
                    minValue={0}
                    onChange={(v) => setQty(l.id, Number.isNaN(v) ? 0 : v)}
                  >
                    <NumberStepper.Group>
                      <NumberStepper.DecrementButton aria-label={`Remove one ${l.name}`} />
                      <NumberStepper.Value />
                      <NumberStepper.IncrementButton aria-label={`Add one more ${l.name}`} />
                    </NumberStepper.Group>
                  </NumberStepper>
                </Card>
              ))}
              {lines.length === 0 ? (
                <EmptyState size="sm">
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <ShoppingBasket />
                    </EmptyState.Media>
                    <EmptyState.Title>Your basket is empty</EmptyState.Title>
                    <EmptyState.Description>Add something from the menu.</EmptyState.Description>
                  </EmptyState.Header>
                </EmptyState>
              ) : null}
            </div>
            <Card variant="secondary" className="gap-2 p-3.5" aria-labelledby="pay-h">
              <h2 id="pay-h" className="text-[14px] font-semibold">
                Payment
              </h2>
              <div className="flex items-start gap-2.5">
                <Key className="mt-0.5 size-4 shrink-0 text-accent" />
                <span className="flex flex-1 flex-col">
                  <span className="font-semibold">Charge to room 204 · {persona.name}</span>
                  <span className="text-[12px] leading-4 text-muted">
                    Added to your room bill. Your tax receipt comes with your final invoice at checkout.
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted">Delivery to room 204</span>
                <span>Free · about 35 min</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-[17px] font-semibold tabular">{money(total)}</span>
              </div>
              <span className="text-[12px] text-muted">Prices include VAT.</span>
            </Card>
            {!dupOk && lines.length > 0 ? (
              <Alert status="warning" role="alert">
                <Alert.Indicator>
                  <Copy />
                </Alert.Indicator>
                <Alert.Content className="gap-2">
                  <Alert.Title>A similar order was placed 2 min ago · place again?</Alert.Title>
                  <Alert.Description>
                    RS-0213 at 19:52: grilled tilapia and 2 Rwandan tea, already with the kitchen.
                  </Alert.Description>
                  <div className="flex flex-col items-start gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => {
                        setTrack("earlier");
                        setStep("tracking");
                      }}
                    >
                      Track that order
                    </Button>
                    <Button variant="ghost" size="sm" onPress={() => setDupOk(true)}>
                      Yes, this is a new order
                    </Button>
                  </div>
                </Alert.Content>
              </Alert>
            ) : null}
            {dupOk ? (
              <p className="flex items-center gap-1.5 text-[13px]">
                <CircleCheck className="size-4 text-success" />
                Confirmed as a separate order.
              </p>
            ) : null}
            <p className="text-[12px] leading-4 text-muted">
              To avoid mistakes, up to 3 orders can be placed every 10 minutes from this room.
            </p>
          </>
        ) : null}

        {step === "tracking" && order ? (
          <>
            <Card className="gap-2.5 p-4" aria-labelledby="trk-h">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <h2 id="trk-h" className="text-[18px] leading-6 font-semibold">
                    Order {order.id}
                  </h2>
                  <span className="text-[12px] text-muted tabular">{order.meta}</span>
                </div>
                <Chip variant="soft" color="accent">
                  <Chip.Label>{order.eta}</Chip.Label>
                </Chip>
              </div>
              <Stepper orientation="vertical" size="sm" currentStep={active} aria-label="Order progress">
                {steps.map((s) => (
                  <Stepper.Step key={s.title}>
                    <Stepper.Indicator />
                    <Stepper.Content>
                      <Stepper.Title>{s.title}</Stepper.Title>
                      {s.detail ? <Stepper.Description>{s.detail}</Stepper.Description> : null}
                    </Stepper.Content>
                    <Stepper.Separator />
                  </Stepper.Step>
                ))}
              </Stepper>
              <Separator />
              <div className="flex flex-col gap-0.5 text-[13px]">
                <span>{trackItems}</span>
                <span className="text-muted">Charged to room 204 · {money(trackAmount)} · shows on your bill</span>
              </div>
              <Button variant="secondary" isDisabled>
                Cancel order
              </Button>
              <span className="text-[12px] leading-4 text-muted">
                The kitchen has started, so this order can no longer be cancelled here. Call reception on 0 for changes.
              </span>
            </Card>
            <Card variant="secondary" className="gap-1.5 p-3.5" aria-labelledby="hrs-h">
              <h2 id="hrs-h" className="text-[14px] font-semibold">
                Opening hours today
              </h2>
              <KeyValueList
                items={data.hours.map((h) => ({
                  label: h.label,
                  value: <span className="font-normal">{h.hours}</span>,
                }))}
              />
            </Card>
            {viewingNew && earlier ? (
              <Button
                variant="ghost"
                onPress={() => {
                  setTrack("earlier");
                  setStep("tracking");
                }}
              >
                Also tracking {earlier.id} · {earlier.progress}
              </Button>
            ) : null}
          </>
        ) : null}
      </PhoneBody>

      <div className="flex flex-col gap-1.5 bg-surface px-4 py-2.5 shadow-[0_-1px_0_var(--separator)]">
        <Button size="lg" fullWidth className="min-h-12" isDisabled={cta.disabled} onPress={cta.go}>
          {cta.icon}
          {cta.label}
        </Button>
        {cta.hint ? <span className="text-center text-[12px] text-muted">{cta.hint}</span> : null}
      </div>
    </div>
  );
}
