import type {
  AdminAccessLogRow,
  AdminAuditRow,
  AdminTimelineEvent,
} from "@injishi/contracts";

import type { SectionRow } from "@/lib/types";

import { EMPTY, dateTime, detail, humanise } from "./format";

/**
 * Audit (F-A10) — what was done, and what was looked at.
 *
 * ALMOST NOTHING IS COLOURED HERE, and that is the point of the section. An
 * audit trail records what happened; deciding which of those events was bad is
 * a judgement, and a console that pre-judges them teaches its readers to scan
 * for red and miss everything else. The two exceptions below are not judgements
 * about the event — they are facts about HOW it was performed.
 */

/**
 * One audit event.
 *
 * The single colour rule: an action taken while impersonating somebody is
 * amber. That is not "this was wrong", it is "this was not done by the account
 * it appears to have been done by", which is the one thing a reader of this
 * table cannot afford to skim past.
 */
export function presentAuditRow(row: AdminAuditRow): SectionRow {
  return {
    ref: dateTime(row.occurredAt),
    subject: humanise(row.eventType),
    context: detail(
      row.actorName ?? row.actorUserId ?? "system",
      row.impersonatedUserId ? `as ${row.impersonatedUserId}` : null,
      row.subjectType
        ? detail(humanise(row.subjectType), row.subjectId)
        : null,
      row.reason,
    ),
    state: row.impersonatedUserId ? "impersonated" : (row.subjectType ?? EMPTY),
    intent: row.impersonatedUserId ? "warning" : "default",
  };
}

/**
 * One record-access log row — somebody read somebody else's identity data.
 *
 * The reason is REQUIRED on the wire and is shown in full, never truncated into
 * a code. The whole control is that a person had to type a purpose before the
 * platform would show them a national ID; a log that hides what they typed
 * gives back exactly what was gained.
 *
 * `national_id` and `id_photo` reads are amber. Not because they are wrong —
 * they are a legitimate part of verification — but because they are the class
 * of read this log exists for, and they should be visible at a glance among the
 * contact-detail lookups.
 */
export function presentAccessLogRow(row: AdminAccessLogRow): SectionRow {
  const sensitive =
    row.dataClass === "national_id" || row.dataClass === "id_photo";
  return {
    ref: dateTime(row.occurredAt),
    subject: row.actorName ?? row.actorUserId,
    context: detail(
      `read ${humanise(row.dataClass)}`,
      row.subjectUserId ?? row.subjectRef,
      row.reason,
    ),
    state: humanise(row.dataClass),
    intent: sensitive ? "warning" : "default",
  };
}

/**
 * One event on a business's timeline.
 *
 * The same shape as an audit row and deliberately the same discipline: no
 * colour, because a timeline is a record and not a verdict.
 */
export function presentTimelineEvent(event: AdminTimelineEvent): SectionRow {
  return {
    ref: dateTime(event.occurredAt),
    subject: humanise(event.eventType),
    context: detail(
      event.actorName ?? event.actorUserId ?? "system",
      event.reason,
    ),
    state: event.subjectType ? humanise(event.subjectType) : EMPTY,
    intent: "default",
  };
}
