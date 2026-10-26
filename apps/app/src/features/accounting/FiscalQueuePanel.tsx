"use client";

import { ArrowsRotateRight, ArrowUpFromLine, Magnifier, OctagonXmark, Tag } from "@gravity-ui/icons";
import { Alert, Button, Card, Chip, Table } from "@heroui/react";
import { screenHref } from "@injishi/data";
import { KeyValueList, LinkButton, toneColor } from "@injishi/ui";
import type { ComponentType, SVGProps } from "react";
import { FISCAL_STATUS, type QueueRow } from "./fiscal";
import { firstKey, LogTimeline, Note, rwf, Stack } from "./shared";

const EXPLAIN: Record<string, string> = {
  pending:
    "The VSDC has the request but has not signed it. No fiscal number exists yet, so the guest copy says “fiscal receipt pending” and the folio waits.",
  unknown:
    "The connection dropped after sending. We do not know whether the VSDC signed it, so it is shown as neither issued nor failed.",
};

interface Action {
  label: string;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  onPress: () => void;
  isDisabled: boolean;
}

/** Queue tab: documents the VSDC has not signed, with the selected document's attempts and next step. */
export function FiscalQueuePanel({
  rows,
  selected,
  onSelect,
  merchantName,
  offline,
  mapped,
  onRetry,
  onAsk,
  onResubmit,
  onMapItem,
}: {
  rows: QueueRow[];
  selected: QueueRow;
  onSelect: (id: string) => void;
  merchantName: string;
  offline: boolean;
  mapped: Record<string, string>;
  onRetry: (id: string) => void;
  onAsk: (id: string) => void;
  onResubmit: (id: string) => void;
  onMapItem: (itemId: string) => void;
}) {
  const sel = selected;
  const status = FISCAL_STATUS[sel.current];
  const mappedOk = !sel.itemId || Boolean(mapped[sel.itemId]);

  let primary: Action;
  let secondary: Action | null = null;
  let note: string;
  if (sel.current === "pending") {
    primary = { label: "Retry now", icon: ArrowsRotateRight, onPress: () => onRetry(sel.id), isDisabled: offline };
    note = offline
      ? "VSDC unreachable · retries resume automatically when it returns."
      : "Next automatic retry at 10:30. Retrying sooner is safe: the same request ID cannot issue twice.";
  } else if (sel.current === "unknown") {
    primary = { label: "Ask provider for status", icon: Magnifier, onPress: () => onAsk(sel.id), isDisabled: false };
    secondary = { label: "Retry with same request ID", onPress: () => onRetry(sel.id), isDisabled: offline };
    note = "Stays Unknown until the provider confirms either way.";
  } else if (sel.itemId) {
    const itemId = sel.itemId;
    primary = { label: "Map item code", icon: Tag, onPress: () => onMapItem(itemId), isDisabled: false };
    secondary = { label: "Resubmit", onPress: () => onResubmit(sel.id), isDisabled: !mappedOk };
    note = mappedOk ? "Item is mapped. Resubmit sends a new request." : "Resubmit unlocks once the item has a class.";
  } else {
    primary = {
      label: "Resubmit without buyer TIN",
      icon: ArrowUpFromLine,
      onPress: () => onResubmit(sel.id),
      isDisabled: offline,
    };
    note = `The order itself stays with ${merchantName}.`;
  }
  const PrimaryIcon = primary.icon;

  return (
    <div className="flex flex-wrap items-start gap-4">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-2.5">
        <p className="text-[13px] leading-5 text-muted">
          Documents the VSDC has not signed. Every retry and status query reuses the original request ID, so a retry can
          never issue a second receipt.
        </p>
        <Table>
          <Table.ScrollContainer>
            <Table.Content
              className="min-w-[640px]"
              aria-label="Documents waiting at the VSDC"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set([sel.id])}
              onSelectionChange={(keys) => {
                const id = firstKey(keys);
                if (id) onSelect(id);
              }}
            >
              <Table.Header>
                <Table.Column isRowHeader>Document</Table.Column>
                <Table.Column className="text-right">Amount</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column>Request ID</Table.Column>
                <Table.Column className="text-right">Attempts</Table.Column>
                <Table.Column>Age</Table.Column>
              </Table.Header>
              <Table.Body>
                {rows.map((r) => {
                  const st = FISCAL_STATUS[r.current];
                  return (
                    <Table.Row key={r.id} id={r.id} className="cursor-pointer">
                      <Table.Cell>
                        <Stack
                          primary={r.type}
                          primaryClassName="font-medium"
                          secondary={`${r.source} · ${r.trigger}`}
                        />
                      </Table.Cell>
                      <Table.Cell className="text-right tabular">{rwf(r.amount)}</Table.Cell>
                      <Table.Cell>
                        <Chip size="sm" variant="soft" color={toneColor(st.tone)}>
                          {st.label}
                        </Chip>
                      </Table.Cell>
                      <Table.Cell className="text-xs tabular">{r.request}</Table.Cell>
                      <Table.Cell className="text-right tabular">{r.attemptsNow}</Table.Cell>
                      <Table.Cell className="text-xs text-muted">{r.age}</Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>

      <Card role="region" aria-labelledby="sel-h" className="min-w-0 flex-[1_1_340px] gap-3 p-[18px]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <h2 id="sel-h" className="text-[15px] leading-[22px] font-semibold tabular">
              {sel.type} · {rwf(sel.amount)}
            </h2>
            <span className="text-xs text-muted">{sel.source}</span>
          </div>
          <Chip size="sm" variant="soft" color={toneColor(status.tone)} className="shrink-0">
            {status.label}
          </Chip>
        </div>
        {sel.current === "rejected" ? (
          <Alert status="danger">
            <Alert.Indicator>
              <OctagonXmark />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>{sel.reason}</Alert.Title>
              <Alert.Description>{sel.fix}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : (
          <p className="text-[13px] leading-5">{EXPLAIN[sel.current]}</p>
        )}
        <KeyValueList
          items={[
            { label: "Request ID", value: <span className="tabular">{sel.request}</span> },
            { label: "Merchant", value: merchantName },
            {
              label: "Fiscal number",
              value: <span className="font-normal text-muted">None until the VSDC signs</span>,
            },
            ...(sel.credits
              ? [{ label: "Credits", value: <span className="tabular">{sel.credits} · stays issued</span> }]
              : []),
          ]}
        />
        <LogTimeline entries={sel.history} label="Issuance attempts" />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onPress={primary.onPress} isDisabled={primary.isDisabled}>
            {PrimaryIcon ? <PrimaryIcon className="size-4" aria-hidden="true" /> : null}
            {primary.label}
          </Button>
          {secondary ? (
            <Button size="sm" variant="secondary" onPress={secondary.onPress} isDisabled={secondary.isDisabled}>
              {secondary.label}
            </Button>
          ) : null}
          <LinkButton href={screenHref(sel.board)} size="sm" variant="ghost">
            Open source
          </LinkButton>
        </div>
        <Note>{note}</Note>
      </Card>
    </div>
  );
}
