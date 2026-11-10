// A type rather than an interface: it is indexed by the series keys below.
export type TeamPresence = {
  present: number;
  late: number;
  /** Clocked in today and out again. */
  finished: number;
  /** Absent with a reason on record (called in, certificate to follow). */
  explained: number;
  /** Absent with no clock-in and no leave recorded. */
  absent: number;
};

/**
 * This morning's states. Present is most of every bar, so it wears the accent; late and absent
 * keep the status colours, and the neutral marks an absence that is accounted for. The legend
 * names each with its total, so no state is told by colour alone.
 */
const SERIES = [
  { key: "present", label: "Present", color: "var(--accent)" },
  { key: "late", label: "Late", color: "var(--warning)" },
  { key: "finished", label: "Finished", color: "var(--muted)" },
  { key: "explained", label: "Absent, reason given", color: "var(--chart-other)" },
  { key: "absent", label: "Absent", color: "var(--danger)" },
] as const;

export function PresenceLegend({ totals }: { totals: TeamPresence }) {
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: s.color }} />
          {s.label}
          <span className="font-semibold text-foreground tabular">{totals[s.key]}</span>
        </li>
      ))}
    </ul>
  );
}

/** One team's morning as one bar, each state as wide as its share of the people rostered. */
export function PresenceBar({ team, name, className }: { team: TeamPresence; name: string; className?: string }) {
  const parts = SERIES.filter((s) => team[s.key] > 0);
  return (
    <div
      role="img"
      aria-label={`${name}: ${parts.map((s) => `${team[s.key]} ${s.label.toLowerCase()}`).join(", ")}`}
      className={`flex h-2.5 gap-0.5 overflow-hidden rounded-full ${className ?? ""}`}
    >
      {parts.map((s) => (
        <span key={s.key} className="h-full min-w-1.5" style={{ flexGrow: team[s.key], background: s.color }} />
      ))}
    </div>
  );
}
