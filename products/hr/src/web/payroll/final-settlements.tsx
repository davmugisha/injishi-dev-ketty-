"use client";

import { Chip } from "@heroui/react";
import { ItemCard, ItemCardGroup, NumberValue, Widget } from "@heroui-pro/react";
import { LinkButton } from "@injishi/ui";
import { useState } from "react";
import type { FinalSettlement, PayLine } from "../../model/payroll.ts";
import { useBoardHref } from "../mount.tsx";
import { AmountList, type AmountRow, PressableItemCard } from "./parts";
import { type PayLineFigures, rwf, signedRwf } from "./pay-calc";
import { SettlementWaterfall } from "./pay-run-charts";

/**
 * Everyone leaving this month, and the final pay of the one picked: what is paid and what is taken, each
 * part of it under its own name, so overtime never reads as unused leave.
 */
export function FinalSettlements({
  settlements,
  lines,
  figures,
}: {
  settlements: FinalSettlement[];
  lines: PayLine[];
  figures: Map<string, PayLineFigures>;
}) {
  const screenHref = useBoardHref();
  const [picked, setPicked] = useState<string | null>(null);
  const rows = settlements.flatMap((s) => {
    const line = lines.find((l) => l.id === s.lineId);
    const fig = line ? figures.get(line.id) : undefined;
    return line && fig ? [{ s, line, fig }] : [];
  });
  const cur = rows.find((r) => r.s.id === picked) ?? rows[0];
  if (!cur) return null;
  const { s, line, fig } = cur;

  const partsOf = (kind: "leave" | "other") => s.parts.filter((p) => p.kind === kind).reduce((t, p) => t + p.amount, 0);
  // Two lines can share a name, such as overtime under two contracts; a list row is one name.
  const byName = new Map<string, number>();
  for (const p of s.parts) byName.set(p.label, (byName.get(p.label) ?? 0) + p.amount);
  const amounts: AmountRow[] = [
    { label: "Wage", value: rwf(line.base) },
    ...(line.allowances ? [{ label: "Allowance", value: rwf(line.allowances) }] : []),
    ...[...byName].map(([label, amount]) => ({ label, value: rwf(amount) })),
    { label: "Gross", value: rwf(fig.gross), total: true },
    { label: "Taxes", value: signedRwf(fig.paye + fig.rssb, "−") },
    ...(fig.otherDeductions ? [{ label: "Deductions", value: signedRwf(fig.otherDeductions, "−") }] : []),
    ...(fig.onTop ? [{ label: line.figures?.nonIncomeLabel ?? "Paid on top", value: signedRwf(fig.onTop, "+") }] : []),
    { label: "Net pay", value: rwf(fig.net), total: true },
  ];

  return (
    <Widget role="region" aria-labelledby="fs-h" className="min-w-0">
      <Widget.Header>
        <Widget.Title id="fs-h" role="heading" aria-level={2}>
          {rows.length > 1 ? `Final settlements · ${rows.length}` : `Final settlement · ${s.name}`}
        </Widget.Title>
        <LinkButton href={screenHref(s.board)} size="sm" variant="ghost">
          Offboarding
        </LinkButton>
      </Widget.Header>
      <Widget.Content className="flex flex-col gap-2">
        {rows.length > 1 ? (
          <ItemCardGroup layout="list" aria-label="Who leaves this month" className="overflow-hidden">
            {rows.map((r) => (
              <PressableItemCard
                key={r.s.id}
                isSelected={r.s.id === s.id}
                onPress={() => setPicked(r.s.id)}
                className="items-center"
              >
                <ItemCard.Content className="min-w-0 flex-1 items-start">
                  <ItemCard.Title>{r.s.name}</ItemCard.Title>
                  <ItemCard.Description>{r.line.payBy}</ItemCard.Description>
                </ItemCard.Content>
                <span className="font-semibold tabular">{rwf(r.fig.net)}</span>
              </PressableItemCard>
            ))}
          </ItemCardGroup>
        ) : null}
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <NumberValue
            value={fig.net}
            style="currency"
            currency="RWF"
            className="text-[24px] leading-8 font-bold tabular"
          />
          <Chip size="sm" variant="soft">
            {line.payBy}
          </Chip>
        </div>
        <div className="grid items-center gap-x-5 gap-y-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <SettlementWaterfall
            wage={line.base}
            allowance={line.allowances}
            leave={partsOf("leave")}
            other={partsOf("other")}
            gross={fig.gross}
            taxes={fig.paye + fig.rssb}
            deductions={fig.otherDeductions}
            onTop={fig.onTop}
            net={fig.net}
          />
          <AmountList rows={amounts} className="text-xs" />
        </div>
      </Widget.Content>
    </Widget>
  );
}
