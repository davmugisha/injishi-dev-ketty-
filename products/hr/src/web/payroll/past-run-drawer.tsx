"use client";

import {
  ArrowDownToLine,
  CircleDollar,
  CreditCard,
  FileDollar,
  Lock,
  Persons,
  Receipt,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "@gravity-ui/icons";
import { Alert, Button, Chip, Drawer, SearchField, Skeleton } from "@heroui/react";
import { ItemCard, ItemCardGroup, KPIGroup, Timeline } from "@heroui-pro/react";
import { DataGrid, type DataGridColumn } from "@heroui-pro/react/data-grid";
import { KPI } from "@heroui-pro/react/kpi";
import { type ReactNode, useEffect, useState } from "react";
import type { PastRun, PayRunHistory } from "../../model/payroll.ts";
import { useHrActions } from "../mount.tsx";
import { Person } from "../people/parts";
import { LineDonut } from "./parts";
import { rwf } from "./pay-calc";

type FileKind = "bank" | "momo" | "paye" | "rssb";
const FILES: { kind: FileKind; label: string; desc: string; icon: ReactNode }[] = [
  { kind: "bank", label: "Bank file", desc: "Transfers for the bank", icon: <CreditCard /> },
  { kind: "momo", label: "Mobile money", desc: "MTN MoMo and Airtel Money", icon: <Smartphone /> },
  { kind: "paye", label: "PAYE return", desc: "Tax declaration for RRA", icon: <FileDollar /> },
  { kind: "rssb", label: "RSSB return", desc: "Pension and maternity", icon: <ShieldCheck /> },
];
type Slip = PastRun["payslips"][number];

const KPI_CLASS = "min-w-[140px] flex-1";
/** RWF in a KPI: "RWF 11.3M". */
const money = { style: "currency", currency: "RWF", notation: "compact", maximumFractionDigits: 1 } as const;

/** The change against the month before, as a trend chip: "+3" staff, "+4.2%" on money. */
function Change({ now, before, unit }: { now: number; before: number | null; unit: "count" | "money" }) {
  if (before === null || before === 0 || now === before) return null;
  const up = now > before;
  const text =
    unit === "count"
      ? `${up ? "+" : "−"}${Math.abs(now - before)}`
      : `${up ? "+" : "−"}${Math.abs(((now - before) / before) * 100).toFixed(1)}%`;
  return <KPI.Trend trend={up ? "up" : "down"}>{text}</KPI.Trend>;
}

/** A payslip's figure; the owner's, read by someone else, is hidden. */
const figure = (p: Slip, value: number) => (p.confidential ? <span className="text-muted">—</span> : rwf(value));

const columns: DataGridColumn<Slip>[] = [
  {
    id: "name",
    header: "Person",
    accessorKey: "name",
    isRowHeader: true,
    allowsSorting: true,
    minWidth: 200,
    cell: (p) =>
      p.confidential ? (
        <span className="flex items-center gap-2.5 font-medium">
          <span className="flex size-8 items-center justify-center rounded-full bg-default">
            <Lock className="size-3.5 text-muted" aria-hidden="true" />
          </span>
          Owner
        </span>
      ) : (
        <Person name={p.name} sub={`${p.days} days`} />
      ),
  },
  {
    id: "gross",
    header: "Gross",
    accessorKey: "gross",
    allowsSorting: true,
    align: "end",
    cell: (p) => figure(p, p.gross),
  },
  {
    id: "paye",
    header: "PAYE",
    accessorKey: "paye",
    allowsSorting: true,
    align: "end",
    cell: (p) => figure(p, p.paye),
  },
  {
    id: "rssb",
    header: "RSSB",
    accessorKey: "rssb",
    allowsSorting: true,
    align: "end",
    cell: (p) => figure(p, p.rssb),
  },
  {
    id: "net",
    header: "Take-home",
    accessorKey: "net",
    allowsSorting: true,
    align: "end",
    cell: (p) => <span className="font-semibold">{figure(p, p.net)}</span>,
  },
];

/**
 * A confirmed month, opened from "Previous runs": its totals against the month before, where the
 * gross went, how it was signed off, its files, and every payslip in a table to sort and search.
 */
export function PastRunDrawer({
  summary,
  previous,
  canFiles,
  building,
  onBuild,
  onOpenChange,
}: {
  summary: PayRunHistory | null;
  /** The month before it, for the change on each total. */
  previous: PayRunHistory | null;
  canFiles: boolean;
  building: boolean;
  onBuild: (kind: FileKind) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const { loadPastRun } = useHrActions();
  const id = summary?.id ?? null;
  const [loaded, setLoaded] = useState<{ id: string; run: PastRun | null; error: string | null } | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!id) return;
    let live = true;
    setQuery("");
    loadPastRun(id)
      .then((r) => {
        if (live) setLoaded({ id, run: r.ok ? r.run : null, error: r.ok ? null : r.error });
      })
      .catch(() => {
        if (live) setLoaded({ id, run: null, error: "Try again in a moment." });
      });
    return () => {
      live = false;
    };
  }, [id, loadPastRun]);

  const current = loaded && loaded.id === id ? loaded : null;
  const run = current?.run ?? null;
  const q = query.trim().toLowerCase();
  const slips = (run?.payslips ?? []).filter((p) => !q || p.name.toLowerCase().includes(q));
  const sum = (k: "gross" | "paye" | "rssb" | "net") => slips.reduce((t, p) => t + p[k], 0);

  return (
    <Drawer.Backdrop isOpen={summary !== null} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog aria-labelledby="past-h" className="w-full max-w-[760px]">
          <Drawer.CloseTrigger aria-label="Close" />
          {summary ? (
            <>
              <Drawer.Header className="flex flex-row items-center gap-2 pr-12">
                <Drawer.Heading id="past-h" className="text-[20px] leading-7 font-semibold">
                  {summary.period}
                </Drawer.Heading>
                <Chip size="sm" variant="soft" color="success">
                  {summary.outcome}
                </Chip>
              </Drawer.Header>

              <Drawer.Body className="flex flex-col gap-5 [&>*]:shrink-0">
                {current?.error ? (
                  <Alert status="danger">
                    <Alert.Content>
                      <Alert.Title>Could not load this month</Alert.Title>
                      <Alert.Description>{current.error}</Alert.Description>
                    </Alert.Content>
                  </Alert>
                ) : !run ? (
                  <div className="flex flex-col gap-3" aria-busy="true">
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-40 rounded-2xl" />
                    <Skeleton className="h-64 rounded-2xl" />
                  </div>
                ) : (
                  <>
                    <KPIGroup className="flex-wrap">
                      <KPI className={KPI_CLASS}>
                        <KPI.Header>
                          <KPI.Icon status="success">
                            <Persons />
                          </KPI.Icon>
                          <KPI.Title>Staff paid</KPI.Title>
                        </KPI.Header>
                        <KPI.Content>
                          <KPI.Value value={run.headcount} className="tabular" />
                          <Change now={run.headcount} before={previous?.staff ?? null} unit="count" />
                        </KPI.Content>
                      </KPI>
                      <KPIGroup.Separator />
                      <KPI className={KPI_CLASS}>
                        <KPI.Header>
                          <KPI.Icon status="success">
                            <Wallet />
                          </KPI.Icon>
                          <KPI.Title>Gross</KPI.Title>
                        </KPI.Header>
                        <KPI.Content>
                          <KPI.Value value={run.grossRwf} {...money} className="tabular" />
                        </KPI.Content>
                      </KPI>
                      <KPIGroup.Separator />
                      <KPI className={KPI_CLASS}>
                        <KPI.Header>
                          <KPI.Icon status="warning">
                            <Receipt />
                          </KPI.Icon>
                          <KPI.Title>PAYE</KPI.Title>
                        </KPI.Header>
                        <KPI.Content>
                          <KPI.Value value={run.payeRwf} {...money} className="tabular" />
                        </KPI.Content>
                      </KPI>
                      <KPIGroup.Separator />
                      <KPI className={KPI_CLASS}>
                        <KPI.Header>
                          <KPI.Icon status="success">
                            <CircleDollar />
                          </KPI.Icon>
                          <KPI.Title>Net paid</KPI.Title>
                        </KPI.Header>
                        <KPI.Content>
                          <KPI.Value value={run.netRwf} {...money} className="tabular" />
                          <Change now={run.netRwf} before={previous?.net ?? null} unit="money" />
                        </KPI.Content>
                      </KPI>
                    </KPIGroup>

                    <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                      <div className="flex flex-col gap-2">
                        <LineDonut
                          gross={run.grossRwf}
                          net={run.netRwf}
                          paye={run.payeRwf}
                          rssb={run.employeeContributionsRwf}
                        />
                        <p className="text-xs text-muted">
                          The business also paid {rwf(run.employerContributionsRwf)} in RSSB.
                        </p>
                      </div>
                      <section
                        className="flex flex-col gap-3 rounded-2xl bg-surface-secondary p-4"
                        aria-label="Sign-off"
                      >
                        <h3 className="text-sm font-semibold">Sign-off</h3>
                        <Timeline size="sm" density="compact">
                          {[
                            { key: "prep", title: `Prepared by ${summary.preparedBy}`, meta: summary.preparedAt },
                            { key: "conf", title: `Confirmed by ${summary.confirmedBy}`, meta: summary.confirmedAt },
                            { key: "slips", title: "Payslips opened to staff", meta: `${run.headcount} payslips` },
                          ].map((e) => (
                            <Timeline.Item key={e.key} status="success">
                              <Timeline.Rail>
                                <Timeline.Marker />
                                <Timeline.Connector />
                              </Timeline.Rail>
                              <Timeline.Content className="flex flex-col pb-1">
                                <span className="text-[13px] leading-[18px] font-medium">{e.title}</span>
                                <span className="text-xs leading-4 text-muted tabular">{e.meta || "—"}</span>
                              </Timeline.Content>
                            </Timeline.Item>
                          ))}
                        </Timeline>
                      </section>
                    </div>

                    {canFiles ? (
                      <ItemCardGroup layout="grid" columns={2} aria-labelledby="files-h">
                        <ItemCardGroup.Header>
                          <ItemCardGroup.Title id="files-h">Files and returns</ItemCardGroup.Title>
                        </ItemCardGroup.Header>
                        {FILES.map((f) => (
                          <ItemCard key={f.kind} className="items-center">
                            <ItemCard.Icon>{f.icon}</ItemCard.Icon>
                            <ItemCard.Content>
                              <ItemCard.Title>{f.label}</ItemCard.Title>
                              <ItemCard.Description>{f.desc}</ItemCard.Description>
                            </ItemCard.Content>
                            <ItemCard.Action>
                              <Button
                                size="sm"
                                variant="ghost"
                                isIconOnly
                                isPending={building}
                                aria-label={`Build the ${f.label.toLowerCase()} of ${summary.period}`}
                                onPress={() => onBuild(f.kind)}
                              >
                                <ArrowDownToLine className="size-4" />
                              </Button>
                            </ItemCard.Action>
                          </ItemCard>
                        ))}
                      </ItemCardGroup>
                    ) : null}

                    <section className="flex flex-col gap-2.5" aria-label="Payslips">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">
                          Payslips <span className="font-normal text-muted">{run.payslips.length}</span>
                        </h3>
                        <SearchField aria-label="Find a person" value={query} onChange={setQuery} className="w-[220px]">
                          <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder="Find a person" />
                            <SearchField.ClearButton />
                          </SearchField.Group>
                        </SearchField>
                      </div>
                      <DataGrid
                        aria-label={`Payslips of ${summary.period}`}
                        data={slips}
                        columns={columns}
                        getRowId={(p) => p.id}
                        defaultSortDescriptor={{ column: "name", direction: "ascending" }}
                        variant="secondary"
                        renderEmptyState={() => <span className="text-sm text-muted">Nobody by that name.</span>}
                        footer={
                          <span className="flex w-full flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted tabular">
                            <span>{slips.length === run.payslips.length ? "All staff" : `${slips.length} shown`}</span>
                            <span>
                              Gross <b className="text-foreground">{rwf(sum("gross"))}</b> · PAYE{" "}
                              <b className="text-foreground">{rwf(sum("paye"))}</b> · RSSB{" "}
                              <b className="text-foreground">{rwf(sum("rssb"))}</b> · Take-home{" "}
                              <b className="text-foreground">{rwf(sum("net"))}</b>
                            </span>
                          </span>
                        }
                      />
                    </section>
                  </>
                )}
              </Drawer.Body>
            </>
          ) : null}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
