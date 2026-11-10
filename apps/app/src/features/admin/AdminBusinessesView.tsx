"use client";

import { ArrowDownToLine, Eye } from "@gravity-ui/icons";
import { Avatar, Button, Card, SearchField, Table, Tabs } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  Business,
  Entitlement,
  KybDocumentType,
  LifecycleCount,
  LifecycleStage,
  Tone,
  ViewAsSession,
} from "@injishi/data/fixtures/admin";
import { LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { type Key, useState } from "react";
import { useTranslations } from "next-intl";
import { EntitlementsPane, KybPane, LifecyclePane } from "./BusinessPanes";
import { initials, lineTab, selectableRow, TabCount, ToneChip } from "./shared";
import { type AccessMode, ViewAsDialog } from "./ViewAsDialog";

interface AdminBusinessesData {
  businesses: Business[];
  counts: LifecycleCount[];
  documentTypes: KybDocumentType[];
  entitlements: Entitlement[];
  sessions: ViewAsSession[];
}

const STAGE: Record<LifecycleStage, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "default" },
  review: { label: "In review", tone: "accent" },
  active: { label: "Active", tone: "success" },
  suspended: { label: "Suspended", tone: "danger" },
};

const PANES = [
  { id: "kyb", label: "KYB" },
  { id: "ent", label: "Entitlements" },
  { id: "life", label: "Lifecycle" },
] as const;

type Pane = (typeof PANES)[number]["id"];

function firstKey(keys: "all" | Set<Key>): string | null {
  if (keys === "all") return null;
  const [k] = [...keys];
  return k === undefined ? null : String(k);
}

const normalizeTin = (s: string) => s.replace(/\s+/g, "");

/** CSV of the businesses currently listed (the "Export list" action). */
function exportCsv(rows: Business[]) {
  const head = ["Business", "Kind", "Lifecycle", "KYB", "Plan", "In stage", "TIN", "Owner"];
  const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    head,
    ...rows.map((b) => [b.name, b.kind, STAGE[b.stage].label, b.kyb, b.plan, b.age, b.tin, b.owner]),
  ];
  const blob = new Blob([lines.map((l) => l.map(quote).join(",")).join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "injishi-businesses.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminBusinessesView({ persona, data }: { persona: Persona; data: AdminBusinessesData }) {
  const t = useTranslations("adminBusinesses");
  const [life, setLife] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(data.businesses[0]?.id ?? "");
  const [pane, setPane] = useState<Pane>("kyb");
  const [dialogOpen, setDialogOpen] = useState(true);
  const [limit, setLimit] = useState(30);
  const [mode, setMode] = useState<AccessMode>("read");
  const [started, setStarted] = useState(false);
  const [checked, setChecked] = useState<Record<string, Record<string, boolean>>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [approver, setApprover] = useState("alain");
  const [requested, setRequested] = useState<Record<string, boolean>>({});

  const total = (id: string) => data.counts.find((c) => c.id === id)?.count ?? 0;
  const q = query.trim().toLowerCase();
  const shown = data.businesses.filter(
    (b) =>
      (life === "all" || b.stage === life) &&
      (!q ||
        b.name.toLowerCase().includes(q) ||
        b.owner.toLowerCase().includes(q) ||
        normalizeTin(b.tin).includes(normalizeTin(q))),
  );
  const b = data.businesses.find((x) => x.id === sel) ?? data.businesses[0];
  const stage = STAGE[b.stage];

  return (
    <PageContent>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        actions={
          <>
            <SearchField aria-label={t("search")} value={query} onChange={setQuery} className="w-[240px]">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={t("searchPlaceholder")} />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <Button variant="secondary" onPress={() => exportCsv(shown)}>
              <ArrowDownToLine className="size-4" />
              {t("export")}
            </Button>
          </>
        }
      />

      <Tabs variant="secondary" selectedKey={life} onSelectionChange={(k) => setLife(String(k))}>
        <Tabs.ListContainer>
          <Tabs.List aria-label={t("lifecycle")}>
            {data.counts.map((c) => (
              <Tabs.Tab key={c.id} id={c.id} className={lineTab}>
                {c.label}
                <TabCount>{c.count}</TabCount>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {data.counts.map((c) => (
          <Tabs.Panel key={c.id} id={c.id} className="pt-5">
            <div className="flex flex-wrap items-start gap-4">
              <section className="flex min-w-0 flex-[999_1_480px] flex-col gap-2" aria-label="Businesses">
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content
                      aria-label={t("title")}
                      selectionMode="single"
                      selectionBehavior="replace"
                      disallowEmptySelection
                      selectedKeys={new Set([sel])}
                      onSelectionChange={(keys) => {
                        const k = firstKey(keys as "all" | Set<Key>);
                        if (k) {
                          setSel(k);
                          setStarted(false);
                        }
                      }}
                    >
                      <Table.Header>
                        <Table.Column isRowHeader>{t("business")}</Table.Column>
                        <Table.Column>{t("lifecycle")}</Table.Column>
                        <Table.Column>{t("kyb")}</Table.Column>
                        <Table.Column>{t("plan")}</Table.Column>
                        <Table.Column>{t("inStage")}</Table.Column>
                      </Table.Header>
                      <Table.Body
                        renderEmptyState={() => (
                          <p className="px-3 py-6 text-center text-[13px] text-muted">
                            {t("noMatch", { query: query.trim() })}
                          </p>
                        )}
                      >
                        {shown.map((r) => (
                          <Table.Row key={r.id} id={r.id} className={selectableRow}>
                            <Table.Cell>
                              <span className="flex items-center gap-2.5">
                                <Avatar size="sm" variant="soft" color="accent">
                                  <Avatar.Fallback>{initials(r.name)}</Avatar.Fallback>
                                </Avatar>
                                <span className="flex min-w-0 flex-col">
                                  <span className="font-medium">{r.name}</span>
                                  <span className="text-xs leading-4 text-muted">{r.kind}</span>
                                </span>
                              </span>
                            </Table.Cell>
                            <Table.Cell>
                              <ToneChip tone={STAGE[r.stage].tone}>{STAGE[r.stage].label}</ToneChip>
                            </Table.Cell>
                            <Table.Cell className="text-[13px]">{r.kyb}</Table.Cell>
                            <Table.Cell className="text-[13px]">{r.plan}</Table.Cell>
                            <Table.Cell className="text-[13px] whitespace-nowrap tabular">{r.age}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
                <p className="text-xs text-muted">
                  {t("showing", { shown: shown.length, total: total(life) })}
                </p>
              </section>

              <Card
                className="min-w-0 flex-[1_1_400px] gap-[14px] p-[18px]"
                aria-labelledby="biz-h"
                render={(p) => <section {...p} />}
              >
                <div className="flex items-start gap-3">
                  <Avatar variant="soft" color="accent">
                    <Avatar.Fallback>{initials(b.name)}</Avatar.Fallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <h2 id="biz-h" className="text-[17px] leading-6 font-semibold">
                      {b.name}
                    </h2>
                    <span className="text-xs leading-4 text-muted tabular">
                      {b.entity} · TIN {b.tin}
                    </span>
                    <span className="text-xs leading-4 text-muted">
                    {t("owner")} {b.owner} · {b.kind}
                    </span>
                  </div>
                  <ToneChip tone={stage.tone}>{stage.label}</ToneChip>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      setStarted(false);
                      setDialogOpen(true);
                    }}
                  >
                    <Eye className="size-4" />
                    {t("viewAs")}
                  </Button>
                  <LinkButton href={screenHref("AdminSupport")} size="sm" variant="ghost">
                    {t("tickets")}
                  </LinkButton>
                  <LinkButton href={screenHref("AdminAudit")} size="sm" variant="ghost">
                    {t("audit")}
                  </LinkButton>
                </div>
                <Segment
                  aria-label={t("detail")}
                  className="w-full"
                  selectedKey={pane}
                  onSelectionChange={(k) => setPane(k as Pane)}
                >
                  {PANES.map((p) => (
                    <Segment.Item key={p.id} id={p.id} className="flex-1">
                      {p.id === "kyb" ? t("tabs.documents") : p.id === "ent" ? t("tabs.entitlements") : t("tabs.lifecycle")}
                    </Segment.Item>
                  ))}
                </Segment>

                {pane === "kyb" ? (
                  <KybPane
                    business={b}
                    types={data.documentTypes}
                    checked={checked[b.id] ?? {}}
                    sent={!!sent[b.id]}
                    changesRequested={!!changes[b.id]}
                    onCheck={(docType) =>
                      setChecked((c) => ({ ...c, [b.id]: { ...(c[b.id] ?? {}), [docType]: true } }))
                    }
                    onSend={() => setSent((s) => ({ ...s, [b.id]: true }))}
                    onRequestChanges={() => setChanges((s) => ({ ...s, [b.id]: true }))}
                  />
                ) : null}
                {pane === "ent" ? <EntitlementsPane business={b} entitlements={data.entitlements} /> : null}
                {pane === "life" ? (
                  <LifecyclePane
                    business={b}
                    reason={reasons[b.id]}
                    approver={approver}
                    requested={!!requested[b.id]}
                    onReason={(r) => setReasons((s) => ({ ...s, [b.id]: r }))}
                    onApprover={setApprover}
                    onRequest={() => setRequested((s) => ({ ...s, [b.id]: true }))}
                  />
                ) : null}
              </Card>
            </div>
          </Tabs.Panel>
        ))}
      </Tabs>

      <ViewAsDialog
        key={b.id}
        business={b}
        staffName={persona.name}
        sessions={data.sessions.filter((v) => v.businessId === b.id)}
        isOpen={dialogOpen}
        limit={limit}
        mode={mode}
        started={started}
        onLimit={setLimit}
        onMode={setMode}
        onStart={() => setStarted(true)}
        onClose={() => {
          setDialogOpen(false);
          setStarted(false);
        }}
      />
    </PageContent>
  );
}
