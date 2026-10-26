import { type PhoneAppId, type PhoneTab, screenByPath, screenHref, tabbars } from "@injishi/data";
import { Link, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./icon";

const APP_LABEL: Record<PhoneAppId, string> = {
  housekeeper: "Staff app",
  supervisor: "Supervisor app",
  technician: "Technician app",
  resident: "Resident portal",
  guest: "Guest app",
};

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

/** Bottom tab bar of a phone app (artifact: .ij-tabbar); the current tab follows the route. */
export function TabBar({ app }: { app: PhoneAppId }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const tabs: PhoneTab[] = tabbars[app];
  const screen = screenByPath(pathname);
  const current = tabs.some((t) => t.board === screen?.board) ? screen?.board : screen?.tabCurrent;
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={APP_LABEL[app]}
      className="flex-row justify-around border-t border-separator bg-surface px-2 pt-1.5"
      style={{ paddingBottom: Math.max(insets.bottom, 22) }}
    >
      {tabs.map((t) => {
        const active = t.board === current;
        return (
          <Link key={t.board} href={screenHref(t.board) as never} asChild>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              className="min-h-12 flex-1 items-center justify-center gap-0.5 rounded-[14px]"
            >
              <Icon name={t.icon} size={22} tone={active ? "accent" : "muted"} />
              <Text className={`text-[11px] font-medium ${active ? "text-accent-soft-foreground" : "text-muted"}`}>
                {t.label}
              </Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}
