"use client";

import { Check, Lock } from "@gravity-ui/icons";
import { Chip, Pagination, SearchField } from "@heroui/react";
import { HoverCard, Segment } from "@heroui-pro/react";
import { DataGrid, type DataGridColumn } from "@heroui-pro/react/data-grid";
import { toneColor } from "@injishi/ui";
import { useMemo, useState } from "react";
import type { SortDescriptor } from "react-aria-components";
import type { PayLine } from "../../model/payroll.ts";
import { Person } from "../people/parts";
import { amount, type PayLineFigures, rwf } from "./pay-calc";

const PAGE = 12;

interface Row {
  id: string;
  line: PayLine;
  gross: number;
  paye: number;
  rssb: number;
  other: number;
  /** Paid with the net and not income: a claim paid back, a loan paid out. */
  onTop: number;
  deductions: number;
  net: number;
}

const SERIES = [
  { key: "net", label: "Net pay", color: "var(--chart-1)" },
  { key: "paye", label: "PAYE", color: "var(--chart-4)" },
  { key: "rssb", label: "RSSB", color: "var(--chart-5)" },
  { key: "other", label: "Other deductions", color: "var(--chart-other)" },
] as const;

/** Flagged lines (new joiners, final pay, held) before the regular ones. */
const flagRank = (r: Row) => (r.line.flag === "Regular" ? 1 : 0);

const SORTS: Record<string, (a: Row, b: Row) => number> = {
  name: (a, b) => a.line.name.localeCompare(b.line.name),
  gross: (a, b) => a.gross - b.gross,
  deductions: (a, b) => a.deductions - b.deductions,
  net: (a, b) => a.net - b.net,
  flag: (a, b) => flagRank(a) - flagRank(b) || a.line.name.localeCompare(b.line.name),
};

/**
 * One line's money as a bar of where it goes, with the francs in a card on hover. It is of the gross and
 * whatever is paid on top of it, so a net above the gross still fits.
 */
function SplitBar({ r }: { r: Row }) {
  const whole = Math.max(0, r.net) + r.paye + r.rssb + r.other;
  const share = (n: number) => (whole > 0 ? (Math.max(0, n) / whole) * 100 : 0);
  return (
    <HoverCard openDelay={200} closeDelay={80}>
      <HoverCard.Trigger className="block w-full py-2">
        <span
          role="img"
          aria-label={`Net ${rwf(r.net)}, PAYE ${rwf(r.paye)}, RSSB ${rwf(r.rssb)}`}
          className="flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-default"
        >
          {SERIES.map((s) => (
            <span key={s.key} className="h-full" style={{ width: `${share(r[s.key])}%`, background: s.color }} />
          ))}
        </span>
      </HoverCard.Trigger>
      <HoverCard.Content placement="top" className="w-[250px] p-3">
        <div className="flex flex-col gap-2 text-sm">
          <span className="flex items-baseline justify-between font-semibold">
            Gross <span className="tabular">{rwf(r.gross)}</span>
          </span>
          {r.onTop > 0 ? (
            <span className="flex items-baseline justify-between font-medium">
              Paid on top <span className="tabular">{rwf(r.onTop)}</span>
            </span>
          ) : null}
          {SERIES.filter((s) => r[s.key] > 0).map((s) => (
            <span key={s.key} className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="flex-1 text-muted">{s.label}</span>
              <span className="font-medium tabular">{rwf(r[s.key])}</span>
              <span className="w-10 text-right text-xs text-muted tabular">{Math.round(share(r[s.key]))}%</span>
            </span>
          ))}
        </div>
      </HoverCard.Content>
    </HoverCard>
  );
}

const columns: DataGridColumn<Row>[] = [
  {
    id: "name",
    header: "Employee",
    isRowHeader: true,
    allowsSorting: true,
    minWidth: 220,
    cell: (r) =>
      r.line.confidential ? (
        <span className="flex items-center gap-2.5 font-medium">
          <span className="flex size-8 items-center justify-center rounded-full bg-default">
            <Lock className="size-3.5 text-muted" aria-hidden="true" />
          </span>
          Owner
        </span>
      ) : (
        <Person name={r.line.name} sub={`${r.line.role} · ${r.line.payBy}`} />
      ),
  },
  {
    id: "split",
    header: "Where the gross goes",
    width: "24%",
    cell: (r) =>
      r.line.confidential ? <span className="block h-2.5 w-full rounded-full bg-default" /> : <SplitBar r={r} />,
  },
  {
    id: "gross",
    header: "Gross",
    allowsSorting: true,
    align: "end",
    cell: (r) => (r.line.confidential ? <span className="text-muted">—</span> : amount(r.gross)),
  },
  {
    id: "deductions",
    header: "Deductions",
    allowsSorting: true,
    align: "end",
    cell: (r) => <span className="text-muted">{r.line.confidential ? "—" : `−${amount(r.deductions)}`}</span>,
  },
  {
    id: "net",
    header: "Net",
    allowsSorting: true,
    align: "end",
    cell: (r) =>
      r.line.confidential ? (
        <span className="text-muted">—</span>
      ) : (
        <span className="text-base font-semibold">{amount(r.net)}</span>
      ),
  },
  {
    id: "flag",
    header: "Flag",
    allowsSorting: true,
    width: 130,
    cell: (r) =>
      r.line.confidential ? (
        <Chip size="sm" variant="soft">
          Confidential
        </Chip>
      ) : r.line.flag === "Regular" ? (
        <span className="text-muted">
          <span aria-hidden="true">—</span>
          <span className="sr-only">Regular</span>
        </span>
      ) : (
        <Chip size="sm" variant="soft" color={toneColor(r.line.flagTone)} className="whitespace-nowrap">
          {r.line.flag}
        </Chip>
      ),
  },
];

/**
 * Every pay line of the month in a sortable grid: who, where their gross goes, gross, deductions and
 * take-home. Sorting runs over all the lines before they are paged; the owner's masked line stays last.
 * A row opens the line's breakdown.
 */
export function PayLinesGrid({
  lines,
  figures,
  staffTotal,
  exceptionCount,
  onOpen,
}: {
  lines: PayLine[];
  figures: Map<string, PayLineFigures>;
  staffTotal: number;
  exceptionCount: number;
  onOpen: (id: string) => void;
}) {
  const [onlyExceptions, setOnlyExceptions] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortDescriptor>({ column: "flag", direction: "ascending" });

  const rows = useMemo(
    () =>
      lines.flatMap((line): Row[] => {
        const f = figures.get(line.id);
        if (!f) return [];
        return [
          {
            id: line.id,
            line,
            gross: f.gross,
            paye: f.paye,
            rssb: f.rssb,
            other: f.otherDeductions,
            onTop: f.onTop,
            deductions: f.paye + f.rssb + f.otherDeductions,
            net: f.net,
          },
        ];
      }),
    [lines, figures],
  );

  const q = query.trim().toLowerCase();
  const shown = (onlyExceptions ? rows.filter((r) => r.line.isException) : rows).filter(
    (r) => !q || `${r.line.name} ${r.line.role} ${r.line.payBy}`.toLowerCase().includes(q),
  );
  const by = SORTS[String(sort.column)] ?? SORTS.flag;
  const dir = sort.direction === "descending" ? -1 : 1;
  const sorted = [
    ...shown.filter((r) => !r.line.confidential).sort((a, b) => by(a, b) * dir),
    ...shown.filter((r) => r.line.confidential),
  ];
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const at = Math.min(page, pages);
  const pageRows = sorted.slice((at - 1) * PAGE, at * PAGE);
  const sum = (k: "gross" | "deductions" | "onTop" | "net") =>
    shown.filter((r) => !r.line.confidential).reduce((t, r) => t + r[k], 0);
  const onTop = sum("onTop");

  return (
    <section className="flex flex-col gap-[10px]" aria-labelledby="lines-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="lines-h" className="flex items-center gap-2 text-base leading-[22px] font-semibold">
          Pay lines
          <Chip size="sm" variant="soft">
            {staffTotal}
          </Chip>
          {exceptionCount === 0 ? (
            <Chip size="sm" variant="soft" color="success">
              <Check className="size-3" aria-hidden="true" />
              <Chip.Label>No exceptions</Chip.Label>
            </Chip>
          ) : null}
        </h2>
        <div className="flex min-w-0 flex-[1_1_320px] flex-wrap items-center justify-end gap-2">
          <div className="me-auto hidden flex-wrap items-center gap-3 text-xs text-muted xl:flex">
            {SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
          <SearchField
            aria-label="Search pay lines"
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            className="min-w-0 flex-[1_1_160px] sm:max-w-[240px]"
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Name, role or bank" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <Segment
            aria-label="Show lines"
            size="sm"
            selectedKey={onlyExceptions ? "exceptions" : "all"}
            onSelectionChange={(k) => {
              setOnlyExceptions(k === "exceptions");
              setPage(1);
            }}
          >
            <Segment.Item id="all">All</Segment.Item>
            <Segment.Item id="exceptions">
              <Segment.Separator />
              Exceptions
            </Segment.Item>
          </Segment>
        </div>
      </div>
      <DataGrid
        aria-label="Pay lines"
        data={pageRows}
        columns={columns}
        getRowId={(r) => r.id}
        sortDescriptor={sort}
        onSortChange={(d) => {
          setSort(d);
          setPage(1);
        }}
        onRowAction={(key) => onOpen(String(key))}
        contentClassName="min-w-[760px] [&_tbody_tr]:cursor-pointer"
        renderEmptyState={() => <span className="block py-6 text-center text-sm text-muted">No line matches</span>}
        footerClassName="flex-wrap justify-between gap-x-4 gap-y-2"
        footer={
          <>
            <span className="text-xs text-muted tabular">
              {sorted.length ? `${(at - 1) * PAGE + 1}–${Math.min(at * PAGE, sorted.length)}` : 0} of {sorted.length} ·
              Gross <b className="text-foreground">{rwf(sum("gross"))}</b> · Deductions{" "}
              <b className="text-foreground">{rwf(sum("deductions"))}</b>
              {onTop > 0 ? (
                <>
                  {" "}
                  · Paid on top <b className="text-foreground">{rwf(onTop)}</b>
                </>
              ) : null}{" "}
              · Net <b className="text-foreground">{rwf(sum("net"))}</b>
            </span>
            {pages > 1 ? (
              <Pagination size="sm">
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Previous
                      aria-label="Previous page"
                      isDisabled={at === 1}
                      onPress={() => setPage(at - 1)}
                    >
                      <Pagination.PreviousIcon />
                    </Pagination.Previous>
                  </Pagination.Item>
                  {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                    <Pagination.Item key={n}>
                      <Pagination.Link
                        isActive={n === at}
                        aria-label={`Page ${n}`}
                        aria-current={n === at ? "page" : undefined}
                        onPress={() => setPage(n)}
                      >
                        {n}
                      </Pagination.Link>
                    </Pagination.Item>
                  ))}
                  <Pagination.Item>
                    <Pagination.Next aria-label="Next page" isDisabled={at === pages} onPress={() => setPage(at + 1)}>
                      <Pagination.NextIcon />
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            ) : null}
          </>
        }
      />
    </section>
  );
}
