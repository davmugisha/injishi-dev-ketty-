import type { AdminSystemHealth } from "@injishi/contracts";

import type { SectionModel, SectionStat } from "@/lib/types";

import { EMPTY, count } from "./format";

/**
 * System health (F-A09) — the platform's own vital signs.
 *
 * The adapter and queue strips are shared with the overview and are mapped by
 * `present/overview.ts` (`presentAdapters`, `presentQueues`). They are not
 * re-mapped here: a queue that is dead-lettering must look identical on both
 * screens, and two mappings of one fact is how it stops doing so.
 */

/**
 * Database and process, as stats.
 *
 * `reachable: false` is the only unconditional red in this file, and it
 * outranks everything else on the screen: an API that answered while its own
 * database is unreachable is a platform that is up and cannot do anything.
 *
 * `migrationsApplied: null` is neutral, not red. It means the API could not
 * report a migration count, which is a gap in the answer rather than a
 * statement that the schema is behind — and rendering "0 migrations" there
 * would be the console asserting an empty database.
 */
export function presentSystemStats(health: AdminSystemHealth): SectionStat[] {
  const db = health.database;
  return [
    {
      label: "Database",
      value: db.reachable ? "reachable" : "unreachable",
      intent: db.reachable ? "success" : "danger",
      note:
        db.latencyMs !== null ? `${db.latencyMs} ms` : "latency not reported",
    },
    {
      label: "Migrations applied",
      value: db.migrationsApplied !== null ? count(db.migrationsApplied) : EMPTY,
      intent: "default",
      note: db.migrationsApplied !== null ? "on the live schema" : "not reported",
    },
    {
      label: "Node",
      value: health.process.nodeVersion,
      intent: "default",
      note: health.process.environment,
    },
    {
      label: "Uptime",
      value: uptime(health.process.uptimeSeconds),
      intent: "default",
      // A process that restarted minutes ago is worth noticing on a health
      // screen, but it is not by itself a fault — so it is said, not coloured.
      note: "since last restart",
    },
  ];
}

function uptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

/**
 * The headline.
 *
 * Counted from the adapter and queue rows the API sent rather than asserted:
 * "two adapters degraded" is a restatement of the strip below it, so the two
 * cannot disagree.
 */
export function presentSystemPrimary(
  health: AdminSystemHealth,
): SectionModel["primary"] {
  const failing = health.adapters.filter((a) => a.status !== "up").length;
  const deadLettered = health.queues.reduce((n, q) => n + q.deadLetter, 0);

  return {
    label: "Adapters not healthy",
    value: count(failing),
    note: `${count(deadLettered)} dead-lettered jobs across ${count(health.queues.length)} queues`,
    intent:
      !health.database.reachable || deadLettered > 0
        ? "danger"
        : failing > 0
          ? "warning"
          : "success",
  };
}
