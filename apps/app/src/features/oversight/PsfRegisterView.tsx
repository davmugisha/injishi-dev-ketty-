"use client";

import { Magnifier } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Input, Table } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { PageContent, PageHeader } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { rwf } from "@/server/format";
import {
  PSF_STANDING_LABEL,
  type PsfBusinessesPage,
  type PsfRegisterSummary,
  type PsfScope,
  type PsfStanding,
} from "@/server/sources/psf";

const STANDINGS: { id: "" | PsfStanding; label: string }[] = [
  { id: "", label: "All" },
  { id: "waiting", label: "Waiting" },
  { id: "member", label: "Members" },
  { id: "lapsed", label: "Lapsed" },
  { id: "declined", label: "Declined" },
];

/**
 * The PSF business register on live data: every business in the officer's region,
 * with a summary of membership standing. Opens a waiting application when one is open.
 */
export function PsfRegisterView({
  scope,
  summary,
  page,
  q,
  standing,
}: {
  scope: PsfScope;
  summary: PsfRegisterSummary;
  page: PsfBusinessesPage;
  q: string;
  standing: PsfStanding | "";
}) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const showDistrict = scope.level !== "district";

  const go = (nextQ: string, nextStanding: PsfStanding | "") => {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextStanding) params.set("standing", nextStanding);
    const qs = params.toString();
    router.push(qs ? `/psf/register?${qs}` : "/psf/register");
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.title} · ${scope.label}`}
        title="Business register"
        description={`${summary.total} businesses in ${summary.regionLabel}. Membership standing and open applications.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Businesses", String(summary.total)],
            ["Members", String(summary.members)],
            ["Waiting on PSF", String(summary.waiting)],
            ["Fees paid this year", rwf(summary.paidThisYearRwf)],
          ] as const
        ).map(([label, value]) => (
          <Card key={label}>
            <Card.Content className="gap-1">
              <div className="text-muted text-sm">{label}</div>
              <div className="text-lg font-semibold tabular-nums">{value}</div>
            </Card.Content>
          </Card>
        ))}
      </div>

      {scope.level !== "district" ? (
        <Alert status="accent">
          <Alert.Content>
            <Alert.Title>For reporting</Alert.Title>
            <Alert.Description>
              Membership decisions stay with each district&apos;s PSF District Manager. You see every business in{" "}
              {scope.label}.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <form
        className="flex max-w-xl flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go(search, standing);
        }}
      >
        <Input
          aria-label="Search businesses"
          placeholder="Search a business or code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[16rem] flex-1"
        />
        <Button type="submit" variant="secondary">
          <Magnifier className="size-4" /> Search
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {STANDINGS.map((s) => (
          <Button
            key={s.id || "all"}
            size="sm"
            variant={standing === s.id ? "primary" : "secondary"}
            onPress={() => go(search, s.id)}
          >
            {s.label}
          </Button>
        ))}
      </div>

      <Card>
        <Card.Content className="p-0">
          {page.items.length ? (
            <Table>
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="PSF business register"
                  onRowAction={(key) => {
                    const row = page.items.find((b) => b.orgId === String(key));
                    if (row?.openApplicationId) router.push(`/psf/${row.openApplicationId}`);
                  }}
                >
                  <Table.Header>
                    <Table.Column isRowHeader>Business</Table.Column>
                    <Table.Column>Sector</Table.Column>
                    {showDistrict ? <Table.Column>District</Table.Column> : null}
                    <Table.Column>Standing</Table.Column>
                    <Table.Column>Tier</Table.Column>
                    <Table.Column>Paid</Table.Column>
                  </Table.Header>
                  <Table.Body items={page.items}>
                    {(row) => (
                      <Table.Row key={row.orgId} id={row.orgId}>
                        <Table.Cell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{row.legalName}</span>
                            <span className="text-muted text-sm">
                              {row.businessCode ?? "No code yet"}
                              {row.branchCount > 0 ? ` · +${row.branchCount} branches` : ""}
                              {!row.headOfficeInScope ? " · Branch in region" : ""}
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          {[row.clusterName, row.subsectorName, row.associationName].filter(Boolean).join(" · ") || "—"}
                        </Table.Cell>
                        {showDistrict ? <Table.Cell>{row.districtName ?? "—"}</Table.Cell> : null}
                        <Table.Cell>
                          <Chip size="sm" variant="soft">
                            {PSF_STANDING_LABEL[row.standing]}
                          </Chip>
                        </Table.Cell>
                        <Table.Cell>{row.tierName ?? "—"}</Table.Cell>
                        <Table.Cell>{rwf(row.paidRwf)}</Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : (
            <EmptyState className="py-12">
              <EmptyState.Header>
                <EmptyState.Title>No businesses match</EmptyState.Title>
                <EmptyState.Description>
                  {q || standing ? "Try clearing the search or standing filter." : "None in this region yet."}
                </EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          )}
        </Card.Content>
      </Card>
    </PageContent>
  );
}
