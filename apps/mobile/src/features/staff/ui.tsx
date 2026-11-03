import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type { StaffTone } from "@injishi/data/fixtures/staff";
import type { StockKey } from "@injishi/data/media";
import { stock } from "@injishi/data/media";
import { Image } from "expo-image";
import { Alert, BottomSheet, Button, Tabs } from "heroui-native";
import { Fragment, type ReactNode } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { stockImages } from "@/lib/stock";

/** First value of an Expo Router search param. */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** "RWF 181,597" — same en-KE formatting the web screens use. */
export function formatRwf(value: number): string {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "RWF" }).format(value);
}

const DOT: Record<StaffTone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  default: "bg-default",
  info: "bg-accent",
};

/** Small status dot (artifact: .ij-dot). */
export function StatusDot({ tone }: { tone: StaffTone }) {
  return <View className={`size-2 rounded-full ${DOT[tone]}`} />;
}

/** Phone header title block (artifact: h1 17px + muted 12px line). */
export function PhoneTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View className="min-w-0 flex-1">
      <Text accessibilityRole="header" className="text-[17px] leading-6 font-semibold text-foreground">
        {title}
      </Text>
      {sub ? <Text className="text-xs leading-4 text-muted">{sub}</Text> : null}
    </View>
  );
}

/** Section heading inside a phone body. */
export function SectionTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
      {children}
    </Text>
  );
}

/** Action bar pinned above the tab bar. */
export function PhoneActionBar({ children, stacked = false }: { children: ReactNode; stacked?: boolean }) {
  return (
    <View
      className={`border-t border-separator bg-surface px-4 py-2.5 ${stacked ? "gap-2" : "flex-row items-center gap-[10px]"}`}
    >
      {children}
    </View>
  );
}

const TILE = {
  success: "bg-success-soft",
  warning: "bg-warning-soft",
  danger: "bg-danger-soft",
  accent: "bg-accent-soft",
} as const;

const TILE_TONE = {
  success: "success-soft-foreground",
  warning: "warning-soft-foreground",
  danger: "danger-soft-foreground",
  accent: "accent-soft-foreground",
} as const;

/** Rounded tone tile holding a large icon. */
export function ToneTile({ tone, icon }: { tone: keyof typeof TILE; icon: string }) {
  return (
    <View className={`size-12 items-center justify-center rounded-2xl ${TILE[tone]}`}>
      <Icon name={icon} size={24} tone={TILE_TONE[tone]} />
    </View>
  );
}

/** A stock photo with an optional caption along its lower edge. */
export function PhotoTile({
  image,
  caption,
  className,
  children,
}: {
  image: StockKey;
  caption?: string;
  className?: string;
  children?: ReactNode;
}) {
  const source = stockImages[image];
  return (
    <View className={`relative overflow-hidden rounded-[18px] bg-surface-secondary ${className ?? ""}`}>
      {source ? (
        <Image
          source={source}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          accessibilityLabel={stock[image].alt}
        />
      ) : null}
      {caption ? (
        <View className="absolute inset-x-0 bottom-0 bg-foreground/75 px-[10px] pt-[18px] pb-2">
          <Text className="text-xs leading-4 font-medium text-background">{caption}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Label / value rows (artifact: .ij-kv). */
export function KeyValue({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View className="gap-1.5">
      {items.map((item) => (
        <View key={item.label} className="flex-row items-start justify-between gap-3">
          <Text className="text-[13px] leading-[18px] text-muted">{item.label}</Text>
          <Text className="flex-1 text-right text-[13px] leading-[18px] font-medium text-foreground">{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** Horizontal meter (leave used, checks done). */
export function MeterBar({
  label,
  valueLabel,
  pct,
  accessibilityLabel,
}: {
  label: string;
  valueLabel: string;
  pct: number;
  accessibilityLabel: string;
}) {
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-sm text-foreground">{label}</Text>
        <Text className="text-sm text-muted">{valueLabel}</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: pct }}
        className="h-2 overflow-hidden rounded-full bg-default"
      >
        <View className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </View>
    </View>
  );
}

/** Plus / minus count used for the minibar (HeroUI Native has no number stepper). */
export function CountStepper({
  label,
  value,
  onChange,
  disabled = false,
  max = 9,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  max?: number;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <Button
        variant="secondary"
        isIconOnly
        accessibilityLabel={`One less ${label}`}
        isDisabled={disabled || value <= 0}
        onPress={() => onChange(Math.max(0, value - 1))}
        className="size-11"
      >
        <Icon name="Minus" />
      </Button>
      <Text
        accessibilityLabel={`${label} used`}
        className="min-w-9 text-center text-base font-semibold text-foreground"
      >
        {value}
      </Text>
      <Button
        variant="secondary"
        isIconOnly
        accessibilityLabel={`One more ${label}`}
        isDisabled={disabled || value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
        className="size-11"
      >
        <Icon name="Plus" />
      </Button>
    </View>
  );
}

/** Pill segment (artifact: .segment) built from HeroUI Native tabs. */
export function Segmented({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { id: string; label: string }[];
}) {
  return (
    <Tabs value={value} onValueChange={onChange} variant="primary" className="w-full">
      <Tabs.List accessibilityLabel={label} className="w-full" style={{ alignSelf: "stretch", width: "100%" }}>
        <Tabs.Indicator />
        {items.map((item, index) => (
          <Fragment key={item.id}>
            {index > 0 ? <Tabs.Separator betweenValues={[items[index - 1].id, item.id]} /> : null}
            <Tabs.Trigger value={item.id} className="min-h-11 flex-1" style={{ paddingHorizontal: 8 }}>
              <Tabs.Label numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {item.label}
              </Tabs.Label>
            </Tabs.Trigger>
          </Fragment>
        ))}
      </Tabs.List>
    </Tabs>
  );
}

/** Status callout with an icon, title and description. */
export function StatusAlert({
  status,
  icon,
  title,
  description,
}: {
  status: "default" | "accent" | "success" | "warning" | "danger";
  icon: string;
  title: string;
  description: string;
}) {
  const tone = status === "default" ? "foreground" : status;
  return (
    <Alert status={status}>
      <Alert.Indicator>
        <Icon name={icon} tone={tone} />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        <Alert.Description>{description}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

/** Bottom sheet of a phone screen. Mounted only while open, so a closed sheet adds no text. */
export function PhoneSheet({
  isOpen,
  onOpenChange,
  heading,
  description,
  media,
  centered = false,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  heading: string;
  description?: string;
  media?: ReactNode;
  centered?: boolean;
  children: ReactNode;
}) {
  // Mounted while closed on purpose: heroui-native snaps the sheet up when `isOpen` turns true, so a
  // sheet first mounted already open stays parked below the screen. heroui-native keeps a closed
  // sheet out of the paint itself.
  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["88%"]}
          enableOverDrag={false}
          enableDynamicSizing={false}
          contentContainerClassName="h-full"
        >
          <BottomSheetScrollView contentContainerClassName="gap-[14px] px-5 pt-2 pb-8">
            {media ? <View className={centered ? "items-center" : ""}>{media}</View> : null}
            <BottomSheet.Title className={centered ? "text-center" : ""}>{heading}</BottomSheet.Title>
            {description ? (
              <BottomSheet.Description className={centered ? "text-center" : ""}>{description}</BottomSheet.Description>
            ) : null}
            {children}
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
