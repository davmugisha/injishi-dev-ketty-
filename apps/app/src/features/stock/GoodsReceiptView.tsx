"use client";

import {
  Box,
  CircleCheck,
  CircleCheckFill,
  CircleXmarkFill,
  FileArrowUp,
  FileText,
  OctagonXmark,
  PaperPlane,
  ShieldExclamation,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  Switch,
  Table,
  TextField,
} from "@heroui/react";
import { DropZone, RadioButtonGroup } from "@heroui-pro/react";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { screenHref } from "@injishi/data";
import type { GoodsReceipt, MatchResolution, ReasonOption, ReceiptLine } from "@injishi/data/fixtures/stock";
import { formatNumber, GateChip, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import { useState } from "react";
import { Muted, money, SectionTitle, signedMoney, ToneChip } from "./shared";

export interface GoodsReceiptData {
  receipt: GoodsReceipt;
  lines: ReceiptLine[];
  reasons: ReasonOption[];
  resolutions: MatchResolution[];
}

type Qty = { arrived: number; rejected: number };

/** "tilapia", "sambaza", but proper names keep their capitals ("Nile perch fillet"). */
function shortName(name: string): string {
  const head = name.split(",")[0];
  return head.startsWith("Nile") ? head : head.toLowerCase();
}

const unitWord = (unit: ReceiptLine["unit"]) => (unit === "bags" ? "bag" : "kg");

/** Digits of a typed amount ("318,400" → 318400); NaN when nothing usable was typed. */
function parseAmount(text: string): number {
  const digits = text.replace(/[^0-9.]/g, "");
  return digits ? Number(digits) : Number.NaN;
}

export function GoodsReceiptView({ data }: { data: GoodsReceiptData }) {
  const { receipt, lines } = data;
  const [q, setQ] = useState<Record<string, Qty>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, { arrived: l.arrived, rejected: l.rejected }])),
  );
  const [reasons, setReasons] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, l.reason])),
  );
  const [keepOpen, setKeepOpen] = useState(true);
  const [fix, setFix] = useState(data.resolutions[0]?.id ?? "");
  const [fixSent, setFixSent] = useState(false);
  const [posted, setPosted] = useState(false);
  const [invoiceTotal, setInvoiceTotal] = useState(formatAmount(receipt.invoice.total));
  const [file, setFile] = useState<{ name: string; meta: string } | null>(receipt.invoice.file);

  const acc = (l: ReceiptLine) => q[l.id].arrived - q[l.id].rejected;
  const setArrived = (id: string, arrived: number) =>
    setQ((cur) => ({ ...cur, [id]: { arrived, rejected: Math.min(cur[id].rejected, arrived) } }));
  const setRejected = (id: string, rejected: number) =>
    setQ((cur) => ({ ...cur, [id]: { ...cur[id], rejected: Math.min(rejected, cur[id].arrived) } }));

  // Partial delivery: what has not arrived stays open on the PO, or is cancelled.
  const remaining = lines
    .map((l) => ({ name: shortName(l.name), left: l.ordered - q[l.id].arrived, unit: l.unit }))
    .filter((x) => x.left > 0);
  const remText = remaining.map((x) => `${x.left} ${x.unit} ${x.name}`).join(" and ");
  const openText = !remaining.length
    ? "Everything has arrived; the PO will close."
    : keepOpen
      ? `${remText} stay open on ${receipt.po}. The supplier can deliver them later against the same order.`
      : `The remaining ${remText} will be cancelled and the supplier told.`;

  // Three-way match: purchase order × accepted quantity × supplier invoice, line by line.
  let accepted = 0;
  const mismatches: { line: ReceiptLine; qtyOk: boolean; a: number }[] = [];
  const match = lines.map((l) => {
    const a = acc(l);
    accepted += a * l.price;
    const iq = l.invoicedQty;
    const ip = l.invoicedPrice;
    const qtyOk = a === iq;
    const priceOk = !iq || Math.abs(ip - l.price) / l.price <= receipt.tolerance / 100;
    let result = "Matches";
    let ok = true;
    if (!qtyOk) {
      ok = false;
      result = `Quantity differs · invoice ${iq}, accepted ${a}`;
    } else if (!priceOk) {
      ok = false;
      result = `Price ${signedMoney(ip - l.price)} a ${unitWord(l.unit)} (${signedPct(ip, l.price)})`;
    } else if (!iq) result = "Nothing delivered, nothing billed";
    if (!ok) mismatches.push({ line: l, qtyOk, a });
    return {
      id: l.id,
      name: l.name,
      po: `${l.ordered} ${l.unit} × ${money(l.price)}`,
      rec: `${a} ${l.unit}`,
      inv: iq ? `${iq} ${l.unit} × ${money(ip)}` : "Not invoiced",
      result,
      ok,
    };
  });
  const rejectedRows = lines
    .filter((l) => q[l.id].rejected > 0)
    .map((l) => ({
      id: `rejected-${l.id}`,
      name: `Rejected ${shortName(l.name)}`,
      po: "—",
      rec: `${q[l.id].rejected} ${l.unit} rejected`,
      inv: "Not billed",
      result: "Supplier did not bill rejected goods",
      ok: true,
    }));
  const invTotal = parseAmount(invoiceTotal);
  const diff = Number.isNaN(invTotal) ? 0 : invTotal - accepted;
  const blocked = mismatches.length > 0;
  const first = mismatches[0];
  const blockText = !first
    ? ""
    : !first.qtyOk
      ? `Quantity on the invoice (${first.line.invoicedQty} ${first.line.unit}) does not match what was accepted (${first.a} ${first.line.unit}) for ${shortName(first.line.name)}.`
      : `Price variance on ${shortName(first.line.name)}: invoice ${money(first.line.invoicedPrice)} a ${unitWord(first.line.unit)} against ${money(first.line.price)} on the PO and quote ${receipt.quote} (${signedPct(first.line.invoicedPrice, first.line.price)}, tolerance ${receipt.tolerance}%). Difference ${money(Math.abs(first.line.invoicedPrice - first.line.price) * first.a)}.`;
  const fx = data.resolutions.find((r) => r.id === fix) ?? data.resolutions[0];
  const matchState = blocked ? (fixSent ? `Blocked · ${fx.title.toLowerCase()}` : "Blocked · mismatch") : "Matched";
  const accText = lines
    .filter((l) => acc(l) > 0)
    .map((l) => `${acc(l)} ${l.unit} ${shortName(l.name)}`)
    .join(", ");

  return (
    <PageContent className="text-sm">
      <PageHeader
        eyebrow={`Buy › Goods receipt › ${receipt.id}`}
        title={`Receive ${receipt.po} · ${receipt.supplier}`}
        description="Count what arrived, accept or reject each line, then match the supplier's fiscal invoice before it goes to Finance."
        actions={
          <>
            <LinkButton href={screenHref("PurchaseOrders")} variant="secondary">
              <FileText className="size-4" />
              Open the PO
            </LinkButton>
            <Button onPress={() => setPosted(true)} isDisabled={posted}>
              <Box className="size-4" />
              {posted ? "Receipt posted" : "Post receipt to stock"}
            </Button>
          </>
        }
      />

      {posted ? (
        <Alert status="success" role="status">
          <Alert.Indicator>
            <CircleCheck />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>
              Receipt {receipt.id} posted at {receipt.postedAt}
            </Alert.Title>
            <Alert.Description>
              {accText} added to {receipt.location} at PO cost (movements {receipt.movements}). Payment stays blocked
              until the invoice matches.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <Card variant="secondary" className="px-[18px] py-3.5" aria-label="Delivery">
        <dl className="m-0 grid gap-x-5 gap-y-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr))]">
          {receipt.facts.map((f) => (
            <div key={f.label} className="flex flex-col">
              <dt className="text-xs leading-4 text-muted">{f.label}</dt>
              <dd className="m-0 text-[13px] leading-5 font-medium">{f.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(320px,4fr)]">
        <section className="flex min-w-0 flex-col gap-2.5" aria-labelledby="lines-h">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="lines-h" className="text-[15px] leading-[22px] font-semibold">
              Lines
            </h2>
            <Muted>Weighed on the store scale · quantities in stock units</Muted>
          </div>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-labelledby="lines-h">
                <Table.Header>
                  <Table.Column isRowHeader>Item</Table.Column>
                  <Table.Column className="text-right">Ordered</Table.Column>
                  <Table.Column>Arrived</Table.Column>
                  <Table.Column>Rejected</Table.Column>
                  <Table.Column className="text-right">Accepted</Table.Column>
                  <Table.Column>Reason</Table.Column>
                </Table.Header>
                <Table.Body>
                  {lines.map((l) => {
                    const { arrived, rejected } = q[l.id];
                    return (
                      <Table.Row key={l.id} id={l.id}>
                        <Table.Cell>
                          <span className="flex flex-col">
                            <span className="font-medium">{l.name}</span>
                            <Muted className="tabular">
                              PO price {money(l.price)} a {unitWord(l.unit)}
                            </Muted>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-right whitespace-nowrap tabular">
                          {l.ordered} {l.unit}
                        </Table.Cell>
                        <Table.Cell>
                          <NumberStepper
                            size="sm"
                            value={arrived}
                            onChange={(v) => setArrived(l.id, Number.isNaN(v) ? 0 : v)}
                            minValue={0}
                            isDisabled={posted}
                            aria-label={`${l.name} arrived`}
                          >
                            <NumberStepper.Group>
                              <NumberStepper.DecrementButton aria-label={`Less ${l.name} arrived`} />
                              <NumberStepper.Value className="min-w-8" />
                              <NumberStepper.IncrementButton aria-label={`More ${l.name} arrived`} />
                            </NumberStepper.Group>
                          </NumberStepper>
                        </Table.Cell>
                        <Table.Cell>
                          <NumberStepper
                            size="sm"
                            value={rejected}
                            onChange={(v) => setRejected(l.id, Number.isNaN(v) ? 0 : v)}
                            minValue={0}
                            isDisabled={posted}
                            maxValue={arrived}
                            aria-label={`${l.name} rejected`}
                          >
                            <NumberStepper.Group>
                              <NumberStepper.DecrementButton aria-label={`Reject less ${l.name}`} />
                              <NumberStepper.Value className="min-w-8" />
                              <NumberStepper.IncrementButton aria-label={`Reject more ${l.name}`} />
                            </NumberStepper.Group>
                          </NumberStepper>
                        </Table.Cell>
                        <Table.Cell className="text-right font-semibold whitespace-nowrap tabular">
                          {arrived - rejected} {l.unit}
                        </Table.Cell>
                        <Table.Cell className="min-w-[180px]">
                          {rejected > 0 ? (
                            <Select
                              fullWidth
                              aria-label={`Rejection reason for ${l.name}`}
                              value={reasons[l.id]}
                              onChange={(k) => k != null && setReasons((cur) => ({ ...cur, [l.id]: String(k) }))}
                              isDisabled={posted}
                            >
                              <Select.Trigger className="text-[13px]">
                                <Select.Value />
                                <Select.Indicator />
                              </Select.Trigger>
                              <Select.Popover>
                                <ListBox>
                                  {reasonOptions(data.reasons, l.reason).map((r) => (
                                    <ListBox.Item key={r} id={r} textValue={r}>
                                      {r}
                                      <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  ))}
                                </ListBox>
                              </Select.Popover>
                            </Select>
                          ) : (
                            <Muted>{arrived === 0 ? (l.note ?? "Not delivered") : "All accepted"}</Muted>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <Card className="gap-2 px-4 py-3.5">
            <Switch isSelected={keepOpen} onChange={setKeepOpen} isDisabled={posted}>
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <span className="font-medium">Partial delivery · keep the PO open for what has not arrived</span>
              </Switch.Content>
            </Switch>
            <span className="text-[13px] leading-[18px] text-muted" aria-live="polite">
              {openText}
            </span>
          </Card>
        </section>

        <Card className="gap-3 p-[18px]" aria-labelledby="inv-h">
          <Card.Header>
            <h2 id="inv-h" className="text-[15px] leading-[22px] font-semibold">
              Supplier Fiscal Invoice
            </h2>
            <Card.Description>
              {receipt.supplier} · TIN {receipt.supplierTin} from the supplier record
            </Card.Description>
          </Card.Header>
          <Card.Content className="flex flex-col gap-3">
            <TextField fullWidth defaultValue={receipt.invoice.number} className="gap-1">
              <Label>Invoice number</Label>
              <Input className="tabular" />
            </TextField>
            <TextField fullWidth defaultValue={receipt.invoice.ebm} className="gap-1">
              <Label>EBM receipt number on the invoice</Label>
              <Input className="tabular" />
              <Description>Printed under the supplier's fiscal QR code</Description>
            </TextField>
            <div className="grid grid-cols-2 gap-2.5">
              <TextField fullWidth defaultValue={receipt.invoice.date} className="gap-1">
                <Label>Invoice date</Label>
                <Input />
              </TextField>
              <TextField fullWidth value={invoiceTotal} onChange={setInvoiceTotal} className="gap-1">
                <Label>Invoice total (RWF)</Label>
                <Input className="tabular" inputMode="numeric" />
              </TextField>
            </div>
            <DropZone>
              {file ? (
                <DropZone.FileList>
                  <DropZone.FileItem status="complete">
                    <DropZone.FileFormatIcon format={file.name.split(".").pop()?.toUpperCase() ?? "PDF"} color="red" />
                    <DropZone.FileInfo>
                      <DropZone.FileName>{file.name}</DropZone.FileName>
                      <DropZone.FileMeta>{file.meta}</DropZone.FileMeta>
                    </DropZone.FileInfo>
                    <DropZone.FileRemoveTrigger aria-label="Remove invoice file" onPress={() => setFile(null)} />
                  </DropZone.FileItem>
                </DropZone.FileList>
              ) : (
                <>
                  <DropZone.Area
                    className="p-3.5"
                    onDrop={(e: { items: { kind: string; name?: string }[] }) => {
                      const dropped = e.items.find((it) => it.kind === "file");
                      if (dropped?.name) setFile({ name: dropped.name, meta: "Attached just now" });
                    }}
                  >
                    <DropZone.Icon>
                      <FileArrowUp />
                    </DropZone.Icon>
                    <DropZone.Label>Attach the signed invoice</DropZone.Label>
                    <DropZone.Description>A photo or PDF of the supplier's fiscal invoice</DropZone.Description>
                    <DropZone.Trigger>Choose file</DropZone.Trigger>
                  </DropZone.Area>
                  <DropZone.Input
                    accept="image/*,.pdf"
                    onSelect={(list) => {
                      const f = list[0];
                      if (f)
                        setFile({
                          name: f.name,
                          meta: `${Math.max(1, Math.round(f.size / 1024))} KB · attached just now`,
                        });
                    }}
                  />
                </>
              )}
            </DropZone>
            <div className="flex flex-wrap items-center gap-2">
              <ToneChip tone="success">TIN matches supplier record</ToneChip>
              <GateChip icon={<ShieldExclamation className="size-3" />}>Not verified with RRA</GateChip>
            </div>
            <p className="text-xs leading-4 text-muted">
              This is the supplier's tax document. It is kept with the receipt for input VAT and audit; Injishi does not
              issue anything for a purchase.
            </p>
          </Card.Content>
        </Card>
      </div>

      <Card className="gap-3.5 p-[18px]" aria-labelledby="match-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle id="match-h" title="Three-way Match">
            {receipt.po} against receipt {receipt.id} against invoice {receipt.invoice.number} · tolerance{" "}
            {receipt.tolerance}% a line
          </SectionTitle>
          <Chip variant="soft" color={blocked ? "danger" : "success"}>
            {matchState}
          </Chip>
        </div>
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-labelledby="match-h">
              <Table.Header>
                <Table.Column isRowHeader>Line</Table.Column>
                <Table.Column className="text-right">Purchase order</Table.Column>
                <Table.Column className="text-right">Received, accepted</Table.Column>
                <Table.Column className="text-right">Supplier invoice</Table.Column>
                <Table.Column>Result</Table.Column>
              </Table.Header>
              <Table.Body>
                {[...match, ...rejectedRows].map((m) => (
                  <Table.Row key={m.id} id={m.id}>
                    <Table.Cell className="font-medium">{m.name}</Table.Cell>
                    <Table.Cell className="text-right tabular">{m.po}</Table.Cell>
                    <Table.Cell className="text-right tabular">{m.rec}</Table.Cell>
                    <Table.Cell className="text-right tabular">{m.inv}</Table.Cell>
                    <Table.Cell>
                      <span className="flex items-center gap-1.5">
                        {m.ok ? (
                          <CircleCheckFill className="size-4 shrink-0 text-success" aria-hidden="true" />
                        ) : (
                          <CircleXmarkFill className="size-4 shrink-0 text-danger" aria-hidden="true" />
                        )}
                        <span className={`text-[13px] ${m.ok ? "" : "font-semibold"}`}>{m.result}</span>
                      </span>
                    </Table.Cell>
                  </Table.Row>
                ))}
                <Table.Row id="total">
                  <Table.Cell className="font-semibold">Total</Table.Cell>
                  <Table.Cell className="text-right tabular">{money(accepted)} for accepted goods</Table.Cell>
                  <Table.Cell className="text-right tabular">{money(accepted)}</Table.Cell>
                  <Table.Cell className="text-right tabular">
                    {Number.isNaN(invTotal) ? "—" : money(invTotal)}
                  </Table.Cell>
                  <Table.Cell className="font-semibold tabular">{signedMoney(diff)}</Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>

        {blocked ? (
          <>
            <Alert status="danger" role="alert">
              <Alert.Indicator>
                <OctagonXmark />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Blocked for payables approval</Alert.Title>
                <Alert.Description>{blockText}</Alert.Description>
              </Alert.Content>
            </Alert>
            <RadioButtonGroup
              aria-label="Resolve the mismatch"
              value={fix}
              onChange={(v) => {
                if (!v) return;
                setFix(v);
                setFixSent(false);
              }}
              layout="grid"
              className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]"
            >
              {data.resolutions.map((r) => (
                <RadioButtonGroup.Item key={r.id} value={r.id} className="gap-1 p-3.5">
                  <RadioButtonGroup.Indicator>
                    <CircleCheckFill className="size-4" />
                  </RadioButtonGroup.Indicator>
                  <RadioButtonGroup.ItemContent className="flex flex-col gap-0.5">
                    <Label className="pr-6 font-semibold">{r.title}</Label>
                    <span className="text-xs leading-4 text-muted">{r.desc}</span>
                  </RadioButtonGroup.ItemContent>
                </RadioButtonGroup.Item>
              ))}
            </RadioButtonGroup>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button onPress={() => setFixSent(true)} isDisabled={fixSent}>
                <PaperPlane className="size-4" />
                {fixSent ? "Sent" : fx.action}
              </Button>
              <Muted>{fixSent ? fx.sent : "The supplier invoice stays exactly as received."}</Muted>
            </div>
          </>
        ) : (
          <Alert status="success" role="status">
            <Alert.Indicator>
              <CircleCheck />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>PO, receipt and invoice agree</Alert.Title>
              <Alert.Description>
                Ready for Finance. Grace Uwera approves the payable; this screen never approves payment.
              </Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </Card>
    </PageContent>
  );
}

/** "+7.7%" / "−3.1%": how far the invoice price is from the PO price. */
function signedPct(invoiced: number, ordered: number): string {
  const pct = ((invoiced - ordered) / ordered) * 100;
  return `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct).toFixed(1)}%`;
}

/** "318,400" for the invoice total field. */
function formatAmount(n: number): string {
  return formatNumber(n);
}

/** The reason list for a line, with the line's recorded reason first when it is not a standard one. */
function reasonOptions(options: ReasonOption[], current: string): string[] {
  const labels = options.map((o) => o.label);
  return labels.includes(current) ? labels : [current, ...labels];
}
