// Parts the shared screens have in common: back with a fallback inside the current app, an eyebrow
// heading, the profile head, a centred footnote and list skeletons.

import { type Href, router } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { Avatar, LoadingBone, Text } from "@/components/ui";
import type { Person } from "./types";

/**
 * Back as the prototype's back button does, but a screen opened with no history (a deep link, the
 * launcher) goes to `fallback`, a screen of the app it sits in, rather than the start.
 */
export function useBackTo(fallback: Href): () => void {
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [fallback]);
}

/** `.eyebrow`: a small capitals heading above a list ("Work", "Sent today"). */
export function Eyebrow({ children, className }: { children: string; className?: string }) {
  return (
    <Text role="micro" tone="muted" caps strong accessibilityRole="header" className={className}>
      {children}
    </Text>
  );
}

/** A quiet centred line under a list ("Invited somewhere new? …"). */
export function Footnote({ children }: { children: string }) {
  return (
    <Text role="caption" tone="muted" className="text-center">
      {children}
    </Text>
  );
}

/** `.row g14` with `.ava xl`: the person at the top of Account and Me. */
export function ProfileHead({ person }: { person: Person }) {
  return (
    <View className="flex-row items-center gap-3.5">
      <Avatar size="xl" name={person.name} initials={person.initials} />
      <View className="flex-1 gap-0.5">
        <Text role="title3">{person.name}</Text>
        <Text role="callout" tone="muted">
          {person.email}
        </Text>
        {person.lines.map((line) => (
          <Text key={line} role="callout" tone="muted">
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** A list group's skeleton: `rows` bones of one row's height inside one rounded block. */
export function ListBones({ rows }: { rows: number }) {
  return (
    <View className="gap-px overflow-hidden rounded-3xl">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a bone is a position, not an item
        <LoadingBone key={i} className="h-14 rounded-none" />
      ))}
    </View>
  );
}
