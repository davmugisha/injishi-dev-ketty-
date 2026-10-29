"use client";

import { Alert, Chip } from "@heroui/react";
import { Timeline } from "@heroui-pro/react";
import {
  type GuestRouteState,
  LEADER_ROLE_SHORT,
  type LeaderChainStep,
  type LeaderGuest,
  type LeaderScope,
} from "@injishi/contracts";
import { formatDay, formatLocalPhone, Icon, StatusChip, type StatusTone } from "@injishi/ui";

/** Where one step of the chain stands, as a chip: nobody in the post, sent, opened. */
export const ROUTE_STATE: Record<GuestRouteState, { tone: StatusTone; words: string }> = {
  waiting: { tone: "warning", words: "Waiting for a leader" },
  delivered: { tone: "default", words: "Not opened" },
  seen: { tone: "success", words: "Opened" },
};

/** "+250 788 123 456": an E.164 number in groups of three after the country code. */
export function phoneWords(e164: string | null | undefined): string {
  if (!e164) return "";
  // A Rwandan number as people write it here: 0788 555 666.
  if (/^\+250\d{9}$/.test(e164)) return formatLocalPhone(e164);
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

/** The chain in dots for a list: one per post, green opened, blue received, amber waiting, red flagged. */
export function ChainDots({ chain }: { chain: readonly LeaderChainStep[] }) {
  if (chain.length === 0) return <span className="text-xs text-muted">Not routed</span>;
  const { opened, waiting } = chainWords(chain);
  // Filled green: opened. Ring: received, not opened yet. Amber: nobody holds the post. Red: flagged.
  const color = (c: LeaderChainStep) =>
    c.flag
      ? "bg-danger"
      : c.state === "seen"
        ? "bg-success"
        : c.state === "delivered"
          ? "border-2 border-success bg-transparent"
          : "bg-warning";
  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-center gap-1"
        role="img"
        aria-label={chain.map((c) => `${c.roleLabel}: ${c.flag ? "flagged" : ROUTE_STATE[c.state].words}`).join(", ")}
      >
        {chain.map((c, i) => (
          <span key={c.role} className="flex items-center gap-1">
            {i > 0 ? <span aria-hidden className="h-px w-2 bg-separator" /> : null}
            <span aria-hidden className={`size-2.5 rounded-full ${color(c)}`} title={c.roleLabel} />
          </span>
        ))}
      </div>
      <span className="text-xs text-muted tabular">
        {opened}
        {waiting > 0 ? ` · ${waiting} wait for a leader` : ""}
      </span>
    </div>
  );
}

const STEP_STATUS = { seen: "success", delivered: "current", waiting: "warning" } as const;

/**
 * Where the guest's report has been, as a timeline: filed by the host, then each post in the chain's
 * order with when it arrived, who opened it, any flag, or that nobody holds the post yet.
 */
export function ChainList({ guest }: { guest: Pick<LeaderGuest, "chain" | "createdAt" | "changedAt" | "host"> }) {
  return (
    <Timeline size="sm" density="compact" aria-label="Where this guest report has been">
      <Timeline.Item status="success">
        <Timeline.Rail>
          <Timeline.Marker />
          <Timeline.Connector />
        </Timeline.Rail>
        <Timeline.Content className="flex min-w-0 flex-col gap-0.5 pb-1">
          <span className="text-sm font-medium">Filed by {guest.host.name}</span>
          <span className="text-xs text-muted">
            {formatDay(guest.createdAt)}
            {guest.changedAt ? ` · changed on ${formatDay(guest.changedAt)}` : ""}
          </span>
        </Timeline.Content>
      </Timeline.Item>
      {guest.chain.map((c) => (
        <Timeline.Item key={c.role} status={c.flag ? "danger" : STEP_STATUS[c.state]}>
          <Timeline.Rail>
            <Timeline.Marker />
            <Timeline.Connector />
          </Timeline.Rail>
          <Timeline.Content className="flex min-w-0 flex-col gap-1 pb-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 flex-1 text-sm font-medium">{c.roleLabel}</span>
              <StatusChip tone={ROUTE_STATE[c.state].tone}>{ROUTE_STATE[c.state].words}</StatusChip>
            </div>
            <span className="text-xs text-muted">
              {c.seenAt
                ? `Opened by ${c.seenBy ?? "a leader"} on ${formatDay(c.seenAt)}`
                : c.deliveredAt
                  ? `Received on ${formatDay(c.deliveredAt)}, not opened yet`
                  : "Nobody holds this post yet. It goes to them once Injishi appoints one."}
            </span>
            {c.flag ? (
              <Alert status="danger" className="w-auto">
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
          </Timeline.Content>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

/**
 * Whose page this is, in one tidy line: the post as a small chip, the place it covers in full weight, and
 * the levels above it muted ("Village leader · Urugwiro village, Kamatamu cell, Kacyiru sector, Gasabo").
 */
export function ScopeLine({ scopes }: { scopes: readonly LeaderScope[] }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {scopes.map((s) => {
        const [place, ...above] = s.area.split(", ");
        return (
          <span key={s.assignmentId} className="inline-flex min-w-0 items-center gap-2">
            <Chip size="sm" variant="soft" color="accent">
              {LEADER_ROLE_SHORT[s.role]}
            </Chip>
            <span className="font-medium text-foreground">{place}</span>
            {above.length > 0 ? <span className="truncate text-muted">{above.join(", ")}</span> : null}
          </span>
        );
      })}
    </span>
  );
}

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** A stay's days in few words: "25 to 28 Oct", "30 Oct to 2 Nov", with years only across a new year. */
export function stayRange(arrivalOn: string, departureOn: string): string {
  const a = new Date(`${arrivalOn}T12:00:00Z`);
  const b = new Date(`${departureOn}T12:00:00Z`);
  if (arrivalOn.slice(0, 4) !== departureOn.slice(0, 4))
    return `${DAY_MONTH_YEAR.format(a)} to ${DAY_MONTH_YEAR.format(b)}`;
  if (arrivalOn.slice(0, 7) === departureOn.slice(0, 7)) return `${a.getUTCDate()} to ${DAY_MONTH.format(b)}`;
  return `${DAY_MONTH.format(a)} to ${DAY_MONTH.format(b)}`;
}
