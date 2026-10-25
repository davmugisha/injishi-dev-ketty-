"use client";

import { Alert } from "@heroui/react";
import type { GuestRouteState, LeaderChainStep, LeaderGuest } from "@injishi/contracts";
import { formatDay, Icon, StatusChip, type StatusTone } from "@injishi/ui";

/** Where one step of the chain stands, as a chip: nobody in the post, sent, opened. */
export const ROUTE_STATE: Record<GuestRouteState, { tone: StatusTone; words: string }> = {
  waiting: { tone: "warning", words: "Waiting for a leader" },
  delivered: { tone: "default", words: "Not opened" },
  seen: { tone: "success", words: "Opened" },
};

/** "+250 788 123 456": an E.164 number in groups of three after the country code. */
export function phoneWords(e164: string | null | undefined): string {
  if (!e164) return "";
  // Most numbers in the region have nine national digits: the code is what comes before them.
  const m = /^\+(\d{1,4})(\d{3})(\d{3})(\d{3})$/.exec(e164);
  if (m) return `+${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  return e164;
}

/** The chain in a few words for a list: how many steps opened it, and any step still waiting. */
export function chainWords(chain: readonly LeaderChainStep[]): { opened: string; waiting: number } {
  const seen = chain.filter((c) => c.state === "seen").length;
  return { opened: `${seen} of ${chain.length} opened`, waiting: chain.filter((c) => c.state === "waiting").length };
}

/** "25 Oct to 30 Oct 2026, 5 nights" */
export function stayWords(g: Pick<LeaderGuest, "arrivalOn" | "departureOn" | "nights">): string {
  const nights = g.nights === 0 ? "same day" : g.nights === 1 ? "1 night" : `${g.nights} nights`;
  if (g.arrivalOn === g.departureOn) return `${formatDay(g.arrivalOn)}, ${nights}`;
  return `${formatDay(g.arrivalOn, "weekday")} to ${formatDay(g.departureOn)}, ${nights}`;
}

/** The guest's status chip: flagged wins over where the stay is. */
export function GuestStatusChip({ guest }: { guest: Pick<LeaderGuest, "flagged" | "stay"> }) {
  return <StatusChip kind="guest" status={guest.flagged ? "flagged" : guest.stay} />;
}

/** The chain a guest went along, in order, with who opened it and any flag. */
export function ChainList({ chain }: { chain: LeaderChainStep[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {chain.map((c) => {
        const state = ROUTE_STATE[c.state];
        return (
          <li key={c.role} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-default text-xs font-semibold tabular">
                {c.step}
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium">{c.roleLabel}</span>
              <StatusChip tone={state.tone}>{state.words}</StatusChip>
            </div>
            {c.seenAt ? (
              <p className="pl-9 text-xs text-muted">
                Opened by {c.seenBy ?? "a leader"} on {formatDay(c.seenAt)}
              </p>
            ) : null}
            {c.flag ? (
              <Alert status="danger" className="ml-9 w-auto">
                <Alert.Indicator>
                  <Icon name="Flag" />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title className="text-sm">{c.flag.note}</Alert.Title>
                  <Alert.Description className="text-xs">
                    Flagged by {c.flag.by ?? c.roleLabel} on {formatDay(c.flag.at)}
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
