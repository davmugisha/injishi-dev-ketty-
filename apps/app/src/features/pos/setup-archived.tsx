"use client";

import { ArrowRotateLeft } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import type { ArchivedKind, PosArchivedVenue, PosVenue } from "@/server/pos";
import { archivedAction, restoreAction } from "./actions";
import { Panel } from "./back-office";
import { usePosAction } from "./shared";

const day = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));

/**
 * What was archived at this outlet, and a way back. Archiving never deleted anything, so restoring brings the same
 * row back with its history. A table waits for its archived area; an area comes back without its tables, which are
 * restored one by one (so nothing reappears on the floor unasked).
 */
export function ArchivedStep({
  outletId,
  venue,
  onVenue,
}: {
  outletId: string;
  venue: PosVenue;
  onVenue: (v: PosVenue) => void;
}) {
  const [data, setData] = useState<PosArchivedVenue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { run, pending } = usePosAction();

  // Read again whenever the venue changes (an archive or a restore anywhere on this screen).
  // biome-ignore lint/correctness/useExhaustiveDependencies: venue is the trigger, not an input
  useEffect(() => {
    let live = true;
    archivedAction(outletId).then((r) => {
      if (!live) return;
      if (r.ok) {
        setData(r.value);
        setError(null);
      } else setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [outletId, venue]);

  const restore = (kind: ArchivedKind, id: string, name: string) =>
    run(() => restoreAction(outletId, kind, id), `${name} restored.`, onVenue);

  const total = data ? data.areas.length + data.tables.length + data.stations.length + data.registers.length : 0;

  return (
    <Panel
      title="Archived"
      note="Archived items are hidden from the floor, the till and the kitchen, and keep all their history. Restore brings one back as it was."
    >
      {error ? <p className="text-[13px] text-danger">{error}</p> : null}
      {!data && !error ? <p className="text-[13px] text-muted">Loading…</p> : null}
      {data && total === 0 ? (
        <p className="rounded-xl border border-dashed border-separator p-4 text-[13px] text-muted">
          Nothing is archived at this outlet.
        </p>
      ) : null}
      {data ? (
        <div className="flex flex-col gap-4" data-ui="archived-list">
          <Group title="Dining areas" count={data.areas.length}>
            {data.areas.map((a) => (
              <Row
                key={a.id}
                name={a.name}
                detail={`Archived ${day(a.archivedAt)}${a.archivedTables ? ` · ${a.archivedTables} archived tables` : ""}`}
                onRestore={() => restore("area", a.id, a.name)}
                pending={pending}
              />
            ))}
          </Group>
          <Group title="Tables" count={data.tables.length}>
            {data.tables.map((t) => (
              <Row
                key={t.id}
                name={t.label}
                detail={`${t.seats} seats · ${t.areaName} · archived ${day(t.archivedAt)}`}
                blocked={t.areaArchived ? `Restore ${t.areaName} first` : null}
                onRestore={() => restore("table", t.id, t.label)}
                pending={pending}
              />
            ))}
          </Group>
          <Group title="Stations" count={data.stations.length}>
            {data.stations.map((s) => (
              <Row
                key={s.id}
                name={s.name}
                detail={`${s.kind === "bar" ? "Bar" : "Kitchen"} · archived ${day(s.archivedAt)}`}
                onRestore={() => restore("station", s.id, s.name)}
                pending={pending}
              />
            ))}
          </Group>
          <Group title="Registers" count={data.registers.length}>
            {data.registers.map((r) => (
              <Row
                key={r.id}
                name={r.name}
                detail={`${r.deviceLabel ?? "No device label"} · archived ${day(r.archivedAt)}`}
                onRestore={() => restore("register", r.id, r.name)}
                pending={pending}
              />
            ))}
          </Group>
        </div>
      ) : null}
    </Panel>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <section aria-label={`Archived ${title.toLowerCase()}`}>
      <h3 className="mb-1 text-[13px] font-semibold">
        {title} <span className="font-normal text-muted">({count})</span>
      </h3>
      <ul className="flex flex-col divide-y divide-separator rounded-xl border border-separator">{children}</ul>
    </section>
  );
}

function Row({
  name,
  detail,
  blocked,
  onRestore,
  pending,
}: {
  name: string;
  detail: string;
  blocked?: string | null;
  onRestore: () => void;
  pending: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-medium">{name}</span>
        <span className="text-[12px] text-muted">{detail}</span>
      </div>
      {blocked ? <span className="text-[12px] text-muted">{blocked}</span> : null}
      <Button
        size="sm"
        variant="secondary"
        isDisabled={pending || !!blocked}
        onPress={onRestore}
        aria-label={`Restore ${name}`}
      >
        <ArrowRotateLeft className="size-4" /> Restore
      </Button>
    </li>
  );
}
