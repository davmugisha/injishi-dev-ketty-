import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import type { ResidentTone } from "@injishi/data/fixtures/resident";
import type { StockKey } from "@injishi/data/media";
import { stock } from "@injishi/data/media";
import { Image } from "expo-image";
import { Alert, BottomSheet, Button, Chip, Label, ListGroup, Select, Separator, Tabs } from "heroui-native";
import { Fragment, type ReactNode } from "react";
import { Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { stockImages } from "@/lib/stock";
import { toneColor } from "@/lib/tone";

/** First value of an Expo Router search param. */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** "RWF 950,000" — same en-KE formatting the web screens use. */
export function formatRwf(value: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  }).format(value);
}

/** "950,000" — the bare number beside a formatted rent. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-KE").format(value);
}

/** "078• ••• 412": the first three and last three digits, as on the confirm sheet. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length < 7 ? phone : `${digits.slice(0, 3)}• ••• ${digits.slice(-3)}`;
}

/** Saves a plain-text receipt. The static web preview can download it; native has no file picker here. */
export function downloadText(filename: string, lines: string[]): void {
  const doc = (globalThis as { document?: Document }).document;
  if (!doc) return;
  const url = URL.createObjectURL(new Blob([`${lines.join("\n")}\n`], { type: "text/plain;charset=utf-8" }));
  const link = doc.createElement("a");
  link.href = url;
  link.download = filename;
  doc.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copies text on the web preview. Returns false when the device has no clipboard API. */
export async function copyText(text: string): Promise<boolean> {
  const clipboard = (globalThis as { navigator?: { clipboard?: { writeText: (value: string) => Promise<void> } } })
    .navigator?.clipboard;
  if (!clipboard) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Phone header title block (artifact: 17px title over a muted 12px line). */
export function PhoneTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <View className="min-w-0 flex-1">
      <Text accessibilityRole="header" className="text-[17px] leading-[22px] font-semibold text-foreground">
        {title}
      </Text>
      {sub ? <Text className="text-[12px] leading-4 text-muted">{sub}</Text> : null}
    </View>
  );
}

/** Section heading inside a phone body (artifact: h2 15px/22px). */
export function SectionTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" className="text-[15px] leading-[22px] font-semibold text-foreground">
      {children}
    </Text>
  );
}

/** Soft status chip. `info` renders as accent, matching the design system. */
export function ToneChip({ tone, size, children }: { tone: ResidentTone; size?: "sm"; children: string }) {
  return (
    <Chip color={toneColor(tone)} variant="soft" size={size}>
      <Chip.Label>{children}</Chip.Label>
    </Chip>
  );
}

const CIRCLE = {
  accent: "bg-accent-soft",
  success: "bg-success-soft",
  warning: "bg-warning-soft",
} as const;

const CIRCLE_TONE = {
  accent: "accent-soft-foreground",
  success: "success-soft-foreground",
  warning: "warning-soft-foreground",
} as const;

/** 56px round tone tile holding a 28px icon (artifact: the payment status circle). */
export function IconCircle({ tone, icon }: { tone: keyof typeof CIRCLE; icon: string }) {
  return (
    <View className={`size-[56px] items-center justify-center rounded-full ${CIRCLE[tone]}`}>
      <Icon name={icon} size={28} tone={CIRCLE_TONE[tone]} />
    </View>
  );
}

/** Label / value rows (artifact: .ij-kv). */
export function KeyValue({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <View className="gap-1.5">
      {items.map((item) => (
        <View key={item.label} className="flex-row items-start justify-between gap-3">
          <Text className="text-[13px] leading-[18px] text-muted">{item.label}</Text>
          {typeof item.value === "string" ? (
            <Text className="flex-1 text-right text-[13px] leading-[18px] font-medium text-foreground">
              {item.value}
            </Text>
          ) : (
            <View className="min-w-0 flex-1 items-end">{item.value}</View>
          )}
        </View>
      ))}
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
            <Tabs.Trigger value={item.id} className="min-h-9 flex-1">
              <Tabs.Label>{item.label}</Tabs.Label>
            </Tabs.Trigger>
          </Fragment>
        ))}
      </Tabs.List>
    </Tabs>
  );
}

/** Closed select that opens a bottom sheet of options (artifact: native select). */
export function ChoiceField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}) {
  const selected = options.find((option) => option.id === value);
  return (
    <View className="gap-1">
      <Label>{label}</Label>
      <Select
        presentation="bottom-sheet"
        value={selected ? { value: selected.id, label: selected.label } : undefined}
        onValueChange={(option) => {
          if (option) onChange(option.value);
        }}
      >
        <Select.Trigger className="w-full">
          <Select.Value placeholder={label} />
          <Select.TriggerIndicator />
        </Select.Trigger>
        <Select.Portal>
          <Select.Overlay />
          <Select.Content presentation="bottom-sheet" snapPoints={["40%"]}>
            <Select.ListLabel>{label}</Select.ListLabel>
            {options.map((option) => (
              <Select.Item key={option.id} value={option.id} label={option.label} />
            ))}
          </Select.Content>
        </Select.Portal>
      </Select>
    </View>
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

/** Vertical steps (artifact: timeline). Markers: done, current, or idle. */
export function Timeline({
  label,
  items,
}: {
  label: string;
  items: {
    id: string;
    title: string;
    detail: string;
    marker: "done" | "current" | "idle";
    icon?: string;
  }[];
}) {
  return (
    <View accessibilityLabel={label}>
      {items.map((item, index) => (
        <View key={item.id} className="flex-row gap-3">
          <View className="w-6 items-center self-stretch">
            <View
              className={`size-6 items-center justify-center rounded-full ${
                item.marker === "done"
                  ? "bg-success-soft"
                  : item.marker === "current"
                    ? "border-2 border-accent bg-accent-soft"
                    : "border border-separator bg-surface"
              }`}
            >
              {item.icon ? (
                <Icon name={item.icon} size={12} tone={item.marker === "done" ? "success" : "muted"} />
              ) : null}
            </View>
            {index < items.length - 1 ? (
              <View className="mt-1 w-[2px] flex-1 bg-default" style={{ minHeight: 22 }} />
            ) : null}
          </View>
          <View className={`min-w-0 flex-1 ${index < items.length - 1 ? "pb-3" : ""}`}>
            <Text className="text-[13px] font-medium text-foreground">{item.title}</Text>
            <Text className="text-xs leading-4 text-muted">{item.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** A bundled stock photo. Alt text comes from the shared media manifest. */
export function PhotoThumb({ image, className }: { image: StockKey; className?: string }) {
  const source = stockImages[image];
  return (
    <View className={`overflow-hidden bg-surface-secondary ${className ?? ""}`}>
      {source ? (
        <Image
          source={source}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          accessibilityLabel={stock[image].alt}
        />
      ) : null}
    </View>
  );
}

export function RowList({
  label,
  rows,
}: {
  label: string;
  rows: {
    id: string;
    icon: string;
    title: string;
    desc: string;
    chip?: string;
    tone?: ResidentTone;
    extra?: string;
  }[];
}) {
  return (
    <ListGroup accessibilityLabel={label}>
      {rows.map((row, index) => (
        <View key={row.id}>
          {index > 0 ? <Separator className="mx-4" /> : null}
          <ListGroup.Item className="items-start" style={{ alignItems: "flex-start" }}>
            <ListGroup.ItemPrefix>
              <Icon name={row.icon} />
            </ListGroup.ItemPrefix>
            <ListGroup.ItemContent className="flex-col" style={{ flexDirection: "column", flex: 1 }}>
              <ListGroup.ItemTitle className="text-[15px] leading-5">{row.title}</ListGroup.ItemTitle>
              <ListGroup.ItemDescription className="text-[13px] leading-[18px]">{row.desc}</ListGroup.ItemDescription>
            </ListGroup.ItemContent>
            {row.chip ? (
              <ListGroup.ItemSuffix>
                <View className="items-end gap-1">
                  <ToneChip tone={row.tone ?? "default"} size="sm">
                    {row.chip}
                  </ToneChip>
                  {row.extra ? <Text className="text-xs text-muted">{row.extra}</Text> : null}
                </View>
              </ListGroup.ItemSuffix>
            ) : null}
          </ListGroup.Item>
        </View>
      ))}
    </ListGroup>
  );
}

/**
 * Bottom sheet of a phone screen. Mounted only while open, so a closed sheet adds no text
 * to the artboard comparison.
 */
export function PhoneSheet({
  isOpen,
  onOpenChange,
  heading,
  description,
  onClose,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  heading: string;
  description?: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  if (!isOpen) return null;
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
            <View className="flex-row items-start justify-between gap-2">
              <View className="min-w-0 flex-1 gap-0.5">
                <BottomSheet.Title>{heading}</BottomSheet.Title>
                {description ? <BottomSheet.Description>{description}</BottomSheet.Description> : null}
              </View>
              {onClose ? (
                <Button variant="ghost" size="sm" isIconOnly accessibilityLabel="Close" onPress={onClose}>
                  <Icon name="Xmark" />
                </Button>
              ) : null}
            </View>
            {children}
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
