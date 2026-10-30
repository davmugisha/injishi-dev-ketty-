"use client";

import { ArrowDownToLine, ArrowsRotateRight, CircleCheck, Lock, TriangleExclamation } from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Modal,
  ProgressBar,
  Separator,
  Table,
  Tabs,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { EmptyState, ItemCard, RadioButtonGroup, Timeline } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  PlanBillingEntitlement,
  PlanBillingInvoice,
  PlanBillingInvoiceKind,
  PlanBillingInvoiceLine,
  PlanBillingMethod,
  PlanBillingOption,
  PlanBillingStep,
} from "@injishi/data/fixtures/owner";
import { Icon, PageContent, PageHeader, toneColor } from "@injishi/ui";
import NextLink from "next/link";
import { useState } from "react";
import { TopbarStatus } from "@/components/shell/TopbarStatus";

interface PlanBillingData {
  activation: PlanBillingStep[];
  nextLines: PlanBillingInvoiceLine[];
  retries: PlanBillingStep[];
  entitlements: PlanBillingEntitlement[];
  invoices: PlanBillingInvoice[];
  methods: PlanBillingMethod[];
  invoiceKinds: PlanBillingInvoiceKind[];
  options: PlanBillingOption[];
}

type DialogId = "" | "pay" | "plan" | "cancel";

const PRICE = "[PRICE PENDING APPROVAL]";

const DIALOGS = {
  pay: {
    title: "Pay the October Invoice",
    sub: `INJ-2026-1001 · ${PRICE}. We send a payment request; it counts as paid only when the provider confirms.`,
    ok: "Send payment request",
    danger: false,
    code: false,
  },
  plan: {
    title: "Change Plan",
    sub: "A change applies from your next billing date, 1 Nov 2026. Entitlements change on that date with an audit entry. Prices are awaiting approval.",
    ok: "Schedule change",
    danger: false,
    code: false,
  },
  cancel: {
    title: "Cancel Subscription",
    sub: "Service ends on 31 Oct 2026. Until then you can undo. Afterwards you keep read-only sign-in and every fiscal and financial export for your retention period (7 years · configured, unverified).",
    ok: "Cancel at end of October",
    danger: true,
    code: true,
  },
} as const;

/** "plan-group" → "group" (option ids are prefixed with their dialog). */
const optionKey = (o: PlanBillingOption) => o.id.slice(o.dialog.length + 1);

function StepTimeline({ steps }: { steps: PlanBillingStep[] }) {
  return (
    <Timeline size="sm" density="compact">
      {steps.map((s) => (
        <Timeline.Item key={s.id} status={s.status}>
          <Timeline.Rail>
            <Timeline.Marker />
            <Timeline.Connector />
          </Timeline.Rail>
          <Timeline.Content className="flex flex-col pb-0.5">
            <span className="text-[13px] font-medium">{s.title}</span>
            {s.detail ? <span className="text-xs leading-4 text-muted">{s.detail}</span> : null}
          </Timeline.Content>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

/**
 * What this screen cannot do yet, said plainly. The subscription, its invoices and its payment method are
 * sample data (`owner.planBilling*` are deferred) and no route takes a subscription payment, changes a plan,
 * cancels, edits a method or downloads an invoice, so these controls change nothing on screen.
 */
const unavailable = (what: string) =>
  toast.warning(`${what} is not available yet. Subscription billing is not connected; nothing was sent or changed.`);

export function PlanBillingView({
  billing,
  data,
  businessName,
}: {
  billing: "retrying" | "paid";
  data: PlanBillingData;
  /** The business, as the API names it (never the prototype's group). */
  businessName: string;
}) {
  const [tab, setTab] = useState("ov");
  const [dlg, setDlg] = useState<DialogId>("");
  const [pick, setPick] = useState("");

  const paid = billing === "paid";
  const retrying = !paid;
  /** Top-bar pill, as the board computes it: retrying or paid. */
  const topbar = paid
    ? { tone: "success" as const, label: "Subscription paid" }
    : { tone: "warning" as const, label: "Payment retrying · grace to 31 Oct" };

  const dialog = DIALOGS[dlg || "pay"];
  const opts = data.options.filter((o) => o.dialog === (dlg || "pay"));
  const chosen = pick || optionKey(opts.find((o) => o.isDefault) ?? opts[0]);

  const open = (which: Exclude<DialogId, "">) => {
    setPick("");
    setDlg(which);
  };

  const invoices = data.invoices.map((inv) => {
    const override = paid ? inv.byState?.paid : undefined;
    return override ? { ...inv, ...override } : inv;
  });

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <TopbarStatus kind="chip" tone={topbar.tone} dot={topbar.tone} label={topbar.label} />
      <PageHeader
        eyebrow={`${businessName} · Business`}
        title="Plan and Billing"
        description="Your Injishi subscription only. Guest invoices and outlet invoices are separate and live in Finance."
        actions={
          <>
            <Button variant="ghost" onPress={() => open("cancel")}>
              Cancel subscription
            </Button>
            <Button variant="secondary" onPress={() => open("plan")}>
              <ArrowsRotateRight className="size-4" />
              Change plan
            </Button>
          </>
        }
      />

      {retrying ? (
        <Alert status="warning" role="status">
          <Alert.Indicator>
            <TriangleExclamation />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>The October charge has not gone through</Alert.Title>
            <Alert.Description>
              MTN MoMo +250 78• ••• 214 declined on 1 Oct and 4 Oct: insufficient balance (provider ref
              MP261004.0700.R11872). Next automatic retry 15 Oct 07:00. Grace period runs to 31 Oct; nothing is switched
              off before then.
            </Alert.Description>
          </Alert.Content>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="secondary" onPress={() => unavailable("Updating the payment method")}>
              Update method
            </Button>
            <Button size="sm" onPress={() => open("pay")}>
              Pay now
            </Button>
          </div>
        </Alert>
      ) : null}
      {paid ? (
        <Alert status="success" role="status">
          <Alert.Indicator>
            <CircleCheck />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>October subscription paid</Alert.Title>
            <Alert.Description>
              MTN MoMo · ref MP261001.0700.R44120 · verified 1 Oct 07:01. Injishi’s fiscal receipt for this invoice is
              issued.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}

      <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k))} className="w-full gap-5">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Billing views" className="justify-start">
            <Tabs.Tab id="ov" className="w-auto px-3">
              Overview
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="inv" className="w-auto gap-2 px-3">
              Invoices
              <Chip size="sm">{data.invoices.length}</Chip>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="ov" className="flex flex-col gap-4">
          <div className="grid items-stretch gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
            <Card aria-labelledby="plan-h" className="gap-3 p-[18px]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted">Current plan</span>
                  <h2 id="plan-h" className="text-xl leading-7 font-[650]">
                    Group
                  </h2>
                </div>
                <Chip size="sm" variant="soft">
                  Version 2026.2 · from 1 Jul 2026
                </Chip>
              </div>
              <p className="text-[15px] font-semibold tabular">
                {PRICE} <span className="text-[13px] font-normal text-muted">per month, in RWF</span>
              </p>
              <p className="text-xs leading-[17px] text-muted">
                Up to 5 properties. Billed on the 1st of each month to the business.
              </p>
              <StepTimeline steps={data.activation} />
            </Card>

            <Card aria-labelledby="next-h" className="gap-3 p-[18px]">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted">Next invoice</span>
                <h2 id="next-h" className="text-xl leading-7 font-[650]">
                  1 November 2026
                </h2>
              </div>
              <ul className="flex flex-col gap-2">
                {data.nextLines.map((n) => (
                  <li key={n.id} className="flex justify-between gap-2 text-[13px]">
                    <span className="flex flex-col">
                      <span>{n.label}</span>
                      <span className="text-xs text-muted">{n.sub}</span>
                    </span>
                    <span className="text-right text-xs text-muted tabular">{PRICE}</span>
                  </li>
                ))}
              </ul>
              <Separator />
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">Estimated total</span>
                <span className="text-[13px] font-semibold tabular">{PRICE}</span>
              </div>
              <p className="text-xs leading-4 text-muted">
                {paid
                  ? "Charged to MTN MoMo on 1 Nov at 07:00."
                  : "Charged to MTN MoMo on 1 Nov at 07:00, together with any unpaid October balance."}
              </p>
            </Card>

            <Card aria-labelledby="pm-h" className="gap-3 p-[18px]">
              <div className="flex items-center justify-between gap-2">
                <h2 id="pm-h" className="text-[15px] leading-[22px] font-semibold">
                  Payment Method
                </h2>
                <Button size="sm" variant="ghost" onPress={() => unavailable("Editing the payment method")}>
                  Edit
                </Button>
              </div>
              {data.methods.map((m) => (
                <ItemCard key={m.id} variant="secondary">
                  <ItemCard.Icon>
                    <Icon name={m.icon} />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title>{m.title}</ItemCard.Title>
                    <ItemCard.Description className="whitespace-normal">{m.description}</ItemCard.Description>
                  </ItemCard.Content>
                </ItemCard>
              ))}
              <p className="text-xs leading-4 text-muted">
                <Lock className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
                Card payments are not available yet: the GT Bank card service is not live in production.
              </p>
            </Card>
          </div>

          <div className="flex flex-wrap items-start gap-4">
            <section className="flex min-w-0 flex-[2_1_560px] flex-col gap-2.5" aria-labelledby="ent-h">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 id="ent-h" className="text-[15px] leading-[22px] font-semibold">
                  What Your Plan Includes
                </h2>
                <span className="text-xs text-muted">Usage at 12 Oct · changes apply with an audit entry</span>
              </div>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="What your plan includes">
                    <Table.Header>
                      <Table.Column isRowHeader>Module</Table.Column>
                      <Table.Column>Included</Table.Column>
                      <Table.Column>Used</Table.Column>
                      <Table.Column>Status</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {data.entitlements.map((e) => (
                        <Table.Row key={e.id} id={e.id}>
                          <Table.Cell className="font-medium">{e.name}</Table.Cell>
                          <Table.Cell className="text-[13px]">{e.included}</Table.Cell>
                          <Table.Cell className="min-w-[140px]">
                            <span className="flex flex-col gap-1">
                              <span className="text-[13px] tabular">{e.used}</span>
                              {e.usedPct > 0 ? (
                                <ProgressBar value={e.usedPct} size="sm" aria-label={`${e.name} used`}>
                                  <ProgressBar.Track>
                                    <ProgressBar.Fill />
                                  </ProgressBar.Track>
                                </ProgressBar>
                              ) : null}
                            </span>
                          </Table.Cell>
                          <Table.Cell>
                            <Chip size="sm" variant="soft" color={toneColor(e.tone)} className="whitespace-nowrap">
                              {e.status}
                            </Chip>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </section>

            <Card aria-labelledby="ret-h" className="min-w-0 flex-[1_1_300px] gap-3 p-[18px]">
              <Card.Header>
                <Card.Title id="ret-h" className="text-[15px] font-semibold">
                  Retries and Grace Period
                </Card.Title>
                <Card.Description>
                  {paid
                    ? "All charges confirmed"
                    : "Automatic retries for INJ-2026-1001. Nothing is switched off during the grace period."}
                </Card.Description>
              </Card.Header>
              {paid ? (
                <EmptyState size="sm">
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <CircleCheck />
                    </EmptyState.Media>
                    <EmptyState.Title>No retries needed</EmptyState.Title>
                    <EmptyState.Description>
                      Every charge this year was confirmed by the provider on the first attempt.
                    </EmptyState.Description>
                  </EmptyState.Header>
                </EmptyState>
              ) : (
                <StepTimeline steps={data.retries} />
              )}
            </Card>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="inv" className="flex flex-col gap-4">
          <section className="flex flex-col gap-2.5" aria-labelledby="inv-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="inv-h" className="text-[15px] leading-[22px] font-semibold">
                Subscription Invoices
              </h2>
              <Button size="sm" variant="secondary" onPress={() => unavailable("Downloading invoices")}>
                <ArrowDownToLine className="size-4" />
                Download all
              </Button>
            </div>
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Subscription invoices">
                  <Table.Header>
                    <Table.Column isRowHeader>Invoice</Table.Column>
                    <Table.Column>Period</Table.Column>
                    <Table.Column>Amount</Table.Column>
                    <Table.Column>Status and evidence</Table.Column>
                    <Table.Column>
                      <span className="sr-only">Download</span>
                    </Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {invoices.map((i) => (
                      <Table.Row key={i.id} id={i.id}>
                        <Table.Cell className="font-medium tabular">{i.id}</Table.Cell>
                        <Table.Cell className="text-[13px]">{i.period}</Table.Cell>
                        <Table.Cell className="text-xs text-muted">{PRICE}</Table.Cell>
                        <Table.Cell>
                          <span className="flex flex-wrap items-center gap-2">
                            <Chip size="sm" variant="soft" color={toneColor(i.tone)}>
                              {i.status}
                            </Chip>
                            <span className="text-xs text-muted">{i.evidence}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            aria-label={`Download ${i.id}`}
                            className="ml-auto"
                            onPress={() => unavailable(`Downloading ${i.id}`)}
                          >
                            <ArrowDownToLine className="size-4" />
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </section>

          <Card variant="secondary" aria-labelledby="sep-h" className="gap-2.5 px-[18px] py-4">
            <h2 id="sep-h" className="text-[15px] leading-[22px] font-semibold">
              Three Kinds of Invoice, Kept Apart
            </h2>
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
              {data.invoiceKinds.map((k) => (
                <NextLink key={k.id} href={screenHref(k.board)} className="block text-inherit no-underline">
                  <ItemCard className="h-full items-start">
                    <ItemCard.Icon>
                      <Icon name={k.icon} />
                    </ItemCard.Icon>
                    <ItemCard.Content>
                      <ItemCard.Title>{k.title}</ItemCard.Title>
                      <ItemCard.Description className="whitespace-normal">{k.description}</ItemCard.Description>
                    </ItemCard.Content>
                  </ItemCard>
                </NextLink>
              ))}
            </div>
          </Card>
        </Tabs.Panel>
      </Tabs>

      <Modal.Backdrop isOpen={dlg !== ""} onOpenChange={(o) => (o ? null : setDlg(""))}>
        <Modal.Container>
          <Modal.Dialog aria-labelledby="dlg-h" className="sm:max-w-[480px]">
            <Modal.Header className="flex-col items-start gap-1">
              <Modal.Heading id="dlg-h" className="text-lg leading-[26px] font-semibold">
                {dialog.title}
              </Modal.Heading>
              <p className="text-sm leading-5 text-muted">{dialog.sub}</p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <RadioButtonGroup
                aria-label={dialog.title}
                layout="grid"
                className="grid-cols-1 gap-2"
                value={chosen}
                onChange={setPick}
              >
                {opts.map((o) => (
                  <RadioButtonGroup.Item
                    key={o.id}
                    value={optionKey(o)}
                    isDisabled={o.isDisabled}
                    className="px-3.5 py-3"
                  >
                    <RadioButtonGroup.ItemContent className="w-full">
                      <span className="flex w-full items-center justify-between gap-2 pr-6">
                        <span className="text-sm font-semibold">{o.title}</span>
                        {o.right ? <span className="text-xs text-muted tabular">{o.right}</span> : null}
                      </span>
                      {o.description ? <span className="text-xs leading-4 text-muted">{o.description}</span> : null}
                    </RadioButtonGroup.ItemContent>
                    <RadioButtonGroup.Indicator />
                  </RadioButtonGroup.Item>
                ))}
              </RadioButtonGroup>
              {dialog.code ? (
                <Card variant="secondary" className="gap-1.5 px-3.5 py-3">
                  <TextField isDisabled className="flex flex-col gap-1">
                    <Label>Verify it’s you</Label>
                    <Input
                      placeholder="6-digit code"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      className="max-w-[200px] tracking-[0.2em]"
                    />
                    <Description>Step-up is not asked for: cancelling is not available yet.</Description>
                  </TextField>
                </Card>
              ) : null}
            </Modal.Body>
            <Modal.Footer className="flex-wrap items-center justify-end gap-2">
              <span id="bill-why" className="mr-auto max-w-[280px] text-xs leading-4 text-muted">
                Subscription billing is not connected yet, so nothing can be paid, changed or cancelled here.
              </span>
              <Button variant="secondary" onPress={() => setDlg("")}>
                Close
              </Button>
              <Button variant={dialog.danger ? "danger" : "primary"} isDisabled aria-describedby="bill-why">
                {dialog.ok}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </PageContent>
  );
}
