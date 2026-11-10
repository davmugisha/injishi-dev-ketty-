"use client";

import { Magnifier } from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Chip, Input, Table } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { PageContent, PageHeader } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("psfConsole.queue");
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
        title={t("title")}
        description={`${t("waitingOn", { count: page.total })}${q ? ` · ${t("matching", { query: q })}` : ""}. ${t("waitingLead")}`}
      />

      {reporting ? (
        <Alert status="accent">
          <Alert.Content>
            <Alert.Title>{t("reporting")}</Alert.Title>
            <Alert.Description>
              {t("reportingLead", { place: scope.label })}
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
          aria-label={t("searchApplications")}
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="secondary">
          <Magnifier className="size-4" /> {t("searchApplications")}
        </Button>
      </form>

      <Card>
        <Card.Content className="p-0">
          {page.items.length ? (
            <Table>
              <Table.ScrollContainer>
                <Table.Content
                  aria-label={t("title")}
                  onRowAction={(key) => router.push(`/psf/${String(key)}`)}
                >
                  <Table.Header>
                    <Table.Column isRowHeader>{t("business")}</Table.Column>
                    <Table.Column>{t("sector")}</Table.Column>
                    {showDistrict ? <Table.Column>{t("district")}</Table.Column> : null}
                    <Table.Column>{t("membership")}</Table.Column>
                    <Table.Column>{t("paid")}</Table.Column>
                    <Table.Column>{t("waiting")}</Table.Column>
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
                                {/* A holder of an old PSF card joining the new module (2026-11-02): no fee, a new number. */}
                                {item.intake === "card_holder" ? (
                                  <Chip size="sm" variant="soft" color="accent">
                                    {t("cardHolder")}
                                  </Chip>
                                ) : null}
                                {item.decidesHere && !item.canDecide ? (
                                  <Chip size="sm" variant="soft" color="warning">
                                    {t("yourBusiness")}
                                  </Chip>
                                ) : null}
                                {item.branchesPending > 0 ? (
                                  <Chip size="sm" variant="soft" color="accent">
                                    {item.headOfficeInScope ? "" : t("branchOnly")}
                                    {t("branchToAdmit", { count: item.branchesPending })}
                                  </Chip>
                                ) : null}
                              </span>
                              <span className="text-[12px] leading-4 text-muted tabular">
                                {[item.docId, item.businessCode].filter(Boolean).join(" · ")} · {t("sent")} {dayMonth(item.queuedAt ?? item.submittedAt)} {t(item.origin === "psf_form" ? "fromPsf" : "fromInjishi")}
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
                          <Table.Cell className="tabular">{item.intake === "card_holder" ? t("noFeeNow") : item.paidRwf ? rwf(item.paidRwf) : "—"}</Table.Cell>
                        <Table.Cell>
                          <Chip size="sm" variant="soft" color={item.waitingDays > 7 ? "danger" : item.waitingDays === 0 ? "success" : "default"}>
                            {item.waitingDays === 0 ? t("newToday") : t("days", { count: item.waitingDays })}
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
                <EmptyState.Title>{q ? t("nothingMatches") : t("nothingWaiting")}</EmptyState.Title>
                <EmptyState.Description>
                  {q ? t("trySearch") : t("emptyQueue")}
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
