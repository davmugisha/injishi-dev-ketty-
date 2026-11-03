import { Link } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./icon";

/** One tab of a phone app's bar: what it says, its glyph and where it goes. */
export interface TabItem {
  key: string;
  label: string;
  /** A name from `icons.json`. */
  icon: string;
  href: string;
}

/** Header row of a phone screen (artifact: .ij-phone-top). */
export function PhoneTop({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-row items-center gap-2 px-4 pb-2" style={{ paddingTop: Math.max(insets.top, 12) + 8 }}>
      {children}
    </View>
  );
}

/** Scrolling body of a phone screen (artifact: .ij-phone-body). */
export function PhoneBody({ children }: { children: ReactNode }) {
  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pt-2 pb-4">
      {children}
    </ScrollView>
  );
}

/**
 * Bottom tab bar of a phone app (artifact: .ij-tabbar). The caller gives the tabs and which one is
 * current: the staff layout from `@injishi/data`'s bars, the guest layout from its own list (mobile
 * spec 0005, D-am), so every bar shares one look and the guest files import no demo data.
 */
export function TabBar({
  label,
  tabs,
  current,
}: {
  label: string;
  tabs: readonly TabItem[];
  current: string | undefined;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      className="flex-row justify-around border-t border-separator bg-surface px-2 pt-1.5"
      style={{ paddingBottom: Math.max(insets.bottom, 22) }}
    >
      {tabs.map((t) => {
        const active = t.key === current;
        return (
          <Link key={t.key} href={t.href as never} asChild>
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: active }}
              className="min-h-12 flex-1 items-center justify-center gap-0.5 rounded-[14px]"
            >
              <Icon name={t.icon} size={22} tone={active ? "accent" : "muted"} />
              <Text
                maxFontSizeMultiplier={1.5}
                className={`text-[11px] font-medium ${active ? "text-accent-soft-foreground" : "text-muted"}`}
              >
                {t.label}
              </Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}
