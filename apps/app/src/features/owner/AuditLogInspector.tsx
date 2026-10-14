"use client";

import { ArrowUpRightFromSquare } from "@gravity-ui/icons";
import { Card, Chip, Table } from "@heroui/react";
import { screenHref } from "@injishi/data";
import type { AuditLogArea, AuditLogEntry } from "@injishi/data/fixtures/owner";
import { formatNumber, KeyValueList, LinkButton, toneColor } from "@injishi/ui";

const KV_CLASS = "grid-cols-[92px_minmax(0,1fr)]! text-xs! leading-[18px]!";

/** Right-hand inspector of the selected audit entry: facts, field changes and chain metadata. */
export function AuditLogInspector({ entry, area }: { entry: AuditLogEntry; area: AuditLogArea | undefined }) {
  const href = entry.link.tab ? `${screenHref(entry.link.board)}?tab=${entry.link.tab}` : screenHref(entry.link.board);

  return (
    <section className="min-w-0 flex-[1_1_340px]" aria-labelledby="ins-h">
      <Card className="gap-3 p-[18px]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs text-muted tabular">Entry #{formatNumber(entry.seq)}</span>
            <h2 id="ins-h" className="text-base leading-[22px] font-semibold">
              {entry.action}
            </h2>
          </div>
          {area ? (
            <Chip size="sm" variant="soft" color={toneColor(area.tone)} className="shrink-0">
              {area.label}
            </Chip>
          ) : null}
        </div>

        <KeyValueList
          className={KV_CLASS}
          items={[
            { label: "When", value: `${entry.date} · ${entry.time} CAT` },
            { label: "Actor", value: `${entry.actor} · ${entry.role} at the time` },
            { label: "Record", value: entry.record },
            { label: "Property", value: entry.property },
            { label: "Reason", value: entry.reason || "No reason needed for this action" },
          ]}
        />

        {entry.changes.length > 0 ? (
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label={`Changes made by entry ${formatNumber(entry.seq)}`}>
                <Table.Header>
                  <Table.Column isRowHeader>Field</Table.Column>
                  <Table.Column>Before</Table.Column>
                  <Table.Column>After</Table.Column>
                </Table.Header>
                <Table.Body>
                  {entry.changes.map((c) => (
                    <Table.Row key={c.field} id={c.field}>
                      <Table.Cell className="text-xs whitespace-normal">{c.field}</Table.Cell>
                      <Table.Cell className="text-xs whitespace-normal text-muted">{c.before}</Table.Cell>
                      <Table.Cell className="text-xs font-medium whitespace-normal">{c.after}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        ) : null}

        <KeyValueList
          className={`${KV_CLASS} tabular`}
          items={[
            { label: "Device", value: entry.device },
            { label: "IP address", value: entry.ip },
            { label: "Request ID", value: entry.requestId },
            { label: "Step-up", value: entry.stepUp },
            { label: "Entry hash", value: entry.hash },
            { label: "Previous", value: entry.previousHash },
          ]}
        />

        <LinkButton href={href} size="sm" variant="secondary" className="self-start">
          <ArrowUpRightFromSquare className="size-4" />
          {entry.link.label}
        </LinkButton>
      </Card>
    </section>
  );
}
