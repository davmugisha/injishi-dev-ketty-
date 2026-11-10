"use client";

import { CircleCheck } from "@gravity-ui/icons";
import { Alert, Card, Chip } from "@heroui/react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import type { StepKey } from "@/server/mutations/setup";

/** The pieces every setup step is built from: its card, its outcome line and the press that saves it. */
export type Result = { ok: true } | { ok: false; error: string };

export const rwf = (n: number) => `RWF ${n.toLocaleString("en-US")}`;
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export function StepCard({
  id,
  index,
  title,
  done,
  icon,
  lead,
  children,
}: {
  id: StepKey;
  index: number;
  title: string;
  done: boolean;
  icon: ReactNode;
  lead: string;
  children: ReactNode;
}) {
  const t = useTranslations("setup");
  return (
    <Card render={(p) => <section {...p} />} aria-labelledby={`step-${id}`} className="gap-4 p-5">
      <Card.Header className="flex flex-row items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-default text-muted">
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={`step-${id}`} className="text-[15px] leading-[22px] font-semibold">
            {index}. {title}
          </h2>
          <Card.Description>{lead}</Card.Description>
        </div>
        <Chip size="sm" variant="soft" color={done ? "success" : "default"}>
          {done ? t("done") : t("toDo")}
        </Chip>
      </Card.Header>
      {children}
    </Card>
  );
}

export function Outcome({ result, okText }: { result: Result | null; okText: string }) {
  const t = useTranslations("setup");
  if (!result) return null;
  return result.ok ? (
    <p role="status" className="flex items-center gap-1.5 text-[13px] text-success">
      <CircleCheck className="size-4" aria-hidden="true" />
      {okText}
    </p>
  ) : (
    <Alert status="danger" role="alert">
      <Alert.Content>
        <Alert.Title>{t("notSaved")}</Alert.Title>
        <Alert.Description>{result.error}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}

/** Run a server action and keep its outcome for the step it was pressed on. */
export function useStep() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const run = async (call: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setBusy(true);
    setResult(null);
    const res = await call();
    setBusy(false);
    setResult(res.ok ? { ok: true } : { ok: false, error: res.error });
    return res.ok;
  };
  return { busy, result, run };
}

export const SELECT =
  "h-10 w-full rounded-xl border border-separator bg-field px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus";

/**
 * A stored choice list's labels, from the catalog: one key per value (`frontDesk: { limited: … }`).
 *
 * The contracts carry the same lists in English (`FRONT_DESK_LABEL`), which is right for the API and the
 * database. A screen the owner reads fills them from `@injishi/i18n` instead, so no select is half translated.
 */
export function labelsOf<T extends string>(
  values: readonly T[],
  t: (key: string) => string,
): Readonly<Record<T, string>> {
  return Object.fromEntries(values.map((value) => [value, t(value)])) as Readonly<Record<T, string>>;
}

/** The english unit and price words a setup read carries (`SetupVocabulary`). */
export type SetupWords = {
  unitSingular: string;
  unitPlural: string;
  typePlural: string;
  pricePeriod: string;
  priceBasis: string;
};

/** The catalog's key for each unit a business sells: the server's own singular word names it. */
const UNIT_KEY: Readonly<Record<string, string>> = {
  room: "room",
  tent: "tent",
  apartment: "apartment",
  villa: "villa",
  unit: "unit",
  offering: "offering",
};

/** The catalog's key for each way a price is counted: the server's own phrase names it. */
const PERIOD_KEY: Readonly<Record<string, string>> = {
  "per room, per night": "roomNight",
  "per night, for the whole place": "unitNight",
  "per tent, per night": "tentNight",
  "per month": "month",
  each: "each",
};

/**
 * The words a step uses for what it sells, in the reader's language.
 *
 * `GET /ops/setup` words a business in English (`setupVocabularyFor`), which the API shares with the guest pages;
 * a sentence assembled here would end "combien de rooms". A kind this page does not know yet keeps the server's
 * words rather than showing nothing. A lodge lets "rooms and cottages", and reads as its rooms here.
 */
export function useSetupWords(words: SetupWords): SetupWords {
  const t = useTranslations("setup.words");
  const unit = UNIT_KEY[words.unitSingular];
  const period = PERIOD_KEY[words.pricePeriod];
  if (!unit) return words;
  return {
    ...words,
    unitSingular: t(`unit.${unit}.one`),
    unitPlural: t(`unit.${unit}.other`),
    typePlural: t(`typePlural.${unit}`),
    pricePeriod: period ? t(`pricePeriod.${period}`) : words.pricePeriod,
  };
}
