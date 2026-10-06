"use client";

import { BrokerIcon, HostKindIcons, OtherPropertyIcon } from "@/components/icons/search";

import { findRegistrationKind, type RegistrationKind } from "./registration-kinds";

/** The mark for a kind. `broker` and `other` are the two `HostKindIcons` cannot hold. */
export function iconFor(kind: RegistrationKind) {
  if (kind === "broker") return BrokerIcon;
  if (kind === "other") return OtherPropertyIcon;
  return HostKindIcons[kind];
}

/**
 * "Registering a guest house", in words that read as a sentence.
 *
 * The Business step printed "Registering a" + the label, lowercased, which
 * gave "Registering a apartment" and, for the free text tile, "Registering a
 * other". The article follows the word now, and the two tiles that are not a
 * kind of building say what they are.
 */
export function registeringPhrase(kind: RegistrationKind): string {
  if (kind === "broker") return "as a broker";
  if (kind === "other") return "a place of another kind";
  const label = (findRegistrationKind(kind)?.label ?? kind).toLowerCase();
  return `${/^[aeiou]/.test(label) ? "an" : "a"} ${label}`;
}

/**
 * The kind being registered, shown back with a way to change it.
 *
 * When the kind arrives from `/host` the wizard opens past the question that
 * asks it (`wizard-path.ts`), so this line is where the answer is SEEN: on
 * About you, the first screen, and again on Business, where it decides which
 * fields appear. Change opens the kind question as the ten tiles.
 *
 * A plain button rather than HeroUI's: it is a text link in a sentence, the
 * same treatment the review step gives every Change, and it takes an ordinary
 * click, which the review's `SummaryRow` already relies on.
 */
export function KindSummary({
  kind,
  onChange,
}: {
  kind: RegistrationKind;
  onChange: () => void;
}) {
  const Icon = iconFor(kind);
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-secondary p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground">
        <Icon size={18} />
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <span className="text-muted-foreground">Registering </span>
        <b className="font-semibold">{registeringPhrase(kind)}</b>
      </p>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 rounded text-xs font-semibold text-accent-text underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Change<span className="sr-only"> what you are registering</span>
      </button>
    </div>
  );
}
