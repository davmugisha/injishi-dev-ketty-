// A query's three screen states (mobile spec 0003, AC-10, AC-11), drawn with feature 3's views: a
// skeleton shaped like the content on the first load, an error worded by cause with Retry, and, once
// there is data, the data itself. A failed refresh keeps what was on screen, labelled "as of HH:MM".

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { View } from "react-native";
import { ErrorView, Icon, Text } from "@/components/ui";
import { kigaliTime } from "@/lib/kigali";
import { ApiError } from "./fetch";

type AnyQuery = Pick<UseQueryResult<unknown>, "data" | "error" | "fetchStatus" | "isRefetchError" | "dataUpdatedAt" | "refetch">;

export type QueryViewProps<T> = {
  query: AnyQuery;
  /** What the screen shows: the query's data after the day guard and the overlay; undefined when none. */
  data: T | undefined;
  /** The skeleton, a `LoadingView` shaped like the content. */
  loading: ReactNode;
  /** Shown when the query holds a copy the screen will not use (from an earlier day) and cannot refresh it. */
  outOfDate?: ReactNode;
  children: (data: T) => ReactNode;
};

export function QueryView<T>({ query, data, loading, outOfDate, children }: QueryViewProps<T>) {
  if (data !== undefined) return <>{children(data)}</>;
  if (query.data !== undefined && outOfDate) return <>{query.fetchStatus === "fetching" ? loading : outOfDate}</>;
  if (query.error) return <QueryError error={query.error} onRetry={() => void query.refetch()} />;
  return <>{loading}</>;
}

/** The error, worded by cause: no answer is "Can't connect"; a refusal or a body that does not match is not. */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  // The session takes over for these two: it opens sign in or the step up.
  if (error instanceof ApiError && (error.kind === "signedOut" || error.kind === "stepUp")) return null;
  if (error instanceof ApiError && error.kind === "failed" && !error.parse) {
    return (
      <ErrorView
        icon="CloudSlash"
        title="Can't connect"
        body="Injishi didn't answer. Check your signal, then try again."
        onRetry={onRetry}
        footnote="Anything you do is still saved on this phone and sent later."
      />
    );
  }
  const message = error instanceof ApiError ? error.serverMessage : null;
  return (
    <ErrorView
      icon="TriangleExclamation"
      title="Something went wrong"
      body={message ?? "Injishi couldn't load this. Try again in a moment."}
      onRetry={onRetry}
    />
  );
}

/** When the copy on screen is not fresh: its last refresh failed, or it waits for signal to try. */
export function asOfTime(query: AnyQuery): number | null {
  if (query.data === undefined) return null;
  return query.isRefetchError || query.fetchStatus === "paused" ? query.dataUpdatedAt : null;
}

/** "As of 07:40": a kept copy on screen while the API cannot be reached (AC-10, AC-11). */
export function AsOf({ query }: { query: AnyQuery }) {
  const at = asOfTime(query);
  if (at === null) return null;
  return (
    <View className="flex-row items-center gap-2" accessibilityRole="text">
      <Icon name="CloudSlash" size={16} tone="muted" />
      <Text role="caption" tone="muted">
        As of {kigaliTime(at)} · can't connect
      </Text>
    </View>
  );
}
