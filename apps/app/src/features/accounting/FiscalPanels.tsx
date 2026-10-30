"use client";

import { ArrowUturnCcwLeft, Briefcase, FileCheck, FileText, Link, Lock, Printer, QrCode } from "@gravity-ui/icons";
import { Button, Card, Chip, Separator, Table } from "@heroui/react";
import { ListView } from "@heroui-pro/react";
import type {
  FiscalDocumentKind,
  FiscalInvoice,
  FiscalJournalEvent,
  FiscalProfile,
  FiscalReceipt,
  VsdcDevice,
  ZReport,
} from "@injishi/product-finance";
import { useBoardHref } from "@injishi/product-finance/web";
import { Icon, LinkButton, toneColor } from "@injishi/ui";
import type { ComponentType, SVGProps } from "react";
import { FISCAL_STATUS } from "./fiscal";
import { CardHeading, firstKey, Note, num, rwf } from "./shared";

const INVOICE_KIND: Record<FiscalInvoice["kind"], { label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  proforma: { label: "Proforma", icon: FileText },
  fiscal: { label: "Fiscal sale invoice", icon: FileCheck },
  commercial: { label: "Commercial invoice", icon: Briefcase },
};

/** Invoices tab: the four kinds of document and which of them reach the VSDC. */
export function FiscalInvoicesPanel({
  kinds,
  invoices,
  note,
}: {
  kinds: FiscalDocumentKind[];
  invoices: FiscalInvoice[];
  note: string;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
        {kinds.map((k) => (
          <Card key={k.id} variant="secondary" className="gap-1.5 p-3.5">
            <div className="flex items-center gap-2">
              <Icon name={k.icon} />
              <span className="text-[14px] font-semibold">{k.title}</span>
            </div>
            <Chip size="sm" variant="soft" color={toneColor(k.tone)} className="self-start">
              {k.chip}
            </Chip>
            <p className="text-xs leading-4 text-muted">{k.description}</p>
          </Card>
        ))}
      </div>
      <Table>
        <Table.ScrollContainer>
          <Table.Content className="min-w-[760px]" aria-label="Invoices and their fiscal status">
            <Table.Header>
              <Table.Column isRowHeader>Document</Table.Column>
              <Table.Column>Kind</Table.Column>
              <Table.Column>Source</Table.Column>
              <Table.Column>Created</Table.Column>
              <Table.Column className="text-right">Amount</Table.Column>
              <Table.Column>Fiscal status</Table.Column>
            </Table.Header>
            <Table.Body>
              {invoices.map((v) => {
                const kind = INVOICE_KIND[v.kind];
                const KindIcon = kind.icon;
                const st = FISCAL_STATUS[v.status];
                return (
                  <Table.Row key={v.id} id={v.id}>
                    <Table.Cell className="font-medium tabular">{v.id}</Table.Cell>
                    <Table.Cell>
                      <span className="flex items-center gap-1.5">
                        <KindIcon className="size-4 text-muted" aria-hidden="true" />
                        {kind.label}
                      </span>
                    </Table.Cell>
                    <Table.Cell>{v.source}</Table.Cell>
                    <Table.Cell className="text-xs text-muted">{v.created}</Table.Cell>
                    <Table.Cell className="text-right tabular">{rwf(v.amount)}</Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col gap-0.5">
                        <Chip size="sm" variant="soft" color={toneColor(st.tone)} className="self-start">
                          {st.label}
                        </Chip>
                        {v.reference ? <span className="text-xs text-muted tabular">{v.reference}</span> : null}
                      </span>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <Note>{note}</Note>
    </div>
  );
}

/** Receipts tab: issued fiscal receipts and a print preview of the selected one. */
export function FiscalReceiptsPanel({
  receipts,
  selected,
  onSelect,
  profile,
  copied,
  onCopy,
}: {
  receipts: FiscalReceipt[];
  selected: FiscalReceipt;
  onSelect: (id: string) => void;
  profile: FiscalProfile;
  copied: boolean;
  onCopy: () => void;
}) {
  const screenHref = useBoardHref();
  const rc = selected;
  const isRefund = rc.kind === "refund";
  const kindColor = (r: FiscalReceipt) => (r.kind === "refund" ? "warning" : "default");
  return (
    <div className="flex flex-wrap items-start gap-4">
      <Table className="min-w-0 flex-[999_1_520px]">
        <Table.ScrollContainer>
          <Table.Content
            className="min-w-[560px]"
            aria-label="Issued fiscal receipts"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([rc.id])}
            onSelectionChange={(keys) => {
              const id = firstKey(keys);
              if (id) onSelect(id);
            }}
          >
            <Table.Header>
              <Table.Column isRowHeader>Fiscal number</Table.Column>
              <Table.Column>Type</Table.Column>
              <Table.Column>Source</Table.Column>
              <Table.Column>Signed</Table.Column>
              <Table.Column className="text-right">Total</Table.Column>
            </Table.Header>
            <Table.Body>
              {receipts.map((c) => (
                <Table.Row key={c.id} id={c.id} className="cursor-pointer">
                  <Table.Cell className="font-medium tabular">{c.id}</Table.Cell>
                  <Table.Cell>
                    <Chip size="sm" variant="soft" color={kindColor(c)}>
                      {c.kind === "refund" ? "Refund receipt" : "Sale receipt"}
                    </Chip>
                  </Table.Cell>
                  <Table.Cell>{c.customer}</Table.Cell>
                  <Table.Cell className="text-xs text-muted tabular">{c.signedAt}</Table.Cell>
                  <Table.Cell className="text-right tabular">{rwf(c.total)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <Card role="region" aria-labelledby="rc-h" className="min-w-0 flex-[1_1_340px] gap-3 p-[18px]">
        <div className="flex items-center justify-between gap-3">
          <h2 id="rc-h" className="text-[15px] leading-[22px] font-semibold tabular">
            {rc.id}
          </h2>
          <Chip size="sm" variant="soft" color="success">
            Issued
          </Chip>
        </div>
        <Card variant="secondary" className="gap-2 p-4 text-[13px] leading-5">
          <div className="flex flex-col items-center gap-0.5 text-center">
            <span className="text-[14px] font-semibold">{profile.name}</span>
            <span className="text-xs text-muted tabular">
              {profile.tin} · {profile.branch}
            </span>
            <Chip size="sm" variant="soft" color={kindColor(rc)} className="mt-1">
              {isRefund ? "Refund receipt · credit note" : "Fiscal sale receipt"}
            </Chip>
          </div>
          <Separator variant="tertiary" />
          {rc.lines.map((l) => (
            <div key={l.description} className="flex justify-between gap-3">
              <span>{l.description}</span>
              <span className="tabular">{rwf(l.amount)}</span>
            </div>
          ))}
          <Separator variant="tertiary" />
          <div className="flex justify-between gap-3 font-semibold">
            <span>Total, VAT included</span>
            <span className="tabular">{rwf(rc.total)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">of which VAT 18% · rule v3</span>
            <span className="tabular">{rwf(rc.vat)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted">Net</span>
            <span className="tabular">{rwf(rc.net)}</span>
          </div>
          <Separator variant="tertiary" />
          <div className="flex items-start gap-3">
            <div
              role="img"
              aria-label={`QR code for ${rc.id}`}
              className="flex size-[84px] flex-none items-center justify-center rounded-[10px] bg-surface"
            >
              <QrCode className="size-10" aria-hidden="true" />
            </div>
            <dl className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] gap-x-2.5 gap-y-0.5 text-xs leading-[18px]">
              <dt className="text-muted">Counter</dt>
              <dd className="font-medium tabular">{rc.counter}</dd>
              <dt className="text-muted">Device</dt>
              <dd className="font-medium tabular">{profile.device}</dd>
              <dt className="text-muted">Signature</dt>
              <dd className="font-medium tabular">{rc.signature}</dd>
              <dt className="text-muted">Signed</dt>
              <dd className="font-medium tabular">{rc.signedAt}</dd>
            </dl>
          </div>
        </Card>
        {rc.reference ? (
          <p className="text-[13px] leading-5">
            <Link className="mr-1 inline size-3.5 align-[-2px] text-muted" aria-hidden="true" />
            {rc.reference}
          </p>
        ) : null}
        <Note>{rc.payment}</Note>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onPress={onCopy}>
            <Printer className="size-4" aria-hidden="true" />
            Reprint as copy
          </Button>
          <Button size="sm" variant="secondary" isDisabled={isRefund}>
            <ArrowUturnCcwLeft className="size-4" aria-hidden="true" />
            Issue refund receipt
          </Button>
          <LinkButton href={screenHref(rc.board)} size="sm" variant="ghost">
            Open source
          </LinkButton>
        </div>
        <Note>
          {copied
            ? "Copy printed 10:13, marked COPY, copy counter advanced. The original is unchanged."
            : "Issued receipts cannot be edited. To correct one, issue a refund receipt that references it."}
        </Note>
      </Card>
    </div>
  );
}

/** Numbering tab: counters per VSDC device and the daily sequence check. */
export function FiscalNumberingPanel({ devices, profile }: { devices: VsdcDevice[]; profile: FiscalProfile }) {
  return (
    <div className="flex flex-col gap-3">
      <Table>
        <Table.ScrollContainer>
          <Table.Content className="min-w-[820px]" aria-label="Fiscal counters by VSDC device">
            <Table.Header>
              <Table.Column isRowHeader>VSDC device</Table.Column>
              <Table.Column>Used by</Table.Column>
              <Table.Column className="text-right">Sale</Table.Column>
              <Table.Column className="text-right">Refund</Table.Column>
              <Table.Column className="text-right">Copy</Table.Column>
              <Table.Column className="text-right">Device total</Table.Column>
              <Table.Column>Last signed</Table.Column>
              <Table.Column>Sequence check</Table.Column>
            </Table.Header>
            <Table.Body>
              {devices.map((n) => (
                <Table.Row key={n.id} id={n.id}>
                  <Table.Cell className="font-medium tabular">{n.id}</Table.Cell>
                  <Table.Cell>{n.usedBy}</Table.Cell>
                  <Table.Cell className="text-right tabular">{num(n.sale)}</Table.Cell>
                  <Table.Cell className="text-right tabular">{num(n.refund)}</Table.Cell>
                  <Table.Cell className="text-right tabular">{num(n.copy)}</Table.Cell>
                  <Table.Cell className="text-right font-medium tabular">{num(n.total)}</Table.Cell>
                  <Table.Cell className="text-muted tabular">{n.lastSigned}</Table.Cell>
                  <Table.Cell>
                    <Chip size="sm" variant="soft" color="success">
                      No gaps · 06:00
                    </Chip>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <p className="text-[13px] leading-5 text-muted">
        {profile.numberingNote} Counters belong to {profile.name} only; {profile.other} keeps its own. Pending and
        Unknown documents take no number until signed, and proformas never take a fiscal counter, so failed attempts
        leave no gaps.
      </p>
    </div>
  );
}

/** Journal tab: the VSDC electronic journal for today and the X / Z reports. */
export function FiscalJournalPanel({
  events,
  zReports,
  profile,
  xRun,
  onRunX,
}: {
  events: FiscalJournalEvent[];
  zReports: ZReport[];
  profile: FiscalProfile;
  xRun: boolean;
  onRunX: () => void;
}) {
  return (
    <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
      <Card role="region" aria-labelledby="ej-h" className="gap-3 p-[18px]">
        <Card.Header>
          <CardHeading id="ej-h">Electronic Journal · Today</CardHeading>
          <Card.Description>Append-only record from the VSDC, with journal sequence numbers</Card.Description>
        </Card.Header>
        <ListView aria-label="Electronic journal, today" variant="secondary" items={events}>
          {(j) => (
            <ListView.Item id={j.id} textValue={`${j.time} ${j.event}`}>
              <ListView.ItemContent>
                <span className="w-10 flex-none text-xs text-muted tabular">{j.time}</span>
                <div className="flex min-w-0 flex-col">
                  <ListView.Title>{j.event}</ListView.Title>
                  <ListView.Description className="tabular">{j.detail}</ListView.Description>
                </div>
              </ListView.ItemContent>
              <ListView.ItemAction>
                <span className="text-xs text-muted tabular">#{num(j.sequence)}</span>
              </ListView.ItemAction>
            </ListView.Item>
          )}
        </ListView>
      </Card>

      <Card role="region" aria-labelledby="xz-h" className="gap-3 p-[18px]">
        <Card.Header>
          <CardHeading id="xz-h">X and Z Reports</CardHeading>
          <Card.Description>X reads today’s totals without resetting. Z closes the fiscal day.</Card.Description>
        </Card.Header>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onPress={onRunX}>
            <FileText className="size-4" aria-hidden="true" />
            Run X report
          </Button>
          <Button size="sm" variant="secondary" isDisabled>
            <Lock className="size-4" aria-hidden="true" />
            Run Z report
          </Button>
          <span className="text-xs text-muted">Z runs once a day with night audit at 23:59</span>
        </div>
        {xRun ? (
          <Card variant="secondary" className="gap-1 px-3.5 py-3" role="status">
            <span className="text-[14px] font-semibold">X report · 10:12 · counters not reset</span>
            <span className="text-[13px] tabular">{profile.xReport}</span>
          </Card>
        ) : null}
        <Table>
          <Table.ScrollContainer>
            <Table.Content
              aria-label="Z reports"
              className="[&_td]:px-3 [&_td]:whitespace-nowrap [&_th]:px-3 [&_th]:whitespace-nowrap"
            >
              <Table.Header>
                <Table.Column isRowHeader>Z report</Table.Column>
                <Table.Column>Fiscal day</Table.Column>
                <Table.Column className="text-right">Receipts</Table.Column>
                <Table.Column className="text-right">Sales</Table.Column>
                <Table.Column className="text-right">VAT included</Table.Column>
                <Table.Column className="text-right">Refunds</Table.Column>
              </Table.Header>
              <Table.Body>
                {zReports.map((z) => (
                  <Table.Row key={z.id} id={z.id}>
                    <Table.Cell className="font-medium tabular">{z.id}</Table.Cell>
                    <Table.Cell>{z.day}</Table.Cell>
                    <Table.Cell className="text-right tabular">{num(z.receipts)}</Table.Cell>
                    <Table.Cell className="text-right tabular">{rwf(z.sales)}</Table.Cell>
                    <Table.Cell className="text-right tabular">{rwf(z.vat)}</Table.Cell>
                    <Table.Cell className="text-right tabular">{rwf(z.refunds)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </Card>
    </div>
  );
}
