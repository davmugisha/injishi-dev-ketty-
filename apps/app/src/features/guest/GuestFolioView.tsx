"use client";

import {
  ArrowDownToLine,
  ArrowsRotateRight,
  Briefcase,
  ChevronRight,
  CircleCheck,
  CircleCheckFill,
  CircleQuestion,
  Comments,
  QrCode,
  Smartphone,
  Star,
} from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Input,
  Label,
  Spinner,
  Tabs,
  TextField,
} from "@heroui/react";
import { ItemCard, ListView, RadioButtonGroup } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  FolioCharge,
  FolioPayment,
  GuestFolioRecord,
  GuestTone,
  PaymentMethod,
} from "@injishi/data/fixtures/guest";
import { formatNumber, formatRwf, Icon, KeyValueList, LinkButton, PhoneBody, toneColor } from "@injishi/ui";
import { useState } from "react";
import { PhoneSheet } from "@/components/phone/PhoneSheet";
import { CardHeading, GuestTop, InitialsAvatar, renderAnchor, ScreenHeading, useGuestLang } from "./parts";

export type FolioStage = "in-stay" | "checked-out";
export type FolioPaymentState = "ready" | "pending" | "unknown" | "verified";

const TITLES = { en: "Your bill", rw: "Fagitire yawe", fr: "Votre note" } as const;

interface GuestFolioData {
  folio: GuestFolioRecord;
  charges: FolioCharge[];
  payments: FolioPayment[];
  methods: PaymentMethod[];
  initials: string;
  property: string;
}

/** Guest · bill and receipts: balance, charges, payments and documents. */
export function GuestFolioView({
  data,
  stage,
  payment,
}: {
  data: GuestFolioData;
  stage: FolioStage;
  payment: FolioPaymentState;
}) {
  const { folio, charges, payments, methods, initials, property } = data;
  const [lang, setLang] = useGuestLang();
  const [tab, setTab] = useState("charges");
  const [pay, setPay] = useState<FolioPaymentState | null>(null);
  const [sheet, setSheet] = useState(false);
  const [method, setMethod] = useState(methods.find((m) => m.available)?.id ?? "mtn");
  const [checks, setChecks] = useState(0);
  const [momo, setMomo] = useState(folio.momoNumber);
  const [airtel, setAirtel] = useState("");
  const [co, setCo] = useState("");
  const [tin, setTin] = useState("");
  const [coError, setCoError] = useState(false);
  const [tinError, setTinError] = useState(false);
  const [invSent, setInvSent] = useState(false);

  const out = stage === "checked-out";
  const payState: FolioPaymentState = out ? "verified" : (pay ?? payment);
  const shownCharges = charges.filter((c) => c.stage === "both" || c.stage === (out ? "checked-out" : "in-stay"));
  const postedTotal = shownCharges.filter((c) => !c.upcoming).reduce((sum, c) => sum + c.amount, 0);

  const rows = payments.flatMap((p) => {
    const row = paymentRow(p, payState, out);
    return row ? [{ ...p, ...row }] : [];
  });
  const paid = rows.filter((r) => r.status === "Verified").reduce((sum, r) => sum + r.amount, 0);
  const balanceNow = Math.max(postedTotal - paid, 0);
  const balancePay = payments.find((p) => p.kind === "balance");
  const inFlight = payState === "pending" || payState === "unknown";

  let balLabel = "To pay now";
  let balChip = "Open";
  let balTone: GuestTone = "default";
  let balNote = `About ${formatRwf(balanceNow + folio.nextNight)} at checkout, once tonight’s room night is added.`;
  if (inFlight && balancePay) {
    balChip = payState === "pending" ? "Payment pending" : "Payment unknown";
    balTone = "warning";
    balNote = `${formatRwf(balancePay.amount)} is on its way but isn’t counted until MTN confirms it.`;
  }
  if (payState === "verified" && !out) {
    balChip = "Up to date";
    balTone = "success";
    balNote = `About ${formatRwf(folio.nextNight)} left at checkout, once tonight’s room night is added.`;
  }
  if (out) {
    balLabel = "Balance";
    balChip = "Paid in full";
    balTone = "success";
    balNote = `Bill closed ${folio.closedAt} · ${formatRwf(postedTotal)} charged, ${formatRwf(paid)} paid.`;
  }

  const receipts = rows.filter((r) => r.status === "Verified");
  const docCount = receipts.length + 1 + (out ? 1 : 0);
  const isAirtel = method === "airtel";
  const tinDigits = tin.replace(/\D/g, "");

  const submitInv = () => {
    const coBad = co.trim().length < 3;
    const tinBad = tinDigits.length !== 9;
    setCoError(coBad);
    setTinError(tinBad);
    if (!coBad && !tinBad) setInvSent(true);
  };

  return (
    <>
      <GuestTop
        lead={<InitialsAvatar initials={initials} />}
        title={property}
        sub={`Bill ${folio.id} · room ${folio.room}`}
        lang={lang}
        onLang={setLang}
      />
      <PhoneBody className="gap-[14px]">
        <ScreenHeading
          title={TITLES[lang]}
          sub={
            out
              ? `Checked out ${folio.checkedOutOn} · stay ${folio.stay}`
              : `Live from the hotel · updated ${folio.updatedAt}`
          }
        />

        <Card aria-labelledby="bal-h" className="shrink-0 gap-3 p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <h2 id="bal-h" className="text-[12px] leading-4 font-medium text-muted">
                {balLabel}
              </h2>
              <span className="text-[30px] leading-9 font-semibold tracking-[-0.02em] tabular">
                {formatRwf(balanceNow)}
              </span>
            </div>
            <Chip variant="soft" color={toneColor(balTone)}>
              {balChip}
            </Chip>
          </div>
          <p className="text-[12px] leading-4 text-muted tabular">{balNote}</p>

          {payState === "ready" && !out ? (
            <Button size="lg" fullWidth onPress={() => setSheet(true)}>
              <Smartphone className="size-4" />
              Pay {formatRwf(balanceNow)} now
            </Button>
          ) : null}
          {payState === "pending" && balancePay ? (
            <>
              <Alert role="status">
                <Alert.Indicator>
                  <Spinner size="sm" aria-hidden="true" />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Pending · approve on your phone</Alert.Title>
                  <Alert.Description className="tabular">
                    We sent an MTN MoMo request for {formatRwf(balancePay.amount)} to {folio.momoNumber} (
                    {balancePay.id}
                    ). Enter your MoMo PIN to approve. No prompt? Check MoMo’s pending approvals.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
              <Button variant="secondary" onPress={() => check(payState, checks, setPay, setChecks)}>
                <ArrowsRotateRight className="size-4" />
                I’ve approved, check status
              </Button>
            </>
          ) : null}
          {payState === "unknown" && balancePay ? (
            <>
              <Alert status="warning" role="status">
                <Alert.Indicator>
                  <CircleQuestion />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Unknown · checking with MTN</Alert.Title>
                  <Alert.Description className="tabular">
                    MTN hasn’t answered yet about {formatRwf(balancePay.amount)} ({balancePay.id}). Your phone may
                    already have approved it, so please don’t pay again. Last checked {balancePay.lastCheckedAt}.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
              <Button variant="secondary" onPress={() => check(payState, checks, setPay, setChecks)}>
                <ArrowsRotateRight className="size-4" />
                Check again
              </Button>
            </>
          ) : null}
          {payState === "verified" && balancePay ? (
            <Alert status="success" role="status">
              <Alert.Indicator>
                <CircleCheck />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>{out ? "All payments verified" : "Payment verified"}</Alert.Title>
                <Alert.Description className="tabular">
                  {out
                    ? `${rows.length} MTN MoMo payments, each confirmed by MTN. Receipts are in Documents.`
                    : `${formatRwf(balancePay.amount)} · MTN MoMo · ref ${balancePay.providerRef} · confirmed by MTN at ${balancePay.confirmedAt}.`}
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
        </Card>

        <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Bill details">
              {(
                [
                  ["charges", "Charges", shownCharges.length],
                  ["payments", "Payments", rows.length],
                  ["docs", "Documents", docCount],
                ] as const
              ).map(([id, label, count]) => (
                <Tabs.Tab key={id} id={id} className="w-auto whitespace-nowrap">
                  {label}
                  <Chip size="sm" className="ms-1.5 tabular">
                    {count}
                  </Chip>
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="charges" className="flex flex-col gap-2 p-0">
            <ListView aria-label="Charges" items={shownCharges}>
              {(c) => (
                <ListView.Item id={c.id} textValue={c.title} className="items-start">
                  <ListView.ItemContent className="items-start">
                    <Icon name={c.icon} className="mt-0.5 size-4 shrink-0 text-muted" />
                    <div className="flex min-w-0 flex-col">
                      <ListView.Title className="whitespace-normal">{c.title}</ListView.Title>
                      <ListView.Description className="whitespace-normal tabular">{c.meta}</ListView.Description>
                      {c.upcoming ? (
                        <Chip size="sm" variant="soft" className="mt-1 self-start">
                          Not posted yet
                        </Chip>
                      ) : null}
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction
                    className={`font-semibold whitespace-nowrap tabular ${c.upcoming ? "text-muted" : ""}`}
                  >
                    {formatNumber(c.amount)}
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
            <div className="flex items-center justify-between px-1">
              <span className="font-semibold">Posted so far</span>
              <span className="font-semibold tabular">{formatRwf(postedTotal)}</span>
            </div>
            <p className="px-1 text-[12px] leading-4 text-muted">
              Tax codes are set up by the hotel; your EBM fiscal receipt is the official tax breakdown. Coffee from
              Ikawa Corner isn’t on this bill: it’s a separate business with its own receipts.
            </p>
            <LinkButton href={screenHref("GuestRequests")} variant="tertiary" size="sm" className="self-start">
              <Comments className="size-4" />
              Question about a charge?
            </LinkButton>
          </Tabs.Panel>

          <Tabs.Panel id="payments" className="flex flex-col gap-2 p-0">
            {rows.map((p) => (
              <Card key={p.id} className="gap-2 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="font-semibold">{p.title}</span>
                    <span className="text-[12px] leading-4 text-muted">{p.method}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold tabular">{formatRwf(p.amount)}</span>
                    <Chip size="sm" variant="soft" color={toneColor(p.tone)}>
                      {p.status}
                    </Chip>
                  </div>
                </div>
                <p className="text-[12px] leading-4 text-muted tabular">{p.evidence}</p>
              </Card>
            ))}
            <p className="px-1 text-[12px] leading-4 text-muted">
              We count a payment only after the provider confirms it. Refunds, if any, go back to the same MoMo number
              and show here as Pending until MTN confirms.
            </p>
          </Tabs.Panel>

          <Tabs.Panel id="docs" className="flex flex-col gap-2.5 p-0">
            <Card aria-labelledby="ebm-h" className="gap-2.5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <CardHeading id="ebm-h">Fiscal receipt (EBM)</CardHeading>
                  <span className="text-[12px] leading-4 text-muted">
                    The official tax receipt, issued once when your bill closes
                  </span>
                </div>
                <Chip size="sm" variant="soft" color={out ? "success" : "warning"}>
                  {out ? "Issued" : "Pending"}
                </Chip>
              </div>
              {out ? (
                <>
                  <div className="flex items-start gap-3.5">
                    <div
                      role="img"
                      aria-label="Fiscal receipt QR code"
                      className="flex size-[88px] shrink-0 items-center justify-center rounded-xl bg-surface-secondary text-muted"
                    >
                      <QrCode className="size-12" />
                    </div>
                    <KeyValueList
                      className="grid-cols-1! gap-y-0.5 text-[12px] leading-4"
                      items={[
                        { label: "Fiscal number", value: <span className="tabular">{folio.fiscal.number}</span> },
                        { label: "Issued", value: folio.fiscal.issued },
                        { label: "Seller", value: <span className="tabular">{folio.fiscal.seller}</span> },
                      ]}
                    />
                  </div>
                  <Button variant="secondary" size="sm" className="self-start">
                    <ArrowDownToLine className="size-4" />
                    Download PDF
                  </Button>
                </>
              ) : (
                <p className="text-[13px] leading-[18px] text-muted">
                  Issued by the hotel’s EBM when your bill is closed at checkout. You’ll get it here and by email. If
                  something is wrong after that, it’s corrected with a credit note, never edited.
                </p>
              )}
            </Card>

            <Card aria-labelledby="pr-h" className="gap-2 p-4">
              <div className="flex flex-col">
                <CardHeading id="pr-h">Payment Receipts</CardHeading>
                <span className="text-[12px] leading-4 text-muted">Proof you paid. Not a tax document.</span>
              </div>
              {receipts.map((r) => (
                <ItemCard key={r.id} variant="secondary">
                  <ItemCard.Icon>
                    <Icon name="FileCheck" />
                  </ItemCard.Icon>
                  <ItemCard.Content>
                    <ItemCard.Title className="tabular">
                      {r.title} · {r.id}
                    </ItemCard.Title>
                    <ItemCard.Description className="tabular">
                      {formatRwf(r.amount)} · {r.date}
                    </ItemCard.Description>
                  </ItemCard.Content>
                  <ItemCard.Action>
                    <Button variant="ghost" size="sm" aria-label={`View ${r.title} · ${r.id}`}>
                      View
                    </Button>
                  </ItemCard.Action>
                </ItemCard>
              ))}
            </Card>

            <Card aria-labelledby="pf-h" className="gap-2 p-4">
              <div className="flex flex-col">
                <CardHeading id="pf-h">Proforma</CardHeading>
                <span className="text-[12px] leading-4 text-muted">
                  The estimate sent when you booked. Not a receipt or invoice.
                </span>
              </div>
              <ItemCard variant="secondary">
                <ItemCard.Icon>
                  <Icon name="FileText" />
                </ItemCard.Icon>
                <ItemCard.Content>
                  <ItemCard.Title className="tabular">Proforma for {folio.booking}</ItemCard.Title>
                  <ItemCard.Description className="tabular">
                    {folio.proforma.date} · {formatRwf(folio.proforma.amount)} for {folio.proforma.nights} nights
                  </ItemCard.Description>
                </ItemCard.Content>
                <ItemCard.Action>
                  <Button variant="ghost" size="sm" aria-label={`View proforma for ${folio.booking}`}>
                    View
                  </Button>
                </ItemCard.Action>
              </ItemCard>
            </Card>

            <Card aria-labelledby="inv-h" className="gap-3 p-4">
              <div className="flex flex-col">
                <CardHeading id="inv-h">Invoice for Your Company</CardHeading>
                <span className="text-[12px] leading-4 text-muted">
                  {out
                    ? "Your fiscal receipt was issued without a company TIN. Issued receipts can’t be edited: the hotel issues a credit note, then a new receipt with your company’s details."
                    : "Add it before checkout: the company name and TIN go on the fiscal receipt and on a commercial invoice (INV-26-…)."}
                </span>
              </div>
              {invSent ? (
                <>
                  <ItemCard variant="secondary" className="items-start">
                    <ItemCard.Icon>
                      <Briefcase />
                    </ItemCard.Icon>
                    <ItemCard.Content>
                      <ItemCard.Title className="whitespace-normal">{co.trim()}</ItemCard.Title>
                      <ItemCard.Description className="whitespace-normal tabular">
                        TIN {tinDigits}
                        {out
                          ? " · finance reviews the credit note and reissue, usually within 1 working day"
                          : " · the front desk confirms before checkout"}
                      </ItemCard.Description>
                    </ItemCard.Content>
                    <ItemCard.Action>
                      <Chip size="sm" variant="soft" color="warning">
                        Requested
                      </Chip>
                    </ItemCard.Action>
                  </ItemCard>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onPress={() => {
                      setInvSent(false);
                      setCo("");
                      setTin("");
                    }}
                  >
                    Change details
                  </Button>
                </>
              ) : (
                <>
                  <TextField
                    fullWidth
                    value={co}
                    onChange={(v) => {
                      setCo(v);
                      setCoError(false);
                    }}
                    isInvalid={coError}
                    className="gap-1"
                  >
                    <Label>Company name</Label>
                    <Input placeholder="As registered with RRA" />
                    <FieldError>Enter the company’s registered name.</FieldError>
                  </TextField>
                  <TextField
                    fullWidth
                    value={tin}
                    onChange={(v) => {
                      setTin(v);
                      setTinError(false);
                    }}
                    isInvalid={tinError}
                    className="gap-1"
                  >
                    <Label>Company TIN</Label>
                    <Input className="tabular" inputMode="numeric" placeholder="9 digits" />
                    <FieldError>A Rwandan TIN has 9 digits. Check it on the company’s RRA certificate.</FieldError>
                    <Description>Printed on the fiscal receipt exactly as entered.</Description>
                  </TextField>
                  <Button variant="secondary" onPress={submitInv}>
                    <Briefcase className="size-4" />
                    {out ? "Request a corrected receipt" : "Request invoice"}
                  </Button>
                </>
              )}
            </Card>
          </Tabs.Panel>
        </Tabs>

        {out ? (
          <ItemCard<"a"> render={renderAnchor(screenHref("GuestReview"))}>
            <ItemCard.Icon>
              <Star />
            </ItemCard.Icon>
            <ItemCard.Content>
              <ItemCard.Title>How was your stay?</ItemCard.Title>
              <ItemCard.Description>Review Isangano and see your points</ItemCard.Description>
            </ItemCard.Content>
            <ItemCard.Action>
              <ChevronRight className="size-4 text-muted" />
            </ItemCard.Action>
          </ItemCard>
        ) : null}
      </PhoneBody>

      <PhoneSheet
        isOpen={sheet}
        onOpenChange={setSheet}
        heading={`Pay ${formatRwf(balanceNow)}`}
        description={`Balance on bill ${folio.id} now. Tonight’s room night is added later and settled at checkout.`}
      >
        <RadioButtonGroup
          aria-label="Payment method"
          value={method}
          onChange={(v) => {
            if (v) setMethod(String(v));
          }}
          className="flex flex-col gap-2"
        >
          {methods.map((m) => (
            <RadioButtonGroup.Item
              key={m.id}
              value={m.id}
              isDisabled={!m.available}
              className="flex-row items-center px-4 py-3 text-left"
            >
              <RadioButtonGroup.Indicator>
                <CircleCheckFill className="size-4" />
              </RadioButtonGroup.Indicator>
              <RadioButtonGroup.ItemIcon>
                <Icon name={m.icon} className="text-muted" />
              </RadioButtonGroup.ItemIcon>
              <RadioButtonGroup.ItemContent className="flex flex-col gap-0.5 ps-2.5">
                <span className="font-semibold">{m.label}</span>
                <span className="text-[12px] leading-4 text-muted tabular">{m.note}</span>
              </RadioButtonGroup.ItemContent>
            </RadioButtonGroup.Item>
          ))}
        </RadioButtonGroup>
        <TextField
          fullWidth
          value={isAirtel ? airtel : momo}
          onChange={isAirtel ? setAirtel : setMomo}
          className="gap-1"
        >
          <Label>{isAirtel ? "Airtel Money number" : "MTN MoMo number"}</Label>
          <Input type="tel" className="tabular" placeholder={isAirtel ? "073 XXX XXXX" : undefined} />
          <Description>You approve on your phone. We mark it paid only when the provider confirms.</Description>
        </TextField>
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onPress={() => setSheet(false)}>
            Cancel
          </Button>
          <Button
            size="lg"
            className="flex-[2]"
            onPress={() => {
              setSheet(false);
              setPay("pending");
              setTab("payments");
            }}
          >
            Send payment request
          </Button>
        </div>
      </PhoneSheet>
    </>
  );
}

function paymentRow(p: FolioPayment, pay: FolioPaymentState, out: boolean) {
  if (p.kind === "deposit") return { status: "Verified", tone: "success" as const, evidence: p.evidence.verified };
  if (p.kind === "final") {
    return out ? { status: "Verified", tone: "success" as const, evidence: p.evidence.verified } : null;
  }
  if (pay === "ready") return null;
  if (pay === "pending") return { status: "Pending", tone: "warning" as const, evidence: p.evidence.pending ?? "" };
  if (pay === "unknown") return { status: "Unknown", tone: "warning" as const, evidence: p.evidence.unknown ?? "" };
  return { status: "Verified", tone: "success" as const, evidence: p.evidence.verified };
}

function check(
  pay: FolioPaymentState,
  checks: number,
  setPay: (p: FolioPaymentState) => void,
  setChecks: (n: number) => void,
) {
  if (pay === "pending" && checks === 0) {
    setPay("unknown");
    setChecks(1);
  } else {
    setPay("verified");
    setChecks(checks + 1);
  }
}
