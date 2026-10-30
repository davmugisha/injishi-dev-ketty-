"use client";

import { CircleInfo } from "@gravity-ui/icons";
import { Alert, Button, Input, Modal, Table } from "@heroui/react";
import { useState } from "react";
import type { AllocationProposal, BankTransfer } from "../../model/accounting.ts";
import { num, rwf } from "../accounting-parts.tsx";

const parse = (v: string) => Number(v.replace(/[^\d]/g, "")) || 0;

/** Propose how a bank transfer is allocated to open invoices; a second person approves before balances move. */
export function ArAllocationDialog({
  transfer,
  allocation,
  isOpen,
  onClose,
  onPropose,
}: {
  transfer: BankTransfer;
  allocation: AllocationProposal;
  isOpen: boolean;
  onClose: () => void;
  onPropose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(allocation.rows.map((r) => [r.invoice, num(r.proposed)])),
  );
  const total = allocation.rows.reduce((t, r) => t + parse(values[r.invoice] ?? ""), 0);
  const over = total - transfer.amount;
  const tooMuch = allocation.rows.find((r) => parse(values[r.invoice] ?? "") > r.open);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => (open ? null : onClose())}>
      <Modal.Container size="lg">
        <Modal.Dialog aria-labelledby="dlg-h" className="sm:max-w-[640px]">
          <Modal.Header className="flex-col items-start gap-1">
            <Modal.Heading id="dlg-h" className="text-lg leading-[26px] font-semibold">
              Match {transfer.line} to {allocation.account}
            </Modal.Heading>
            <p className="text-[13px] text-muted tabular">{allocation.detail}</p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3">
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label={`Allocate ${rwf(transfer.amount)} to open invoices`}>
                  <Table.Header>
                    <Table.Column isRowHeader>Invoice</Table.Column>
                    <Table.Column>Status</Table.Column>
                    <Table.Column className="text-right">Open</Table.Column>
                    <Table.Column className="text-right">Allocate (RWF)</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {allocation.rows.map((r) => (
                      <Table.Row key={r.invoice} id={r.invoice}>
                        <Table.Cell className="font-medium whitespace-nowrap tabular">{r.invoice}</Table.Cell>
                        <Table.Cell className="text-xs text-muted">{r.status}</Table.Cell>
                        <Table.Cell className="text-right tabular">{rwf(r.open)}</Table.Cell>
                        <Table.Cell className="text-right">
                          <Input
                            aria-label={`Allocate to ${r.invoice}`}
                            value={values[r.invoice] ?? ""}
                            onChange={(e) => setValues((o) => ({ ...o, [r.invoice]: e.target.value }))}
                            onKeyDown={(e) => e.stopPropagation()}
                            inputMode="numeric"
                            className="w-[130px] text-right tabular"
                          />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            {over > 0 || tooMuch ? (
              <Alert status="danger" role="status">
                <Alert.Content>
                  <Alert.Title>
                    {over > 0
                      ? `Allocations exceed the transfer by ${rwf(over)}`
                      : `${tooMuch?.invoice} has only ${rwf(tooMuch?.open ?? 0)} open`}
                  </Alert.Title>
                </Alert.Content>
              </Alert>
            ) : null}
            <Alert>
              <Alert.Indicator>
                <CircleInfo />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>{allocation.alertTitle}</Alert.Title>
                <Alert.Description>{allocation.alertText}</Alert.Description>
              </Alert.Content>
            </Alert>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onPress={onClose}>
              Cancel
            </Button>
            <Button onPress={onPropose} isDisabled={over > 0 || Boolean(tooMuch) || total === 0}>
              Propose allocation
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
