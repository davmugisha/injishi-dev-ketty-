"use client";

import {
  ArrowRightFromSquare,
  ArrowsRotateRight,
  Briefcase,
  BroomMotion,
  Check,
  CircleCheck,
  Comments,
  Key,
  Lock,
  PaperPlane,
  Receipt,
  Wallet,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Separator,
  Switch,
  Table,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { Stepper } from "@heroui-pro/react";
import type { CheckoutCase, CheckoutLedgerLine, Persona } from "@injishi/product-pms";
import { useBoardHref, usePmsActions } from "@injishi/product-pms/web";
import { KeyValueList, LinkButton, PageContent, PageHeader } from "@injishi/ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CardHeading, Note, rwf, StatTile, ToneChip } from "./parts";

export type ReceiptOutcome = "pending" | "issued" | "unknown";
export type MomoState = "idle" | "pending" | "unknown" | "verified";

/**
 * What the page hands the screen: the next guest due out and the evidence behind their balance, read live.
 * The prototype's MoMo trail, fiscal receipt drafts and key list (payments in flight, a receipt list and key
 * cards have no table) are not read at all, so nothing of theirs can be drawn as this guest's.
 */
interface CheckoutData {
  checkout: CheckoutCase;
  ledger: CheckoutLedgerLine[];
}

type StepStatus = "complete" | "active" | "inactive";

const kigaliClock = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kigali",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

export function CheckoutView({
  data,
}: {
  persona: Persona;
  data: CheckoutData;
  /** The prototype's state switches (`?receipt=`, `?momo=`); the live screen shows what the API says. */
  receipt?: ReceiptOutcome;
  initialMomo?: MomoState;
}) {
  const screenHref = useBoardHref();
  const { checkOutGuest } = usePmsActions();
  const c = data.checkout;
  const router = useRouter();
  const [cardsBack, setCardsBack] = useState(false);
  const [checkedAt, setCheckedAt] = useState(kigaliClock);
  const [done, setDone] = useState<{ title: string; text: string } | null>(null);
  const [busy, startBusy] = useTransition();

  const unavailable = (what: string) => toast.warning(`${what} is not available yet. Nothing was changed.`);
  const stayHref = `/stays/${encodeURIComponent(c.stayId)}`;
  const company = c.companyShare > 0 && !!c.company;

  const ledger = data.ledger.filter((l) => !l.afterGuestPaid);
  const posted = ledger.filter((l) => l.item.startsWith("Charges")).reduce((n, l) => n + (l.amount ?? 0), 0);
  const paid = -ledger.filter((l) => !l.item.startsWith("Charges")).reduce((n, l) => n + (l.amount ?? 0), 0);
  const settled = c.guestShare === 0;
  const windows = [
    {
      label: "Balance due now",
      amount: rwf(c.guestShare),
      note: settled ? `Folio ${c.folioId} can close` : "Take it on the stay's bill before checkout",
    },
    { label: "Charges posted", amount: rwf(posted), note: "Every line with its VAT" },
    { label: "Paid on the bill", amount: rwf(paid), note: "Confirmed money only" },
  ];

  /** Read the bill again from the API (the page re-reads the desk's day). */
  const refresh = () => {
    router.refresh();
    setCheckedAt(kigaliClock());
  };

  const steps: { label: string; hint: string; status: StepStatus }[] = [
    { label: "Balance", hint: `Read ${checkedAt}`, status: "complete" },
    {
      label: "Settle",
      hint: settled ? "Nothing left to pay" : `${rwf(c.guestShare)} open`,
      status: settled ? "complete" : "active",
    },
    { label: "Receipts", hint: "From the bill's close", status: settled ? "active" : "inactive" },
    { label: "Keys", hint: cardsBack ? "Collected" : "Physical key", status: cardsBack ? "complete" : "inactive" },
    { label: "Depart", hint: "Not yet", status: "inactive" },
  ];
  const firstOpen = Math.max(
    0,
    steps.findIndex((s) => s.status !== "complete"),
  );

  const blockers: string[] = [];
  if (!settled)
    blockers.push(
      `${c.guest} still owes ${rwf(c.guestShare)} on folio ${c.folioId}. Take it on the stay's bill first.`,
    );

  /** Complete checkout: POST /ops/stays/:id/checkout closes the stay and a bill settled to zero. */
  const complete = () => {
    if (blockers.length || busy) return;
    const guest = c.guest;
    startBusy(async () => {
      const result = await checkOutGuest(c.stayId, "Checkout");
      if (!result.ok) {
        toast.danger(`${guest} was not checked out: ${result.error}`);
        return;
      }
      const out = result.value;
      const bill =
        out.folioStatus === "closed"
          ? `folio ${out.folioNumber} closed and locked`
          : `folio ${out.folioNumber ?? ""} left open with ${rwf(out.balanceRwf)} for Finance`;
      setDone({
        title: `${out.guest} checked out at ${kigaliClock()}`,
        text: `Stay ${c.stayId} closed · ${bill} · room ${out.room} set to Dirty for housekeeping.`,
      });
      toast.success(`${out.guest} checked out · room ${out.room} set to Dirty`);
    });
  };

  return (
    <PageContent>
      <Toast.Provider placement="bottom" />
      <PageHeader
        eyebrow={
          <>
            <NextLink href={screenHref("FrontDeskToday")} className="text-inherit no-underline hover:underline">
              Front desk
            </NextLink>
            <span aria-hidden="true">›</span>
            <span>Departures</span>
            <span aria-hidden="true">›</span>
            <span>Room {c.room}</span>
          </>
        }
        title={`Check Out ${c.guest} · Room ${c.room}`}
        description={`Stay ${c.stayId} · Folio ${c.folioId} · due out ${c.dueOut}. The next guest due out; others check out from their stay's page.`}
        actions={
          <>
            <LinkButton href={stayHref} variant="secondary">
              <Receipt className="size-4" />
              Open stay and folio
            </LinkButton>
            <LinkButton href={screenHref("Messages")} variant="ghost">
              <Comments className="size-4" />
              Message guest
            </LinkButton>
            <Button isDisabled={blockers.length > 0 || busy} onPress={complete}>
              <ArrowRightFromSquare className="size-4" />
              Complete checkout
            </Button>
          </>
        }
      />

      <Stepper size="sm" aria-label="Checkout progress" currentStep={firstOpen}>
        {steps.map((s, i) => (
          <Stepper.Step key={s.label} data-status={s.status}>
            <Stepper.Indicator data-status={s.status}>
              {s.status === "complete" ? <Check className="size-3" aria-hidden="true" /> : i + 1}
            </Stepper.Indicator>
            <Stepper.Content>
              <Stepper.Title>{s.label}</Stepper.Title>
              <Stepper.Description className="text-[12px] leading-4 text-muted">{s.hint}</Stepper.Description>
            </Stepper.Content>
            <Stepper.Separator progress={s.status === "complete" ? 1 : 0} />
          </Stepper.Step>
        ))}
      </Stepper>

      {done ? (
        <Alert status="success" role="status">
          <Alert.Indicator>
            <CircleCheck />
          </Alert.Indicator>
          <Alert.Content>
            <Alert.Title>{done.title}</Alert.Title>
            <Alert.Description>{done.text} The next guest due out is shown below.</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {blockers.length ? (
        <Note icon="Lock" iconClassName="text-danger" lead="Not ready to check out." role="status">
          {blockers.join(" ")}
        </Note>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_600px] flex-col gap-4">
          <Card aria-labelledby="b-h" className="gap-3 p-[18px]">
            <CardHeading
              id="b-h"
              title="1 · Verify the Balance"
              sub={`Posted charges against confirmed payments · read ${checkedAt}`}
              action={
                <Button size="sm" variant="secondary" onPress={refresh}>
                  <ArrowsRotateRight className="size-4" />
                  Refresh payments
                </Button>
              }
            />
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Balance evidence">
                  <Table.Header>
                    <Table.Column isRowHeader>Item</Table.Column>
                    <Table.Column>Evidence</Table.Column>
                    <Table.Column>State</Table.Column>
                    <Table.Column className="text-right">Amount</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {ledger.map((l) => (
                      <Table.Row key={l.id} id={l.id}>
                        <Table.Cell className="font-medium">{l.item}</Table.Cell>
                        <Table.Cell className="text-[12px] leading-4 text-muted tabular">{l.evidence}</Table.Cell>
                        <Table.Cell>
                          <ToneChip tone={l.tone} className="h-auto max-w-[200px] py-0.5 whitespace-normal">
                            {l.state}
                          </ToneChip>
                        </Table.Cell>
                        <Table.Cell className="text-right whitespace-nowrap tabular">
                          {l.amount === null ? "Not counted" : rwf(l.amount)}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))]">
              {windows.map((w) => (
                <StatTile key={w.label}>
                  <span className="text-[12px] text-muted">{w.label}</span>
                  <span className="text-[18px] leading-6 font-semibold tabular">{w.amount}</span>
                  <span className="text-[12px] leading-4 text-muted">{w.note}</span>
                </StatTile>
              ))}
            </div>
          </Card>

          <Card aria-labelledby="s-h" className="gap-3.5 p-[18px]">
            <CardHeading
              id="s-h"
              title="2 · Settle What Is Left"
              sub={
                company
                  ? `The booking routes room nights and meals to ${c.company}.`
                  : "Everything on this bill is the guest's to settle."
              }
            />

            {company ? (
              <Card variant="secondary" className="gap-2.5 px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[14px] font-semibold">Company share · {c.company}</span>
                    <span className="text-[12px] text-muted tabular">
                      {c.companyTin} · city ledger {c.cityLedger}
                    </span>
                  </div>
                  <ToneChip tone="accent">Moved to company ledger</ToneChip>
                </div>
                <KeyValueList items={c.transfer.map((t) => ({ label: t.label, value: t.value }))} />
              </Card>
            ) : null}

            <Card variant="secondary" className="gap-2.5 px-4 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="text-[14px] font-semibold">Guest share · {c.guest}</span>
                  <span className="text-[12px] text-muted">{c.guestShareDetail}</span>
                </div>
                <ToneChip tone={settled ? "success" : "warning"}>
                  {settled ? "Settled" : `${rwf(c.guestShare)} open`}
                </ToneChip>
              </div>
              {settled ? null : (
                <>
                  <div className="flex flex-wrap items-end gap-3">
                    <TextField defaultValue={c.momoPhone} className="flex-[1_1_200px]">
                      <Label>Mobile money number</Label>
                      <Input variant="secondary" className="tabular" />
                    </TextField>
                    <div className="flex flex-[0_1_160px] flex-col gap-1">
                      <span className="text-sm font-medium">Amount</span>
                      <span className="flex h-9 items-center font-semibold tabular">{rwf(c.guestShare)}</span>
                    </div>
                    <Button onPress={() => unavailable("A MoMo payment request from the desk")}>
                      <PaperPlane className="size-4" />
                      Send MoMo request
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <LinkButton href={stayHref} size="sm" variant="secondary">
                      <Wallet className="size-4" />
                      Take cash on the bill
                    </LinkButton>
                    <span className="text-[12px] text-muted">
                      Mobile money prompts from the desk are not connected yet. Cash is recorded on the stay's page.
                    </span>
                  </div>
                </>
              )}
            </Card>
          </Card>
        </div>

        <div className="flex min-w-0 max-w-[470px] flex-[1_1_380px] flex-col gap-4">
          <Card aria-labelledby="f-h" className="gap-3 p-[18px]">
            <CardHeading
              id="f-h"
              title="3 · Fiscal Receipts and Invoice"
              sub="One fiscal receipt per bill, from the moment the bill closes"
            />
            <Card variant="secondary" className="gap-2.5 px-4 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <span className="text-[14px] font-semibold">Fiscal receipt · folio {c.folioId}</span>
                  <span className="text-[12px] text-muted tabular">Buyer {c.guest}</span>
                </div>
                <ToneChip tone="default">{settled ? "Closed at checkout" : "Waiting for settlement"}</ToneChip>
              </div>
              <span className="text-[13px] leading-[18px]">
                {settled
                  ? "Completing checkout closes and locks the bill, which is the fiscal act. This screen does not show the fiscal receipt yet."
                  : "Not requested yet. A bill closes only once it is settled to zero."}
              </span>
            </Card>
            {company ? (
              <div className="flex items-start gap-2.5 pt-0.5">
                <Briefcase className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[14px] font-medium">
                    Commercial invoice {c.invoice.number} · {c.company}
                  </span>
                  <span className="text-[12px] leading-4 text-muted tabular">
                    {c.companyTin} · {rwf(c.companyShare)} · due {c.invoice.due}
                  </span>
                </div>
                <ToneChip tone="default">Commercial invoice</ToneChip>
              </div>
            ) : null}
          </Card>

          <Card aria-labelledby="k-h" className="gap-3 p-[18px]">
            <CardHeading
              id="k-h"
              title="4 · Keys and Departure"
              sub="No lock provider is connected: keys are physical"
            />
            <Checkbox isSelected={cardsBack} onChange={setCardsBack}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                Key cards collected at the desk
              </Checkbox.Content>
            </Checkbox>
            <p className="text-[12px] leading-4 text-muted">A reminder for the desk; returned keys are not recorded.</p>
            <Button variant="secondary" className="self-start" onPress={() => unavailable("Revoking digital keys")}>
              <Key className="size-4" />
              Revoke keys for {c.room}
            </Button>
            <Separator />
            <Switch isSelected={false} isDisabled>
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                Send departure survey by email
              </Switch.Content>
            </Switch>
            <p className="text-[12px] leading-4 text-muted">
              Departure surveys are not connected yet; nothing is sent.
            </p>
            <p className="flex items-center gap-2 text-[13px]">
              <BroomMotion className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>Room {c.room} goes to Dirty on checkout.</span>
            </p>
            <p className="flex items-center gap-2 text-[12px] text-muted">
              <Lock className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Only the stay's own bill is closed here; a bill in credit is left open for Finance.</span>
            </p>
          </Card>
        </div>
      </div>
    </PageContent>
  );
}
