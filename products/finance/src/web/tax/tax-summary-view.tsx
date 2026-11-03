"use client";

import { ArrowDownToLine, Link, ShieldExclamation } from "@gravity-ui/icons";
import { Avatar, Button, Card, Chip, Separator, Table } from "@heroui/react";
import { ListView, Segment } from "@heroui-pro/react";
import { GateChip, KeyValueList, LinkButton, PageContent, PageHeader, TextLink, toneColor } from "@injishi/ui";
import { useState } from "react";
import type { FiscalProfile, Levy, VatDeclaration, VatSummary } from "../../model/accounting.ts";
import type { BoardId } from "../../model/shared.ts";
import { CardHeading, MetaList, Note, num, rwf } from "../accounting-parts.tsx";
import { useBoardHref } from "../mount.tsx";
import { type DeclarationStage, TaxDeclarationCard } from "./tax-declaration-card.tsx";

const PERIODS = [
  { id: "sep", label: "September 2026" },
  { id: "oct", label: "October to date" },
] as const;

/** Standard VAT rate of rule TR-VAT v3 (VAT is computed per line here, rounded per receipt at issuance). */
const VAT_RATE = 0.18;

export function TaxSummaryView({
  merchants,
  summaries,
  declarations,
  levies,
  stageOverride,
  initialMerchant,
  initialPeriod,
}: {
  merchants: FiscalProfile[];
  summaries: VatSummary[];
  declarations: VatDeclaration[];
  levies: Levy[];
  stageOverride: DeclarationStage | null;
  initialMerchant: string;
  initialPeriod: "sep" | "oct";
}) {
  const screenHref = useBoardHref();
  const [merchantId, setMerchantId] = useState(initialMerchant);
  const [period, setPeriod] = useState<"sep" | "oct">(initialPeriod);
  const [stages, setStages] = useState<Record<string, DeclarationStage>>({});

  const m = merchants.find((x) => x.id === merchantId) ?? merchants[0];
  const d = summaries.find((s) => s.merchant === m.id && s.period === period) ?? summaries[0];
  const declaration = declarations.find((x) => x.merchant === m.id && x.period === period) ?? null;
  const stage: DeclarationStage = declaration
    ? (stages[declaration.id] ?? stageOverride ?? declaration.stage)
    : "draft";

  const rows = d.rows.map((r) => {
    const vat = Math.round(r.net * VAT_RATE);
    return { ...r, vat, gross: r.net + vat };
  });
  const total = rows.reduce(
    (t, r) => ({ lines: t.lines + r.lines, net: t.net + r.net, vat: t.vat + r.vat, gross: t.gross + r.gross }),
    { lines: 0, net: 0, vat: 0, gross: 0 },
  );

  const steps: {
    n: string;
    color: "success" | "accent" | "default";
    title: string;
    where: string;
    status: string;
    link?: { label: string; board: BoardId };
  }[] = [
    {
      n: "1",
      color: "success",
      title: "Fiscal issuance",
      where: "The VSDC signs each document",
      status: d.fiscalStatus,
      link: { label: "Open fiscal receipts", board: "FiscalReceipts" },
    },
    {
      n: "2",
      color: "accent",
      title: "Tax calculation",
      where: "This page · from issued documents only",
      status: "Rule TR-VAT v3 · awaiting sign-off",
    },
    {
      n: "3",
      color: "default",
      title: "Declaration and filing",
      where: "Outside Injishi · RRA portal",
      status: "Filed by you or your tax agent",
    },
    {
      n: "4",
      color: "default",
      title: "Tax payment",
      where: "Your bank",
      status: "Recorded in the ledger when it clears",
      link: { label: "Open general ledger", board: "GeneralLedger" },
    },
  ];

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${m.name} · ${m.tin} · ${d.periodLabel}`}
        title="Tax Summaries"
        actions={
          <>
            <Segment aria-label="Merchant" selectedKey={m.id} onSelectionChange={(k) => setMerchantId(String(k))}>
              {merchants.map((x) => (
                <Segment.Item key={x.id} id={x.id}>
                  {x.name}
                </Segment.Item>
              ))}
            </Segment>
            <Segment
              aria-label="Period"
              selectedKey={period}
              onSelectionChange={(k) => setPeriod(String(k) === "oct" ? "oct" : "sep")}
            >
              {PERIODS.map((p) => (
                <Segment.Item key={p.id} id={p.id}>
                  {p.label}
                </Segment.Item>
              ))}
            </Segment>
            <Button variant="secondary">
              <ArrowDownToLine className="size-4" aria-hidden="true" />
              Working papers
            </Button>
          </>
        }
      />

      <ol
        aria-label="Where tax work happens"
        className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr))]"
      >
        {steps.map((st) => (
          <li key={st.n} className="flex">
            <Card variant="secondary" className="w-full gap-1 p-3.5">
              <span className="flex items-center gap-2">
                <Avatar size="sm" variant="soft" color={st.color}>
                  <Avatar.Fallback>{st.n}</Avatar.Fallback>
                </Avatar>
                <span className="text-[14px] font-semibold">{st.title}</span>
              </span>
              <span className="text-xs leading-4 text-muted">{st.where}</span>
              <span className="text-[13px]">{st.status}</span>
              {st.link ? (
                <TextLink href={screenHref(st.link.board)} className="text-xs">
                  {st.link.label}
                </TextLink>
              ) : null}
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-start gap-4">
        <section aria-labelledby="sum-h" className="flex min-w-0 flex-[999_1_640px] flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="sum-h" className="text-[15px] leading-[22px] font-semibold">
              Output VAT by Treatment · {d.periodLabel}
            </h2>
            <Chip size="sm" variant="soft" color={toneColor(d.periodTone)}>
              {d.periodState}
            </Chip>
          </div>
          <Table>
            <Table.ScrollContainer>
              <Table.Content className="min-w-[720px]" aria-label={`Output VAT by treatment, ${d.periodLabel}`}>
                <Table.Header>
                  <Table.Column isRowHeader>Sales category</Table.Column>
                  <Table.Column>Treatment and rule</Table.Column>
                  <Table.Column className="text-right">Lines</Table.Column>
                  <Table.Column className="text-right">Net</Table.Column>
                  <Table.Column className="text-right">VAT</Table.Column>
                  <Table.Column className="text-right">Gross</Table.Column>
                  <Table.Column>
                    <span className="sr-only">Provenance</span>
                  </Table.Column>
                </Table.Header>
                <Table.Body>
                  {rows.map((r) => (
                    <Table.Row key={r.category} id={r.category}>
                      <Table.Cell className="font-medium">{r.category}</Table.Cell>
                      <Table.Cell className="text-xs text-muted">{r.rule}</Table.Cell>
                      <Table.Cell className="text-right tabular">{num(r.lines)}</Table.Cell>
                      <Table.Cell className="text-right tabular">{rwf(r.net)}</Table.Cell>
                      <Table.Cell className="text-right tabular">{rwf(r.vat)}</Table.Cell>
                      <Table.Cell className="text-right tabular">{rwf(r.gross)}</Table.Cell>
                      <Table.Cell className="text-right">
                        {r.lines > 0 ? (
                          <LinkButton
                            href={screenHref("FiscalReceipts")}
                            size="sm"
                            variant="ghost"
                            aria-label={`Documents behind ${r.category}`}
                          >
                            Documents
                          </LinkButton>
                        ) : null}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                  <Table.Row id="total">
                    <Table.Cell className="font-semibold">Total output</Table.Cell>
                    <Table.Cell>{""}</Table.Cell>
                    <Table.Cell className="text-right font-semibold tabular">{num(total.lines)}</Table.Cell>
                    <Table.Cell className="text-right font-semibold tabular">{rwf(total.net)}</Table.Cell>
                    <Table.Cell className="text-right font-semibold tabular">{rwf(total.vat)}</Table.Cell>
                    <Table.Cell className="text-right font-semibold tabular">{rwf(total.gross)}</Table.Cell>
                    <Table.Cell>{""}</Table.Cell>
                  </Table.Row>
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <Card variant="secondary" role="region" aria-label="Provenance" className="gap-1.5 px-4 py-3.5">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <Link className="size-4" aria-hidden="true" />
              Provenance
            </span>
            <MetaList
              items={[
                { label: "Fiscal documents", value: <span className="tabular">{d.documents}</span> },
                { label: "Daily reports", value: <span className="tabular">{d.dailyReports}</span> },
                { label: "Computed", value: d.computed },
                { label: "Left out", value: d.excluded },
              ]}
            />
          </Card>
        </section>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <Card role="region" aria-labelledby="pos-h" className="gap-2.5 p-[18px]">
            <h2 id="pos-h" className="text-[15px] leading-[22px] font-semibold">
              VAT Position · Draft
            </h2>
            <div className="flex justify-between gap-3 text-[13px]">
              <span>Output VAT</span>
              <span className="tabular">{rwf(total.vat)}</span>
            </div>
            <div className="flex justify-between gap-3 text-[13px]">
              <span>Input VAT · {num(d.input.invoices)} supplier fiscal invoices</span>
              <span className="whitespace-nowrap tabular">{rwf(-d.input.amount)}</span>
            </div>
            <Separator />
            <div className="flex items-baseline justify-between gap-3 text-[15px] font-semibold">
              <span>Net VAT payable</span>
              <span className="text-lg tabular">{rwf(total.vat - d.input.amount)}</span>
            </div>
            <Note>{d.inputNote}. A draft figure for review, not an assessment.</Note>
          </Card>

          <Card role="region" aria-labelledby="rule-h" className="gap-2.5 p-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="rule-h" className="text-[15px] leading-[22px] font-semibold">
                VAT Rule
              </h2>
              <GateChip icon={<ShieldExclamation className="size-3" aria-hidden="true" />}>
                Awaiting tax specialist sign-off
              </GateChip>
            </div>
            <KeyValueList
              items={[
                { label: "Standard rate", value: <span className="tabular">18%</span> },
                { label: "Rule version", value: <span className="tabular">TR-VAT v3</span> },
                { label: "Effective", value: "From 1 Jul 2026" },
                { label: "Source", value: "RRA public guidance, configured by Grace Uwera on 28 Jun 2026" },
                { label: "Change from v2", value: "VAT rounded per receipt, not per line" },
              ]}
            />
            <Note>
              v2 applied 1 Jan to 30 Jun 2026 and was also never signed off. Summaries show which version produced each
              figure.
            </Note>
          </Card>
        </div>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
        <TaxDeclarationCard
          key={`${m.id}-${period}`}
          periodLabel={d.periodLabel}
          merchant={m}
          declaration={declaration}
          stage={stage}
          onStageChange={(s) => declaration && setStages((o) => ({ ...o, [declaration.id]: s }))}
        />

        <Card role="region" aria-labelledby="lev-h" className="gap-3 p-[18px]">
          <Card.Header>
            <CardHeading id="lev-h">Other Levies</CardHeading>
            <Card.Description>
              Nothing is calculated, printed on receipts or summarised until a rule is verified.
            </Card.Description>
          </Card.Header>
          <ListView aria-label="Other levies" variant="secondary" items={levies}>
            {(l) => (
              <ListView.Item id={l.id} textValue={l.name}>
                <ListView.ItemContent className="items-start">
                  <div className="flex min-w-0 flex-col items-start gap-0.5">
                    <ListView.Title className="whitespace-normal">{l.name}</ListView.Title>
                    <ListView.Description className="whitespace-normal">{l.why}</ListView.Description>
                    <GateChip icon={<ShieldExclamation className="size-3" aria-hidden="true" />} className="mt-1">
                      Needs verification
                    </GateChip>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <Button size="sm" variant="secondary" isDisabled aria-label={`Configure ${l.name} when verified`}>
                    Configure when verified
                  </Button>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
        </Card>
      </div>
    </PageContent>
  );
}
