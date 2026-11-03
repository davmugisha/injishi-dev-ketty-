// Which of `QueryView`'s states a query is in (mobile spec 0003, AC-10 and AC-11; spec 0005, AC-8).
// Pure: no React Native import, so `node --test` runs it.

export type QueryState = "data" | "loading" | "outOfDate" | "error" | "offline";

export type QueryStateInput = {
  /** The screen has something to show: the query's data after the day guard and the overlay. */
  hasData: boolean;
  /** The query holds a copy, even one the screen will not use. */
  hasCopy: boolean;
  /** The screen passed a view for a copy it will not use (from an earlier day). */
  canShowOutOfDate: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  hasError: boolean;
};

export function queryState(input: QueryStateInput): QueryState {
  if (input.hasData) return "data";
  if (input.hasCopy && input.canShowOutOfDate) return input.fetchStatus === "fetching" ? "loading" : "outOfDate";
  if (input.hasError) return "error";
  // A first load waiting for signal: reads are `offlineFirst`, so the first try ran, failed, and its
  // retries now wait until the phone is back online, with no error set yet. With nothing on screen
  // that is "Can't connect" with Retry, not a skeleton that never ends. Signal back resumes it.
  if (input.fetchStatus === "paused") return "offline";
  return "loading";
}
