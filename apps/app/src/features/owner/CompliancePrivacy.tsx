"use client";

import { ShieldCheck } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Table } from "@heroui/react";
import { screenHref } from "@injishi/data";
import type { ComplianceAccess, ComplianceDataRequest } from "@injishi/data/fixtures/owner";
import { LinkButton, SectionHeader, TextLink, toneColor } from "@injishi/ui";

/** "Guest data and privacy" tab: who read guest data and why, and the data subject requests. */
export function CompliancePrivacy({
  access,
  requests,
  onApprove,
}: {
  access: ComplianceAccess[];
  /** Requests with the owner's decisions of this session already applied. */
  requests: ComplianceDataRequest[];
  onApprove: (id: string) => void;
}) {
  const retentionHref = `${screenHref("AuditLog")}?tab=retention`;

  return (
    <div className="flex flex-wrap items-start gap-4">
      <section className="flex min-w-0 flex-[2_1_620px] flex-col gap-2.5" aria-labelledby="log-h">
        <SectionHeader
          id="log-h"
          title="Guest Data Access Log"
          className="items-center"
          action={
            <LinkButton href={screenHref("AuditLog")} size="sm" variant="ghost">
              Full audit log
            </LinkButton>
          }
        />
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-labelledby="log-h">
              <Table.Header>
                <Table.Column isRowHeader>When</Table.Column>
                <Table.Column>Who</Table.Column>
                <Table.Column>Record</Table.Column>
                <Table.Column>Purpose</Table.Column>
                <Table.Column>Legal basis</Table.Column>
              </Table.Header>
              <Table.Body>
                {access.map((a) => (
                  <Table.Row key={a.id} id={a.id}>
                    <Table.Cell className="text-[13px] whitespace-nowrap tabular">{a.when}</Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col">
                        <span className="font-medium">{a.who}</span>
                        <span className="text-xs text-muted">{a.role}</span>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="max-w-60 text-[13px] whitespace-normal">{a.record}</Table.Cell>
                    <Table.Cell className="max-w-[220px] text-[13px] whitespace-normal">{a.purpose}</Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={toneColor(a.tone)}>
                        {a.basis}
                      </Chip>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        <Alert status="default">
          <Alert.Indicator>
            <ShieldCheck />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>No disclosures to any authority in the last 12 months</Alert.Title>
            <Alert.Description>
              Government officers are never members of your business and cannot open guest records.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      </section>

      <section className="min-w-0 flex-[1_1_340px]" aria-labelledby="dsr-h">
        <Card className="gap-3 p-[18px]">
          <Card.Header>
            <h2 id="dsr-h" className="text-[15px] leading-[22px] font-semibold">
              Data Subject Requests
            </h2>
            <Card.Description>Requests from guests and residents about their personal data</Card.Description>
          </Card.Header>
          {requests.map((d) => (
            <Card key={d.id} variant="secondary" className="gap-1.5 px-[14px] py-3">
              <div className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] font-semibold">
                    {d.who} · {d.kind}
                  </span>
                  <span className="text-xs text-muted tabular">
                    {d.id} · received {d.received}
                  </span>
                </span>
                <Chip size="sm" variant="soft" color={toneColor(d.tone)} className="shrink-0">
                  {d.status}
                </Chip>
              </div>
              <p className="text-xs leading-[17px]">{d.note}</p>
              {d.decision ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onPress={() => onApprove(d.id)}>
                    Approve partial erasure
                  </Button>
                  <LinkButton href={retentionHref} size="sm" variant="ghost">
                    See what is kept
                  </LinkButton>
                </div>
              ) : null}
            </Card>
          ))}
          <p className="text-xs leading-4 text-muted">
            Response target 30 days · configured, unverified. Retention periods are set in the{" "}
            <TextLink href={retentionHref} className="text-xs">
              audit log settings
            </TextLink>
            .
          </p>
        </Card>
      </section>
    </div>
  );
}
