import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type { GuestStepStatus, GuestTone } from "@injishi/data/fixtures/guest";
import type { StockKey } from "@injishi/data/media";
import { stock } from "@injishi/data/media";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { Alert, Avatar, BottomSheet, Button, Chip, Tabs } from "heroui-native";
import { Fragment, type ReactNode, useCallback, useEffect, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneTop } from "@/components/phone";
import { stockImages } from "@/lib/stock";
import { toneColor } from "@/lib/tone";

const LOCALE = "en-KE";

/** "47,500" — same en-KE formatting the web screens use. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value);
}

/** "RWF 118,400" — same en-KE formatting the web screens use. */
export function formatRwf(value: number): string {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: "RWF" }).format(value);
}

/** First value of an Expo Router search param. */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function includes<T extends string>(options: readonly T[], value: string | undefined): value is T {
  return value != null && (options as readonly string[]).includes(value);
}

// ── Language ────────────────────────────────────────────────────────────────

export type Lang = "en" | "rw" | "fr";

const LANGS: { id: Lang; label: string; name: string }[] = [
  { id: "en", label: "EN", name: "English" },
  { id: "rw", label: "RW", name: "Kinyarwanda" },
  { id: "fr", label: "FR", name: "Français" },
];

const LANG_KEY = "injishi.guest.lang";

let guestLang: Lang = "en";
let langHydrated = false;
const langListeners = new Set<() => void>();

function emitLang(): void {
  for (const listener of langListeners) listener();
}

function isLang(value: string | null): value is Lang {
  return value === "en" || value === "rw" || value === "fr";
}

function hydrateLang(): void {
  if (langHydrated) return;
  langHydrated = true;
  try {
    const saved = globalThis.localStorage?.getItem(LANG_KEY) ?? null;
    if (isLang(saved) && saved !== guestLang) {
      guestLang = saved;
      emitLang();
    }
  } catch {
    // Storage can be unavailable; English stays.
  }
}

/** The guest app's language. Starts in English and remembers the choice on this device. */
export function useGuestLang(): [Lang, (lang: Lang) => void] {
  const lang = useSyncExternalStore(
    (listener) => {
      langListeners.add(listener);
      return () => langListeners.delete(listener);
    },
    () => guestLang,
    () => "en" as Lang,
  );
  useEffect(() => {
    hydrateLang();
  }, []);
  const choose = useCallback((next: Lang) => {
    guestLang = next;
    try {
      globalThis.localStorage?.setItem(LANG_KEY, next);
    } catch {
      // The choice still applies on this screen.
    }
    emitLang();
  }, []);
  return [lang, choose];
}

/** EN · RW · FR switch in a guest screen header. */
export function LanguageSwitch({ lang, onChange }: { lang: Lang; onChange: (lang: Lang) => void }) {
  return (
    <Tabs
      value={lang}
      onValueChange={(value) => {
        if (isLang(value)) onChange(value);
      }}
      variant="primary"
    >
      <Tabs.List accessibilityLabel="Language">
        <Tabs.Indicator />
        {LANGS.map((item, index) => (
          <Fragment key={item.id}>
            {index > 0 ? <Tabs.Separator betweenValues={[LANGS[index - 1].id, item.id]} /> : null}
            <Tabs.Trigger value={item.id} accessibilityLabel={item.name} className="min-h-9 px-2">
              <Tabs.Label>{item.label}</Tabs.Label>
            </Tabs.Trigger>
          </Fragment>
        ))}
      </Tabs.List>
    </Tabs>
  );
}

/** Guest screen header: a leading avatar or back button, a two-line title and the language switch. */
export function GuestTop({
  lead,
  title,
  sub,
  lang,
  onLang,
}: {
  lead: ReactNode;
  title: string;
  sub: string;
  lang: Lang;
  onLang: (lang: Lang) => void;
}) {
  return (
    <PhoneTop>
      {lead}
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] leading-[18px] font-semibold text-foreground" numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-xs leading-4 text-muted" numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <LanguageSwitch lang={lang} onChange={onLang} />
    </PhoneTop>
  );
}

export function InitialsAvatar({ initials, label }: { initials: string; label?: string }) {
  return (
    <Avatar size="sm" variant="soft" color="accent" alt={label ?? initials}>
      <Avatar.Fallback>{initials}</Avatar.Fallback>
    </Avatar>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href as never} asChild>
      <Button variant="ghost" isIconOnly accessibilityLabel={label}>
        <Icon name="ChevronLeft" />
      </Button>
    </Link>
  );
}

export function ScreenHeading({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return (
    <View className="gap-[2px]">
      <Text accessibilityRole="header" className="text-[24px] leading-8 font-semibold text-foreground">
        {title}
      </Text>
      <Text className="text-sm leading-5 text-muted">{sub}</Text>
      {children}
    </View>
  );
}

export function StepHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <View className="gap-[2px]">
      <Text accessibilityRole="header" className="text-[22px] leading-7 font-semibold text-foreground">
        {title}
      </Text>
      <Text className="text-sm leading-5 text-muted">{sub}</Text>
    </View>
  );
}

export function SectionTitle({ children, id }: { children: string; id?: string }) {
  return (
    <Text nativeID={id} accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
      {children}
    </Text>
  );
}

const DOT: Record<GuestTone, string> = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  default: "bg-default",
  info: "bg-accent",
};

export function StatusDot({ tone }: { tone: GuestTone | null }) {
  return <View className={`size-2 rounded-full ${tone ? DOT[tone] : "bg-default"}`} />;
}

export function IconTile({ name }: { name: string }) {
  return (
    <View className="size-9 items-center justify-center rounded-xl bg-default">
      <Icon name={name} />
    </View>
  );
}

export function IconRow({ icon, title, text }: { icon: string; title?: string; text: string }) {
  return (
    <View className="flex-row items-start gap-[10px]">
      <Icon name={icon} tone="muted" />
      <View className="min-w-0 flex-1 gap-[1px]">
        {title ? <Text className="text-[13px] leading-[18px] font-semibold text-foreground">{title}</Text> : null}
        <Text className="text-xs leading-[17px] text-muted">{text}</Text>
      </View>
    </View>
  );
}

export function Hint({ icon, children }: { icon: string; children: string }) {
  return (
    <View className="flex-row items-start gap-[6px]">
      <Icon name={icon} size={14} tone="muted" />
      <Text className="flex-1 text-xs leading-4 text-muted">{children}</Text>
    </View>
  );
}

export function ChevronLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href as never} asChild>
      <Pressable accessibilityRole="link" className="min-h-11 flex-row items-center gap-[6px] self-start">
        <Text className="text-xs leading-4 font-medium text-accent-soft-foreground">{children}</Text>
        <Icon name="ChevronRight" size={14} tone="accent-soft-foreground" />
      </Pressable>
    </Link>
  );
}

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
        <Text className="text-[13px] text-foreground">{label}</Text>
        <Text className="text-[13px] text-muted">{valueLabel}</Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
        className="h-2 overflow-hidden rounded-full bg-default"
      >
        <View className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </View>
    </View>
  );
}

export function CountStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 9,
  lessLabel,
  moreLabel,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  lessLabel?: string;
  moreLabel?: string;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <Button
        variant="secondary"
        isIconOnly
        accessibilityLabel={lessLabel ?? `One less ${label}`}
        isDisabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
        className="size-11"
      >
        <Icon name="Minus" />
      </Button>
      <Text accessibilityLabel={label} className="min-w-9 text-center text-base font-semibold text-foreground">
        {value}
      </Text>
      <Button
        variant="secondary"
        isIconOnly
        accessibilityLabel={moreLabel ?? `One more ${label}`}
        isDisabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
        className="size-11"
      >
        <Icon name="Plus" />
      </Button>
    </View>
  );
}

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
      <Tabs.List accessibilityLabel={label} className="w-full">
        <Tabs.Indicator />
        {items.map((item, index) => (
          <Fragment key={item.id}>
            {index > 0 ? <Tabs.Separator betweenValues={[items[index - 1].id, item.id]} /> : null}
            <Tabs.Trigger value={item.id} className="min-h-11 flex-1 px-2">
              <Tabs.Label numberOfLines={1}>{item.label}</Tabs.Label>
            </Tabs.Trigger>
          </Fragment>
        ))}
      </Tabs.List>
    </Tabs>
  );
}

export function LineTabs({
  label,
  value,
  onChange,
  items,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: { id: string; label: string; badge?: string; badgeColor?: "default" | "accent" | "success" | "warning" }[];
}) {
  return (
    <Tabs value={value} onValueChange={onChange} variant="secondary" className="w-full">
      <Tabs.List accessibilityLabel={label}>
        <Tabs.ScrollView>
          <Tabs.Indicator />
          {items.map((item) => (
            <Tabs.Trigger key={item.id} value={item.id} className="min-h-11 px-3">
              <Tabs.Label>{item.label}</Tabs.Label>
              {item.badge ? (
                <Chip size="sm" variant="soft" color={item.badgeColor ?? "default"}>
                  <Chip.Label>{item.badge}</Chip.Label>
                </Chip>
              ) : null}
            </Tabs.Trigger>
          ))}
        </Tabs.ScrollView>
      </Tabs.List>
    </Tabs>
  );
}

/** Single- or multi-select chips standing in for the web tag group. */
export function ChoiceChips({
  label,
  options,
  selected,
  onChange,
  multiple = false,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
}) {
  const on = new Set(selected);
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <View accessibilityLabel={label} className="flex-row flex-wrap gap-1.5">
        {options.map((option) => {
          const chosen = on.has(option.id);
          return (
            <Button
              key={option.id}
              size="sm"
              variant={chosen ? "primary" : "secondary"}
              accessibilityState={{ selected: chosen }}
              onPress={() => {
                if (!multiple) {
                  onChange([option.id]);
                  return;
                }
                onChange(chosen ? selected.filter((id) => id !== option.id) : [...selected, option.id]);
              }}
            >
              <Button.Label>{option.label}</Button.Label>
            </Button>
          );
        })}
      </View>
    </View>
  );
}

export function StatusAlert({
  status = "default",
  icon,
  indicator,
  title,
  description,
  children,
}: {
  status?: "default" | "accent" | "success" | "warning" | "danger";
  icon?: string;
  indicator?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  const tone = status === "default" ? "foreground" : status;
  return (
    <Alert status={status}>
      <Alert.Indicator>{indicator ?? (icon ? <Icon name={icon} tone={tone} /> : null)}</Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        {description ? <Alert.Description>{description}</Alert.Description> : null}
        {children}
      </Alert.Content>
    </Alert>
  );
}

export function PhoneSheet({
  isOpen,
  onOpenChange,
  heading,
  description,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  heading: string;
  description?: string;
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
            <BottomSheet.Title>{heading}</BottomSheet.Title>
            {description ? <BottomSheet.Description>{description}</BottomSheet.Description> : null}
            {children}
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

const STEP_TONE: Record<GuestStepStatus, "success" | "accent" | "muted" | "warning"> = {
  success: "success",
  current: "accent",
  default: "muted",
  warning: "warning",
};

export function GuestTimeline({
  label,
  items,
}: {
  label?: string;
  items: { id: string; status: GuestStepStatus; icon: string; title: string; detail: string }[];
}) {
  return (
    <View accessibilityLabel={label} className="gap-0">
      {items.map((item, index) => (
        <View key={item.id} className="flex-row gap-[10px]">
          <View className="w-6 items-center">
            <View className="size-6 items-center justify-center rounded-full bg-default">
              <Icon name={item.icon} size={12} tone={STEP_TONE[item.status]} />
            </View>
            {index < items.length - 1 ? <View className="w-px flex-1 bg-separator" /> : null}
          </View>
          <View className="min-w-0 flex-1 pb-3">
            <Text className="text-sm font-medium text-foreground">{item.title}</Text>
            {item.detail ? <Text className="text-xs leading-4 text-muted">{item.detail}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export function StepDots({
  label,
  steps,
  current,
  onStep,
}: {
  label: string;
  steps: { id: string; label: string }[];
  current: number;
  onStep?: (index: number) => void;
}) {
  return (
    <View accessibilityLabel={label} className="flex-row items-start">
      {steps.map((step, index) => {
        const reached = index <= current;
        const body = (
          <View className="flex-1 items-center gap-1">
            <View className="w-full flex-row items-center">
              <View
                className={`h-px flex-1 ${index === 0 ? "bg-transparent" : reached ? "bg-accent" : "bg-separator"}`}
              />
              <View
                className={`size-7 items-center justify-center rounded-full ${reached ? "bg-accent" : "bg-default"}`}
              >
                {index < current ? (
                  <Icon name="Check" size={14} tone="accent-foreground" />
                ) : (
                  <Text className={`text-xs font-semibold ${reached ? "text-accent-foreground" : "text-muted"}`}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <View
                className={`h-px flex-1 ${index === steps.length - 1 ? "bg-transparent" : index < current ? "bg-accent" : "bg-separator"}`}
              />
            </View>
            <Text
              className={`text-[11px] leading-[14px] ${index === current ? "font-semibold text-foreground" : "text-muted"}`}
            >
              {step.label}
            </Text>
          </View>
        );
        if (!onStep)
          return (
            <View key={step.id} className="flex-1">
              {body}
            </View>
          );
        return (
          <Pressable key={step.id} accessibilityRole="button" onPress={() => onStep(index)} className="min-h-11 flex-1">
            {body}
          </Pressable>
        );
      })}
    </View>
  );
}

const WORDS = ["Not rated yet", "Poor", "Fair", "Good", "Very good", "Excellent"];

export function ratingWord(value: number): string {
  return WORDS[value] ?? WORDS[0];
}

export function Stars({
  value,
  onChange,
  label,
  size = 22,
  readOnly = false,
}: {
  value: number;
  onChange?: (next: number) => void;
  label: string;
  size?: number;
  readOnly?: boolean;
}) {
  return (
    <View accessibilityLabel={label} className="flex-row items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = (
          <Icon name={n <= value ? "StarFill" : "Star"} size={size} tone={n <= value ? "warning" : "muted"} />
        );
        if (readOnly || !onChange) return <View key={n}>{icon}</View>;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${n} of 5, ${ratingWord(n).toLowerCase()}`}
            onPress={() => onChange(n)}
            className="min-h-11 min-w-11 items-center justify-center"
          >
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}

export function PhotoFrame({ image, caption, className }: { image: StockKey; caption?: string; className?: string }) {
  const source = stockImages[image];
  return (
    <View className={`relative overflow-hidden bg-surface-secondary ${className ?? ""}`}>
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
          <Text className="text-center text-[11px] leading-[13px] font-medium text-background">{caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function SoftChip({ label, tone = "default", icon }: { label: string; tone?: GuestTone; icon?: string }) {
  return (
    <Chip size="sm" variant="soft" color={toneColor(tone)}>
      {icon ? <Icon name={icon} size={12} /> : null}
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}
