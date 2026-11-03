import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Button,
  Card,
  Chip,
  Choice,
  Dock,
  Field,
  IconTile,
  Input,
  LoadingBone,
  LoadingView,
  Screen,
  ScreenHeader,
  Stepper,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { useRequestWalkIn, useWalkInForm } from "./data";
import type { DeskWalkInForm, TentKind, WalkInTent } from "./types";
import { PAYMENT_OFFLINE } from "./ui";

/**
 * `desk-walkin`: a walk-in booking on one screen: dates, tent, guests and the MoMo number, with the
 * total in the dock above the one action, which sends the guest a MoMo prompt.
 */
export function WalkInScreen() {
  const query = useWalkInForm();
  const form = query.data;
  // The form owns its screen (its dock shows the total as it changes); until it can, the header
  // stands over the skeleton or the error.
  if (form) return <WalkInForm form={form} />;
  return (
    <Screen>
      <ScreenHeader title="Walk-in" />
      <QueryView query={query} offlineNote={PAYMENT_OFFLINE} data={form} loading={<WalkInSkeleton />}>
        {() => null}
      </QueryView>
    </Screen>
  );
}

const nightsLabel = (n: number) => `${n} ${n === 1 ? "night" : "nights"}`;
const adultsLabel = (n: number) => `${n} ${n === 1 ? "adult" : "adults"}`;
/** A Rwandan mobile number: 07 and eight more digits, spaces allowed. */
const PHONE = /^07\d{8}$/;
/** 072 and 073 are Airtel; 078 and 079 MTN. */
const network = (phone: string) => (/^07[23]/.test(phone.replace(/\D/g, "")) ? "Airtel" : "MTN");

function WalkInForm({ form }: { form: DeskWalkInForm }) {
  const { defaults } = form;
  const [nights, setNights] = useState(defaults.nights);
  const [kind, setKind] = useState<TentKind>(defaults.kind);
  const [adults, setAdults] = useState(defaults.adults);
  const [name, setName] = useState(defaults.name);
  const [phone, setPhone] = useState(defaults.phone);
  const [tried, setTried] = useState(false);
  const request = useRequestWalkIn();
  const toast = useToast();

  const tent = form.tents.find((t) => t.kind === kind) ?? form.tents[0];
  const capacity = tent?.capacity ?? 1;
  const total = (tent?.price ?? 0) * nights;
  const nameError = tried && name.trim().length < 2 ? "Type the guest's name as on the ID." : undefined;
  const phoneError =
    tried && !PHONE.test(phone.replace(/\s/g, "")) ? "A Rwandan mobile number: 07 and eight more digits." : undefined;

  const pickTent = (next: WalkInTent) => {
    setKind(next.kind);
    setAdults((a) => Math.min(a, next.capacity));
  };

  const submit = () => {
    setTried(true);
    if (name.trim().length < 2 || !PHONE.test(phone.replace(/\s/g, "")) || !tent || tent.free === 0) return;
    request.mutate(
      { nights, kind, adults, name: name.trim(), phone: phone.trim() },
      {
        onSuccess: (payId) => router.push(href("desk-walkin-pay", { pay: payId })),
        onError: (error) => toast.show({ icon: "TriangleExclamation", message: error.message, haptic: "error" }),
      },
    );
  };

  return (
    <Screen
      dock={
        <Dock>
          <View className="mb-1 flex-row items-baseline justify-between gap-3">
            <Text role="callout" tone="muted">
              {`${nightsLabel(nights)} · VAT included`}
            </Text>
            <Text role="title3" strong tabular>
              {rwf(total)}
            </Text>
          </View>
          <Button icon="Smartphone" isDisabled={request.isPending || !tent || tent.free === 0} onPress={submit}>
            Request MoMo payment
          </Button>
        </Dock>
      }
    >
      <ScreenHeader title="Walk-in" />
      <View className="gap-3 px-4">
        <Card padding="sm">
          <View className="flex-row items-center justify-between gap-3">
            <View className="shrink">
              <Text role="micro" tone="muted" caps strong>
                Stay
              </Text>
              <Text role="headline" strong className="mt-1">
                {`Tonight → ${form.checkouts[nights - 1] ?? ""}`}
              </Text>
              <Text role="caption" tone="muted">
                {`Check-out ${form.checkoutTime}`}
              </Text>
            </View>
            <Stepper
              label="Nights"
              value={nights}
              onChange={setNights}
              min={1}
              max={form.checkouts.length}
              format={nightsLabel}
            />
          </View>
        </Card>
        <View className="gap-2" accessibilityRole="radiogroup" accessibilityLabel="Tent">
          <Text role="callout" strong>
            Tent
          </Text>
          {form.tents.map((option) => (
            <TentChoice
              key={option.kind}
              tent={option}
              selected={option.kind === kind}
              onPress={() => pickTent(option)}
            />
          ))}
        </View>
        <View className="flex-row items-center justify-between gap-3">
          <Text role="callout" strong>
            Guests
          </Text>
          <Stepper label="Adults" value={adults} onChange={setAdults} min={1} max={capacity} format={adultsLabel} />
        </View>
        <Field label="Guest name" error={nameError}>
          <Input
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
          />
        </Field>
        <Field label="MoMo phone number" error={phoneError}>
          <Input
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            leading={
              // Its own box, so the chip centres in the field instead of hugging its top.
              <View>
                <Chip label={network(phone)} />
              </View>
            }
          />
        </Field>
      </View>
    </Screen>
  );
}

/** `.choice` with a tile: the tent kind, how many sleep in it, how many are free, the price a night. */
function TentChoice({ tent, selected, onPress }: { tent: WalkInTent; selected: boolean; onPress: () => void }) {
  const full = tent.free === 0;
  return (
    <Choice
      indicator="none"
      title={tent.name}
      subtitle={`${tent.capacity} guests · ${full ? "full tonight" : `${tent.free} free tonight`}`}
      leading={<IconTile icon={tent.icon} tone={selected ? "accent" : "default"} />}
      trailing={
        <View className="items-end">
          <Text role="callout" strong tabular>
            {rwf(tent.price)}
          </Text>
          <Text role="micro" tone="muted">
            a night
          </Text>
        </View>
      }
      selected={selected}
      isDisabled={full}
      onPress={onPress}
    />
  );
}

function WalkInSkeleton() {
  return (
    <LoadingView label="Loading the walk-in form" className="px-4">
      <LoadingBone className="h-24 rounded-3xl" />
      <LoadingBone className="h-4 w-1/5" />
      <LoadingBone className="h-20 rounded-2xl" />
      <LoadingBone className="h-20 rounded-2xl" />
      <LoadingBone className="h-12 rounded-2xl" />
      <LoadingBone className="h-14 rounded-2xl" />
      <LoadingBone className="h-14 rounded-2xl" />
    </LoadingView>
  );
}
