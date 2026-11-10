"use client";

import type { GovernmentBody, LeaderCoverage } from "@injishi/contracts";
import {
  ActionLink,
  DataTable,
  EmptyBlock,
  formatDay,
  formatNumber,
  IconAction,
  PageContent,
  type PlaceChain,
} from "@injishi/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AreaHeader } from "@/components/shell/WorkspaceNav";
import { AreaFilter, ListUrlProvider, useListUrl } from "../list/list-kit";
import { KpiCards } from "../list/stat-cards";
import { AppointPanel, type AppointPrefill } from "./AppointPanel";
import { chainOf } from "./LeadersView";

type Gap = LeaderCoverage["uncovered"][number];

/**
 * Coverage (P5, 2026-10-30): the posts to fill, as one table: each area with rented homes and nobody in
 * a local leader post, with its homes and the guests waiting there, filtered by post and by whether
 * guests wait; each row opens the appointment form for that post and place. Downloads as CSV.
 */
export function CoverageView(props: {
  coverage: LeaderCoverage;
  canAppoint: boolean;
  areaChain: PlaceChain;
  bodies: readonly GovernmentBody[];
}) {
  return (
    <ListUrlProvider>
      <Coverage {...props} />
    </ListUrlProvider>
  );
}

function Coverage({
  coverage,
  canAppoint,
  areaChain,
  bodies,
}: {
  coverage: LeaderCoverage;
  canAppoint: boolean;
  areaChain: PlaceChain;
  bodies: readonly GovernmentBody[];
}) {
  const url = useListUrl();
  const t = useTranslations("adminLeaders.coverage");
  const tr = useTranslations("admin.roles");
  // A gap opens the one Appoint panel here, with its post and place filled in (2026-11-09).
  const [appointing, setAppointing] = useState<AppointPrefill | null>(null);
  const appoint = (g: Gap) => setAppointing({ role: g.role, chain: chainOf(g) });
  const provinceId = Number(url.get("provinceId")) || null;
  const districtId = Number(url.get("districtId")) || null;
  // The area is read from the rows this page already has: coverage is answered whole.
  const gaps = coverage.uncovered.filter(
    (g) => (!provinceId || g.provinceId === provinceId) && (!districtId || g.districtId === districtId),
  );
  const keyOf = (g: Pick<Gap, "role" | "districtId" | "sectorId" | "cellId" | "villageId">) =>
    `${g.role}-${g.districtId}-${g.sectorId}-${g.cellId}-${g.villageId}`;
  const since = new Map(coverage.waiting.map((w) => [keyOf(w), w.oldestArrival]));
  const posts = [...new Map(coverage.uncovered.map((g) => [g.role, tr(g.role)])).entries()];
  return (
    <PageContent>
      <AreaHeader />
      <KpiCards
        label="How many areas with homes have their leader"
        items={coverage.roles.map((r) => ({
          id: r.role,
          label: r.roleLabel,
          format: "percent" as const,
          value: r.withHomes.areas ? (r.withHomes.covered / r.withHomes.areas) * 100 : 100,
          progress: r.withHomes.areas ? (r.withHomes.covered / r.withHomes.areas) * 100 : 100,
          status: r.withHomes.covered < r.withHomes.areas ? ("warning" as const) : undefined,
          footnote: `${formatNumber(r.withHomes.covered)} of ${formatNumber(r.withHomes.areas)} areas with homes`,
        }))}
      />
      <DataTable<Gap>
        label={t("label")}
        noun={{ one: t("nounOne"), many: t("nounMany") }}
        rows={gaps}
        rowKey={keyOf}
        onRowAction={canAppoint ? appoint : undefined}
        search={{ placeholder: t("search"), text: (g) => g.area }}
        filters={[
          {
            id: "post",
            name: t("post"),
            options: [{ id: "all", label: t("all") }, ...posts.map(([id, label]) => ({ id, label }))],
            match: (g, v) => g.role === v,
          },
          {
            id: "waiting",
            name: t("guests"),
            icon: "PersonPlus",
            options: [
              { id: "all", label: t("all") },
              {
                id: "waiting",
                label: t("guestsWaiting"),
                count: gaps.filter((g) => g.waitingReports > 0).length,
              },
            ],
            match: (g) => g.waitingReports > 0,
          },
        ]}
        toolbarEnd={
          <>
            <AreaFilter chain={areaChain} depth="district" />
            <ActionLink href="/api/admin/leaders/coverage.csv" icon="ArrowDownToLine" size="sm" prefetch={false}>
              {t("export")}
            </ActionLink>
          </>
        }
        empty={<EmptyBlock icon="CircleCheck" title={t("empty")} />}
        columns={[
          {
            id: "area",
            header: t("area"),
            isRowHeader: true,
            sortValue: (g) => g.area,
            cell: (g) => <span className="whitespace-normal">{g.area}</span>,
          },
          { id: "role", header: t("post"), sortValue: (g) => tr(g.role), cell: (g) => tr(g.role) },
          {
            id: "homes",
            header: t("homes"),
            align: "end",
            sortValue: (g) => g.homes,
            cell: (g) => <span className="tabular">{formatNumber(g.homes)}</span>,
          },
          {
            id: "waiting",
            header: t("guestsWaiting"),
            align: "end",
            sortValue: (g) => g.waitingReports,
            cell: (g) =>
              g.waitingReports > 0 ? (
                <span className="font-medium text-warning tabular">{formatNumber(g.waitingReports)}</span>
              ) : (
                <span className="text-muted tabular">0</span>
              ),
          },
          {
            id: "since",
            header: t("waitingSince"),
            hideBelow: "lg",
            sortValue: (g) => since.get(keyOf(g)) ?? "",
            cell: (g) => {
              const at = since.get(keyOf(g));
              return at ? formatDay(at) : <span className="text-muted">-</span>;
            },
          },
        ]}
        rowActions={
          canAppoint
            ? (g) => (
                <IconAction icon="PersonPlus" label={t("appointFor", { area: g.area })} onPress={() => appoint(g)} />
              )
            : undefined
        }
        mobile={{
          title: (g) => g.area,
          description: (g) => `${tr(g.role)} · ${t("homesCount", { count: g.homes })}`,
          trailing: (g) => <span className="text-sm tabular">{t("waitingCount", { count: g.waitingReports })}</span>,
        }}
      />
      {appointing ? <AppointPanel bodies={bodies} prefill={appointing} onClose={() => setAppointing(null)} /> : null}
    </PageContent>
  );
}
