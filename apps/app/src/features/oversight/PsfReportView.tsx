"use client";

import { Card, Table } from "@heroui/react";
import { PageContent, PageHeader } from "@injishi/ui";
import { rwf } from "@/server/format";
import type { PsfReport, PsfScope } from "@/server/sources/psf";

function delta(kpi: { value: number; previous: number }): string {
  const d = kpi.value - kpi.previous;
  if (d === 0) return "Same as prior period";
  return d > 0 ? `+${d} vs prior period` : `${d} vs prior period`;
}

/**
 * The PSF report for the officer's region over a period: KPIs, funnel, and
 * district breakdown (province and national views).
 */
export function PsfReportView({ scope, report }: { scope: PsfScope; report: PsfReport }) {
  const showDistricts = report.districts.length > 0;

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.title} · ${scope.label}`}
        title="Report"
        description={`${report.regionLabel}: ${report.from} to ${report.to}. Membership activity and fees.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Registered", String(report.kpis.registered.value), delta(report.kpis.registered)],
            ["Applied", String(report.kpis.applied.value), delta(report.kpis.applied)],
            ["Approved", String(report.kpis.approved.value), delta(report.kpis.approved)],
            ["Membership fees", rwf(report.kpis.membershipFeesRwf.value), delta(report.kpis.membershipFeesRwf)],
          ] as const
        ).map(([label, value, note]) => (
          <Card key={label}>
            <Card.Content className="gap-1">
              <div className="text-muted text-sm">{label}</div>
              <div className="text-lg font-semibold tabular-nums">{value}</div>
              <div className="text-muted text-xs">{note}</div>
            </Card.Content>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <Card.Header>
            <Card.Title>Right now</Card.Title>
          </Card.Header>
          <Card.Content className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted">Members</div>
              <div className="text-lg font-semibold">{report.now.members}</div>
            </div>
            <div>
              <div className="text-muted">Waiting</div>
              <div className="text-lg font-semibold">{report.now.waiting}</div>
            </div>
            <div>
              <div className="text-muted">Overdue</div>
              <div className="text-lg font-semibold">{report.now.overdue}</div>
            </div>
            <div>
              <div className="text-muted">Expiring in 30 days</div>
              <div className="text-lg font-semibold">{report.now.expiringIn30Days}</div>
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title>Funnel in period</Card.Title>
          </Card.Header>
          <Card.Content className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted">Registered</div>
              <div className="text-lg font-semibold">{report.funnel.registered}</div>
            </div>
            <div>
              <div className="text-muted">Approved</div>
              <div className="text-lg font-semibold">{report.funnel.approved}</div>
            </div>
            <div>
              <div className="text-muted">Paid</div>
              <div className="text-lg font-semibold">{report.funnel.paid}</div>
            </div>
            <div>
              <div className="text-muted">Declined</div>
              <div className="text-lg font-semibold">{report.funnel.declined}</div>
            </div>
          </Card.Content>
        </Card>
      </div>

      {report.bySector.length > 0 ? (
        <Card>
          <Card.Header>
            <Card.Title>By sector</Card.Title>
          </Card.Header>
          <Card.Content className="p-0">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="By sector">
                  <Table.Header>
                    <Table.Column isRowHeader>Sector</Table.Column>
                    <Table.Column>Count</Table.Column>
                    <Table.Column>Fees</Table.Column>
                  </Table.Header>
                  <Table.Body items={report.bySector}>
                    {(row) => (
                      <Table.Row key={row.key} id={row.key}>
                        <Table.Cell>{row.label}</Table.Cell>
                        <Table.Cell>{row.count}</Table.Cell>
                        <Table.Cell>{rwf(row.amountRwf)}</Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card.Content>
        </Card>
      ) : null}

      {showDistricts ? (
        <Card>
          <Card.Header>
            <Card.Title>By district</Card.Title>
          </Card.Header>
          <Card.Content className="p-0">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="By district">
                  <Table.Header>
                    <Table.Column isRowHeader>District</Table.Column>
                    <Table.Column>Waiting</Table.Column>
                    <Table.Column>Overdue</Table.Column>
                    <Table.Column>Members</Table.Column>
                    <Table.Column>Fees</Table.Column>
                    <Table.Column>Median days</Table.Column>
                  </Table.Header>
                  <Table.Body items={report.districts}>
                    {(row) => (
                      <Table.Row key={String(row.districtId)} id={String(row.districtId)}>
                        <Table.Cell>
                          {row.name}
                          <span className="text-muted text-sm"> · {row.provinceName}</span>
                        </Table.Cell>
                        <Table.Cell>{row.waiting}</Table.Cell>
                        <Table.Cell>{row.overdue}</Table.Cell>
                        <Table.Cell>{row.members}</Table.Cell>
                        <Table.Cell>{rwf(row.membershipFeesRwf)}</Table.Cell>
                        <Table.Cell>{row.medianDecisionDays ?? "—"}</Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card.Content>
        </Card>
      ) : null}
    </PageContent>
  );
}
