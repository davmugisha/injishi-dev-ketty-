import type {
  AdminCompliance,
  AdminComplianceArtifact,
  AdminDsrRow,
} from "@injishi/contracts";

import type { SectionModel, SectionRow, SectionStat } from "@/lib/types";

import { count, date, detail, humanise } from "./format";

/**
 * Compliance (F-A08) — artifacts, data-subject requests, and what is overdue.
 */

/**
 * A compliance artifact, coloured by its review clock.
 *
 * The date is the whole fact. An NCSA registration or a DPIA is not "good" or
 * "bad" — it is either reviewed on time or it is not, and only the review date
 * says which. Overdue is red, due inside thirty days is amber, and an artifact
 * with no review date is neutral because nothing is late that was never due.
 */
export function presentComplianceArtifact(
  artifact: AdminComplianceArtifact,
  now: Date = new Date(),
): SectionRow {
  const due = artifact.reviewDueAt ? new Date(artifact.reviewDueAt) : null;
  const overdue = due !== null && due.getTime() < now.getTime();
  const soon =
    due !== null &&
    !overdue &&
    due.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000;

  return {
    ref: humanise(artifact.artifactType),
    subject: artifact.processorName ?? humanise(artifact.artifactType),
    context: detail(
      `recorded ${date(artifact.createdAt)}`,
      artifact.reviewDueAt ? `review due ${date(artifact.reviewDueAt)}` : null,
    ),
    state: overdue ? "overdue" : soon ? "due soon" : "on file",
    intent: overdue ? "danger" : soon ? "warning" : "default",
  };
}

/**
 * A data-subject request.
 *
 * `received` is amber rather than neutral because a DSR is a clock: the law
 * gives a window, and a request sitting in `received` is the window running
 * down. `dualAuthorized` and `retentionExceptionApplied` ride in the context
 * line because both are reasons a request took the path it took, and an
 * auditor reading this row will ask about exactly those two.
 */
export function presentDsrRow(row: AdminDsrRow): SectionRow {
  return {
    ref: humanise(row.requestType),
    subject: row.subjectUserId ?? "subject not linked",
    context: detail(
      `raised ${date(row.createdAt)}`,
      row.dualAuthorized && "dual authorised",
      row.retentionExceptionApplied && "retention exception applied",
    ),
    state: row.state,
    intent: row.state === "fulfilled" ? "success" : "warning",
  };
}

/**
 * The two numbers that say whether this section needs a person today.
 *
 * `artifactCount` is deliberately not one of them: how many documents are on
 * file says nothing about whether any of them is late.
 */
export function presentComplianceStats(data: AdminCompliance): SectionStat[] {
  return [
    {
      label: "Open requests",
      value: count(data.stats.openRequests),
      intent: data.stats.openRequests > 0 ? "warning" : "success",
      note: "data-subject rights",
    },
    {
      label: "Overdue reviews",
      value: count(data.stats.overdueReviews),
      intent: data.stats.overdueReviews > 0 ? "danger" : "success",
      note: "artifacts past their review date",
    },
    {
      label: "Artifacts on file",
      value: count(data.stats.artifactCount),
      intent: "default",
      note: "NCSA, DPO, DPIA, processors",
    },
  ];
}

/** The headline: an overdue review is the loudest thing this section owns. */
export function presentCompliancePrimary(
  data: AdminCompliance,
): SectionModel["primary"] {
  return {
    label: "Overdue reviews",
    value: count(data.stats.overdueReviews),
    note: `${count(data.stats.openRequests)} open data-subject requests`,
    intent: data.stats.overdueReviews > 0 ? "danger" : "success",
  };
}
