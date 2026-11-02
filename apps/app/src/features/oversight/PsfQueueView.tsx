"use client";

import { Magnifier } from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Chip, Input, Table } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { PageContent, PageHeader } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { dayMonth, rwf } from "@/server/format";
import type { PsfQueuePage, PsfScope } from "@/server/sources/psf";

/**
 * The PSF queue on live data (ported from the old operator console, 2026-10-26): every paid
 * application waiting on PSF in the officer's region, newest first. A District Manager decides the
 * ones in their district; a province or national manager reads them for reporting. A business
 * whose head office is elsewhere is here because a branch is in the district.
 */
export function PsfQueueView({ scope, page, q }: { scope: PsfScope; page: PsfQueuePage; q: string }) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const reporting = scope.level !== "district";
  const showDistrict = scope.level !== "district";

  const submit = () => {
    const next = search.trim();
    router.push(next ? `/psf?q=${encodeURIComponent(next)}` : "/psf");
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${scope.title} · ${scope.label}`}
        title="Membership applications"
        description={`${page.total} waiting on PSF${q ? ` matching “${q}”` : ""}. Businesses asking to join PSF: each paid when it applied, and waits for your decision.`}
      />

      {reporting ? (
        <Alert status="accent">
          <Alert.Content>
            <Alert.Title>For reporting</Alert.Title>
            <Alert.Description>
              Each application is approved or declined by the PSF District Manager of its district. You see every one in{" "}
              {scope.label}.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <form
        className="flex max-w-xl items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          aria-label="Search applications"
          placeholder="Search a business, code or docID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="secondary">
          <Magnifier className="size-4" /> Search
        </Button>
      </form>

      <Card>
        <Card.Content className="p-0">
          {page.items.length ? (
            <Table>
              <Table.ScrollContainer>
                <Table.Content
                  aria-label="Applications waiting on PSF"
                  onRowAction={(key) => router.push(`/psf/${String(key)}`)}
                >
                  <Table.Header>
                    <Table.Column isRowHeader>Business</Table.Column>
                    <Table.Column>Sector</Table.Column>
                    {showDistrict ? <Table.Column>District</Table.Column> : null}
                    <Table.Column>Membership</Table.Column>
                    <Table.Column>Paid</Table.Column>
                    <Table.Column>Waiting</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {page.items.map((item) => (
                      <Table.Row key={item.applicationId} id={item.applicationId} textValue={item.businessName} className="cursor-pointer">
                        <Table.Cell>
                          <span className="flex items-center gap-2.5">
                            <Avatar size="sm" variant="soft" color="accent" className="shrink-0">
                              <Avatar.Fallback>{initials(item.businessName)}</Avatar.Fallback>
                            </Avatar>
                            <span className="flex min-w-0 flex-col gap-0.5">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <span className="font-medium">{item.businessName}</span>
                                {item.decidesHere && !item.canDecide ? (
                                  <Chip size="sm" variant="soft" color="warning">
                                    Your business
                                  </Chip>
                                ) : null}
                                {item.branchesPending > 0 ? (
                                  <Chip size="sm" variant="soft" color="accent">
                                    {item.headOfficeInScope ? "" : "Branch only · "}
                                    {item.branchesPending === 1 ? "1 branch to admit" : `${item.branchesPending} branches to admit`}
                                  </Chip>
                                ) : null}
                              </span>
                              <span className="text-[12px] leading-4 text-muted tabular">
                                {[item.docId, item.businessCode].filter(Boolean).join(" · ")} · sent {dayMonth(item.queuedAt ?? item.submittedAt)} from{" "}
                                {item.origin === "psf_form" ? "the PSF form" : "Injishi registration"}
                              </span>
                            </span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-col">
                            <span>{item.clusterName ?? "—"}</span>
                            <span className="text-[12px] leading-4 text-muted">{item.subsectorName ?? item.associationName ?? ""}</span>
                          </span>
                        </Table.Cell>
                        {showDistrict ? <Table.Cell>{item.districtName ?? "—"}</Table.Cell> : null}
                        <Table.Cell>{item.requestedTierName}</Table.Cell>
                        <Table.Cell className="tabular">{item.paidRwf ? rwf(item.paidRwf) : "—"}</Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft" color={item.waitingDays > 7 ? "danger" : item.waitingDays === 0 ? "success" : "default"}>
                            {item.waitingDays === 0 ? "New today" : `${item.waitingDays} day${item.waitingDays === 1 ? "" : "s"}`}
                          </Chip>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          ) : (
            <EmptyState className="py-12">
              <EmptyState.Header>
                <EmptyState.Title>{q ? "Nothing matches that search" : "Nothing waiting on PSF"}</EmptyState.Title>
                <EmptyState.Description>
                  {q ? "Try a business name, its code like KIC0001, or its docID." : "Paid applications in your region appear here as they arrive."}
                </EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          )}
        </Card.Content>
      </Card>
    </PageContent>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
