"use client";

import {
  ArrowDownToLine,
  ArrowUturnCcwLeft,
  Briefcase,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleCheckFill,
  CircleDashed,
  FileText,
  Lock,
  Receipt,
  TriangleExclamation,
  Vault,
} from "@gravity-ui/icons";
import { Button, Card, Chip, Label, ProgressBar, Table } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import type { ClosePeriod, ExportBatch, JournalEntry, LedgerAccount, Tone } from "@injishi/product-finance";
import { useBoardHref } from "@injishi/product-finance/web";
import { GateChip, TextLink, toneColor } from "@injishi/ui";
import { type ComponentType, Fragment, type SVGProps } from "react";
import { MetaList, Note, num, rwf, Stack } from "./shared";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const SOURCE: Record<JournalEntry["source"], { label: string; icon: IconComponent }> = {
  folio: { label: "Folio close", icon: Receipt },
  payment: { label: "Payment verified", icon: CircleCheck },
  bank: { label: "Bank allocation verified", icon: Vault },
  procurement: { label: "Procurement invoice", icon: FileText },
  reversal: { label: "Reversal", icon: ArrowUturnCcwLeft },
  cityLedger: { label: "City ledger transfer", icon: Briefcase },
};

const ENTRY_STATE: Record<JournalEntry["status"], { label: string; tone: Tone }> = {
  posted: { label: "Posted", tone: "default" },
  pending: { label: "Pending approval", tone: "warning" },
  reversal: { label: "Reversal", tone: "default" },
};

const SOURCE_FILTERS = [
  { id: "all", label: "All sources" },
  { id: "folio", label: "Folio close" },
  { id: "payment", label: "Payments" },
  { id: "procurement", label: "Procurement" },
] as const;

/** Lines of an expanded journal entry, with evidence, posting key and actor. */
function EntryLines({ entry, debits, credits }: { entry: JournalEntry; debits: number; credits: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Table variant="secondary">
        <Table.ScrollContainer>
          <Table.Content aria-label={`Lines of ${entry.id}`} className="text-[13px]">
            <Table.Header>
              <Table.Column isRowHeader>Account</Table.Column>
              <Table.Column>USALI department</Table.Column>
              <Table.Column className="text-right">Debit</Table.Column>
              <Table.Column className="text-right">Credit</Table.Column>
            </Table.Header>
            <Table.Body>
              {entry.lines.map((l) => (
                <Table.Row key={l.account} id={l.account}>
                  <Table.Cell className="py-1.5 tabular">{l.account}</Table.Cell>
                  <Table.Cell className="py-1.5 text-muted">{l.department}</Table.Cell>
                  <Table.Cell className="py-1.5 text-right tabular">{l.debit ? num(l.debit) : ""}</Table.Cell>
                  <Table.Cell className="py-1.5 text-right tabular">{l.credit ? num(l.credit) : ""}</Table.Cell>
                </Table.Row>
              ))}
              <Table.Row id="total">
                <Table.Cell className="py-1.5 font-semibold">Total</Table.Cell>
                <Table.Cell className="py-1.5">{""}</Table.Cell>
                <Table.Cell className="py-1.5 text-right font-semibold tabular">{rwf(debits)}</Table.Cell>
                <Table.Cell className="py-1.5 text-right font-semibold tabular">{rwf(credits)}</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <MetaList
        items={[
          { label: "Evidence", value: entry.evidence },
          {
            label: "Posting key",
            value: (
              <span className="tabular">{entry.postingKey} · reprocessing returns this entry, never a second one</span>
            ),
          },
          { label: "Actor", value: entry.actor },
        ]}
      />
      {entry.status === "pending" ? (
        <Note>
          You prepared this entry, so Didier Mugenzi or Aline Uwase approves it before it posts. It is excluded from
          exports until then.
        </Note>
      ) : null}
    </div>
  );
}

/** Journal entries tab: balanced postings, each expandable to its lines and evidence. */
export function LedgerJournalPanel({
  entries,
  source,
  onSourceChange,
  open,
  onToggle,
}: {
  entries: JournalEntry[];
  source: string;
  onSourceChange: (id: string) => void;
  open: string;
  onToggle: (id: string) => void;
}) {
  const shown = entries.filter(
    (e) => source === "all" || e.source === source || (source === "payment" && e.source === "bank"),
  );
  const reversal = entries.find((e) => e.status === "reversal");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segment aria-label="Source" selectedKey={source} onSelectionChange={(k) => onSourceChange(String(k))}>
          {SOURCE_FILTERS.map((f) => (
            <Segment.Item key={f.id} id={f.id}>
              {f.label}
            </Segment.Item>
          ))}
        </Segment>
        <span className="text-xs text-muted tabular">
          October to date · debits RWF 71,944,400 · credits RWF 71,944,400 · 420 entries
        </span>
      </div>
      <Table>
        <Table.ScrollContainer>
          <Table.Content className="min-w-[960px]" aria-label="Journal entries">
            <Table.Header>
              <Table.Column className="w-10 pe-0">
                <span className="sr-only">Expand</span>
              </Table.Column>
              <Table.Column isRowHeader>Entry</Table.Column>
              <Table.Column>Source</Table.Column>
              <Table.Column>Description</Table.Column>
              <Table.Column className="text-right">Debits</Table.Column>
              <Table.Column className="text-right">Credits</Table.Column>
              <Table.Column>Check</Table.Column>
              <Table.Column>Status</Table.Column>
            </Table.Header>
            <Table.Body>
              {shown.map((e) => {
                const dr = e.lines.reduce((t, l) => t + l.debit, 0);
                const cr = e.lines.reduce((t, l) => t + l.credit, 0);
                const isOpen = open === e.id;
                const src = SOURCE[e.source];
                const SrcIcon = src.icon;
                const st = ENTRY_STATE[e.status];
                return (
                  <Fragment key={e.id}>
                    <Table.Row id={e.id} className={isOpen ? "[&>td]:bg-surface-secondary" : undefined}>
                      <Table.Cell className="pe-0">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          aria-expanded={isOpen}
                          aria-label={`Show lines of ${e.id}`}
                          onPress={() => onToggle(e.id)}
                        >
                          {isOpen ? (
                            <ChevronDown className="size-4" aria-hidden="true" />
                          ) : (
                            <ChevronRight className="size-4" aria-hidden="true" />
                          )}
                        </Button>
                      </Table.Cell>
                      <Table.Cell>
                        <Stack
                          primary={e.id}
                          primaryClassName="font-medium tabular"
                          secondary={e.at}
                          secondaryClassName="tabular"
                        />
                      </Table.Cell>
                      <Table.Cell>
                        <Stack
                          primary={
                            <span className="flex items-center gap-1.5">
                              <SrcIcon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                              {src.label}
                            </span>
                          }
                          secondary={e.reference}
                          secondaryClassName="tabular"
                        />
                      </Table.Cell>
                      <Table.Cell className="max-w-[300px] whitespace-normal">{e.description}</Table.Cell>
                      <Table.Cell className="text-right tabular">{rwf(dr)}</Table.Cell>
                      <Table.Cell className="text-right tabular">{rwf(cr)}</Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={dr === cr ? "success" : "danger"}>
                          {dr === cr ? "Balanced" : `Out by ${rwf(Math.abs(dr - cr))}`}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={toneColor(st.tone)}>
                          {st.label}
                        </Chip>
                      </Table.Cell>
                    </Table.Row>
                    {isOpen ? (
                      <Table.Row id={`${e.id}-lines`}>
                        <Table.Cell colSpan={8} className="bg-surface-secondary pt-3.5 pr-4 pb-4 pl-14">
                          <EntryLines entry={e} debits={dr} credits={cr} />
                        </Table.Cell>
                      </Table.Row>
                    ) : null}
                  </Fragment>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <Note>
        Posted entries are never edited. Corrections post as reversals that reference the original, as in{" "}
        {reversal?.id ?? "a reversal entry"}.
      </Note>
    </div>
  );
}

const MAPPING: Record<LedgerAccount["mapping"], { label: string; tone: Tone }> = {
  approved: { label: "Approved", tone: "default" },
  proposed: { label: "Proposed · awaiting owner", tone: "warning" },
  unmapped: { label: "Unmapped", tone: "danger" },
};

/** Chart of accounts tab: each account's USALI mapping; changes wait for the owner. */
export function LedgerAccountsPanel({
  accounts,
  proposed,
  onPropose,
  onlyAttention,
  onFilterChange,
}: {
  accounts: LedgerAccount[];
  proposed: Record<string, boolean>;
  onPropose: (id: string) => void;
  onlyAttention: boolean;
  onFilterChange: (onlyAttention: boolean) => void;
}) {
  const rows = accounts.map((a) => {
    const mapping: LedgerAccount["mapping"] = a.mapping === "unmapped" && proposed[a.id] ? "proposed" : a.mapping;
    const department =
      mapping === "unmapped"
        ? "Not mapped · excluded from USALI reports"
        : a.mapping === "unmapped"
          ? (a.proposal ?? a.department)
          : a.department;
    return { ...a, mapping, department };
  });
  const attention = rows.filter((a) => a.mapping !== "approved");
  const shown = onlyAttention ? attention : rows;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-[14px] font-semibold">USALI mapping set v2</span>
          <span className="text-xs text-muted">
            Approved by Didier Mugenzi on 2 Sep 2026 · changes need the owner’s approval before they affect reports
          </span>
        </div>
        <Segment
          aria-label="Filter accounts"
          selectedKey={onlyAttention ? "attention" : "all"}
          onSelectionChange={(k) => onFilterChange(k === "attention")}
        >
          <Segment.Item id="all">All accounts</Segment.Item>
          <Segment.Item id="attention">Needs attention {attention.length}</Segment.Item>
        </Segment>
      </div>
      <Table>
        <Table.ScrollContainer>
          <Table.Content className="min-w-[720px]" aria-label="Chart of accounts">
            <Table.Header>
              <Table.Column>Code</Table.Column>
              <Table.Column isRowHeader>Account</Table.Column>
              <Table.Column>Type</Table.Column>
              <Table.Column>USALI department or schedule</Table.Column>
              <Table.Column>Mapping</Table.Column>
              <Table.Column>
                <span className="sr-only">Action</span>
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {shown.map((a) => {
                const m = MAPPING[a.mapping];
                return (
                  <Table.Row key={a.id} id={a.id}>
                    <Table.Cell className="font-medium tabular">{a.code}</Table.Cell>
                    <Table.Cell>{a.name}</Table.Cell>
                    <Table.Cell className="text-muted">{a.type}</Table.Cell>
                    <Table.Cell>{a.department}</Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={toneColor(m.tone)}>
                        {m.label}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      {a.mapping === "unmapped" && a.proposal ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`Propose ${a.proposal} for ${a.code} ${a.name}`}
                          onPress={() => onPropose(a.id)}
                        >
                          Propose {a.proposal}
                        </Button>
                      ) : null}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
    </div>
  );
}

const CHECK: Record<ClosePeriod["checks"][number]["status"], { icon: IconComponent; className: string }> = {
  ok: { icon: CircleCheckFill, className: "text-success" },
  warn: { icon: TriangleExclamation, className: "text-warning" },
  wait: { icon: CircleDashed, className: "text-muted" },
};

/** Period close tab: the checklist of each period, and close / reopen requests. */
export function LedgerClosePanel({
  periods,
  reopenRequested,
  onRequestReopen,
}: {
  periods: ClosePeriod[];
  reopenRequested: boolean;
  onRequestReopen: () => void;
}) {
  return (
    <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
      {periods.map((p) => {
        const done = p.checks.filter((c) => c.status === "ok").length;
        const total = p.checks.length;
        const isOpen = p.status === "open";
        return (
          <Card key={p.id} role="region" aria-labelledby={`period-${p.id}`} className="gap-3 p-[18px]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <h2 id={`period-${p.id}`} className="text-[15px] leading-[22px] font-semibold">
                  {p.name}
                </h2>
                <span className="text-xs text-muted">{p.detail}</span>
              </div>
              <Chip size="sm" variant="soft" color={toneColor(p.stateTone)} className="shrink-0">
                {p.state}
              </Chip>
            </div>
            <ProgressBar
              value={done}
              maxValue={total}
              valueLabel={`${done} of ${total}`}
              aria-label={`${p.name} checklist`}
            >
              <Label>Checklist</Label>
              <ProgressBar.Output className="tabular" />
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            <ul className="flex flex-col gap-2">
              {p.checks.map((c) => {
                const ic = CHECK[c.status];
                const CheckIcon = ic.icon;
                return (
                  <li key={c.title} className="flex items-start gap-2.5">
                    <CheckIcon className={`mt-0.5 size-4 flex-none ${ic.className}`} aria-hidden="true" />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[13px] font-medium">{c.title}</span>
                      <span className="text-xs leading-4 text-muted">{c.detail}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              {isOpen ? (
                <>
                  <Button size="sm" isDisabled={done < total}>
                    Close period
                  </Button>
                  <span className="text-xs text-muted">Unlocks when every check passes</span>
                </>
              ) : (
                <>
                  <Button size="sm" variant="secondary" isDisabled={reopenRequested} onPress={onRequestReopen}>
                    {reopenRequested ? "Reopen requested" : "Request reopen"}
                  </Button>
                  <span className="text-xs text-muted">
                    {reopenRequested
                      ? "Sent to Didier Mugenzi with reason code LATE-INVOICE · logged 10:24"
                      : "Reopening needs the owner, a reason code, and is logged"}
                  </span>
                </>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/** Exports tab: idempotent journal batches, each reconciled to ledger totals before download. */
export function LedgerExportsPanel({
  batches,
  rerun,
  onRerun,
}: {
  batches: ExportBatch[];
  rerun: Record<string, boolean>;
  onRerun: (id: string) => void;
}) {
  const screenHref = useBoardHref();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-muted">
          Batches are idempotent: re-running a batch ID returns the same rows. Each export is reconciled to ledger
          totals before download.
        </span>
        <GateChip icon={<Lock className="size-3" aria-hidden="true" />}>
          No accounting system connected · file exports only
        </GateChip>
      </div>
      <Table>
        <Table.ScrollContainer>
          <Table.Content className="min-w-[900px]" aria-label="Accounting export batches">
            <Table.Header>
              <Table.Column isRowHeader>Batch</Table.Column>
              <Table.Column>Range</Table.Column>
              <Table.Column>Format</Table.Column>
              <Table.Column className="text-right">Entries</Table.Column>
              <Table.Column className="text-right">Ledger debits</Table.Column>
              <Table.Column className="text-right">Export debits</Table.Column>
              <Table.Column>Reconciliation</Table.Column>
              <Table.Column>
                <span className="sr-only">Actions</span>
              </Table.Column>
            </Table.Header>
            <Table.Body>
              {batches.map((b) => {
                const blocked = b.status === "blocked";
                return (
                  <Table.Row key={b.id} id={b.id}>
                    <Table.Cell>
                      <Stack primary={b.id} primaryClassName="font-medium tabular" secondary={b.when} />
                    </Table.Cell>
                    <Table.Cell>{b.range}</Table.Cell>
                    <Table.Cell className="text-muted">{b.format}</Table.Cell>
                    <Table.Cell className="text-right tabular">{num(b.entries)}</Table.Cell>
                    <Table.Cell className="text-right tabular">{rwf(b.ledgerDebits)}</Table.Cell>
                    <Table.Cell className="text-right tabular">{rwf(b.exportDebits)}</Table.Cell>
                    <Table.Cell>
                      <span className="flex flex-col gap-0.5">
                        <Chip size="sm" variant="soft" color={blocked ? "warning" : "success"} className="self-start">
                          {blocked ? "Blocked" : "Reconciled"}
                        </Chip>
                        <span className="max-w-[260px] text-xs whitespace-normal text-muted">
                          {rerun[b.id]
                            ? "Re-run 10:24 · same batch ID · 0 new rows, 0 duplicates · totals still match"
                            : b.note}
                        </span>
                      </span>
                    </Table.Cell>
                    <Table.Cell className="text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          isDisabled={blocked}
                          aria-label={`Download ${b.id}`}
                        >
                          <ArrowDownToLine className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          isDisabled={blocked}
                          aria-label={`Re-run ${b.id}`}
                          onPress={() => onRerun(b.id)}
                        >
                          Re-run
                        </Button>
                      </span>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      <Note>
        Connecting an accounting system is set up in <TextLink href={screenHref("Integrations")}>Integrations</TextLink>{" "}
        and stays off until reconciliation tests pass.
      </Note>
    </div>
  );
}
