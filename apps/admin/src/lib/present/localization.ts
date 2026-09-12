import type {
  AdminEmailTemplate,
  AdminLocalization,
  AdminTranslationEntry,
} from "@injishi/contracts";

import type { BadgeIntent, SectionModel, SectionRow, SectionStat } from "@/lib/types";

import { count, percent } from "./format";

/**
 * Localization (F-A15) — translations and email templates.
 *
 * The platform serves Rwanda in English and Kinyarwanda, so a missing
 * Kinyarwanda string is not a nice-to-have that is pending: it is a person who
 * gets an English screen. That is why `missing` is red here and not amber.
 */

const TRANSLATION_INTENT: Readonly<
  Record<AdminTranslationEntry["status"], BadgeIntent>
> = {
  translated: "success",
  // Written once and since changed on the English side, so what is on screen is
  // a translation of something that no longer exists. Amber: it reads fine and
  // says the wrong thing.
  needs_review: "warning",
  missing: "danger",
};

export function presentTranslationEntry(
  entry: AdminTranslationEntry,
): SectionRow {
  return {
    ref: `v${entry.version}`,
    subject: entry.key,
    context: entry.valueEn ?? entry.valueRw ?? "no text in either language",
    state: entry.status.replace(/_/g, " "),
    intent: TRANSLATION_INTENT[entry.status],
  };
}

/**
 * An email template.
 *
 * A transactional template missing its Kinyarwanda subject is red, and a
 * marketing one is amber, because the two fail differently: a person can ignore
 * an English newsletter, but a booking confirmation they cannot read is a
 * booking they cannot verify.
 */
export function presentEmailTemplate(template: AdminEmailTemplate): SectionRow {
  const missingRw = !template.subjectRw;
  return {
    ref: `v${template.version}`,
    subject: template.templateKey,
    context: template.subjectEn ?? template.subjectRw ?? "no subject set",
    state: template.isTransactional ? "transactional" : "marketing",
    intent: !missingRw
      ? "success"
      : template.isTransactional
        ? "danger"
        : "warning",
  };
}

/**
 * Coverage, from the counts the server sent.
 *
 * The percentage is computed here from `translated` and `total` rather than
 * counted from the `entries` array: the two are not the same population, so
 * counting the array would report the state of a slice as the state of the
 * platform.
 */
export function presentCoverageStats(data: AdminLocalization): SectionStat[] {
  const c = data.coverage;
  return [
    {
      label: "Missing",
      value: count(c.missing),
      intent: c.missing > 0 ? "danger" : "success",
      note: "no Kinyarwanda text at all",
    },
    {
      label: "Stale",
      value: count(c.stale),
      intent: c.stale > 0 ? "warning" : "success",
      note: "English changed since translating",
    },
    {
      label: "Translated",
      value: count(c.translated),
      intent: "default",
      note: `of ${count(c.total)} keys`,
    },
  ];
}

export function presentCoveragePrimary(
  data: AdminLocalization,
): SectionModel["primary"] {
  const c = data.coverage;
  // A platform with no keys yet is not 100% translated; it is unmeasured. Say
  // so rather than printing a perfect score nobody earned.
  const ratio = c.total > 0 ? (c.translated / c.total) * 100 : null;

  return {
    label: "Kinyarwanda coverage",
    value: ratio === null ? "not measured" : percent(ratio, 0),
    note: `${count(c.missing)} missing · ${count(c.stale)} stale`,
    intent:
      ratio === null
        ? "default"
        : c.missing > 0
          ? "danger"
          : c.stale > 0
            ? "warning"
            : "success",
  };
}
