"use client";

import { Button } from "@heroui/react";
import {
  PSF_FEE_KIND_LABEL,
  PSF_FEE_KINDS,
  type PsfFeeKinds,
  type PsfFeeLine,
  type PsfFeeView,
  type PsfOurShare,
  psfFeeShown,
  psfFeeTotal,
} from "@injishi/contracts";
import { type KpiItem, KpiStrip } from "@injishi/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Which amounts are showing (2026-11-06, the owner), kept in the address so a report can be shared as it is. */
export function useFeeView(): PsfFeeView {
  return useSearchParams().get("fees") === "ours" ? "ours" : "all";
}

/** Today's share of whoever is reading: headquarters' for the National Manager, the district's otherwise. */
export function ourPercent(ours: PsfOurShare, districtPercent: number): number {
  return ours === "headquarters" ? 100 - districtPercent : districtPercent;
}

/** The switch between the whole fee and the viewer's own revenue. */
export function FeeViewSwitch({ ours, districtPercent }: { ours: PsfOurShare; districtPercent: number }) {
  const view = useFeeView();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pick = (next: PsfFeeView) => {
    const query = new URLSearchParams(params.toString());
    if (next === "ours") query.set("fees", "ours");
    else query.delete("fees");
    const text = query.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
  };
  return (
    <fieldset aria-label="Amounts to show" className="m-0 flex flex-wrap items-center gap-1 border-0 p-0 print:hidden">
      <Button size="sm" variant={view === "all" ? "primary" : "secondary"} aria-pressed={view === "all"} onPress={() => pick("all")}>
        All fees · 100%
      </Button>
      <Button size="sm" variant={view === "ours" ? "primary" : "secondary"} aria-pressed={view === "ours"} onPress={() => pick("ours")}>
        Our revenue only · {ourPercent(ours, districtPercent)}%
      </Button>
    </fieldset>
  );
}

/** A line's amount in the view picked. */
export function useFeeAmount(ours: PsfOurShare): (line: PsfFeeLine) => number {
  const view = useFeeView();
  return (line) => psfFeeShown(line, view, ours);
}

/** The period's money by what it was paid for, then the total. */
export function FeeStrip({
  kinds,
  previous,
  ours,
  label = "Money in the period",
}: {
  kinds: PsfFeeKinds;
  previous?: PsfFeeKinds;
  ours: PsfOurShare;
  label?: string;
}) {
  const amount = useFeeAmount(ours);
  const view = useFeeView();
  const trend = (now: number, before: number | undefined): KpiItem["trend"] => {
    if (!before) return undefined;
    return { percent: Math.round(((now - before) / before) * 100), goodWhen: "up", versus: "the period before" };
  };
  const ICON = { application: "PersonPlus", renewal: "ArrowRotateRight", upgrade: "ArrowUp" } as const;
  const total = psfFeeTotal(kinds);
  return (
    <KpiStrip
      label={label}
      items={[
        {
          id: "fees-total",
          label: view === "ours" ? "Our revenue" : "All fees",
          value: amount(total),
          format: "money",
          icon: "Wallet",
          trend: trend(amount(total), previous ? amount(psfFeeTotal(previous)) : undefined),
        },
        ...PSF_FEE_KINDS.map(
          (k): KpiItem => ({
            id: `fees-${k}`,
            label: PSF_FEE_KIND_LABEL[k],
            value: amount(kinds[k]),
            format: "money",
            icon: ICON[k],
            trend: trend(amount(kinds[k]), previous ? amount(previous[k]) : undefined),
          }),
        ),
      ]}
    />
  );
}
