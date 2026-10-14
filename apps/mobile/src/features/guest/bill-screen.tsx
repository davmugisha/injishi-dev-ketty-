import { screenHref } from "@injishi/data";
import type {
  FolioCharge,
  FolioPayment,
  GuestFolioRecord,
  GuestStayRecord,
  GuestTone,
  PaymentMethod,
} from "@injishi/data/fixtures/guest";
import { Link, useLocalSearchParams } from "expo-router";
import {
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Input,
  Label,
  Radio,
  RadioGroup,
  Spinner,
  TextField,
} from "heroui-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@/components/icon";
import { PhoneBody } from "@/components/phone";
import { getCollection } from "@/lib/store";
import { toneColor } from "@/lib/tone";
import {
  formatNumber,
  formatRwf,
  GuestTop,
  IconTile,
  InitialsAvatar,
  includes,
  KeyValue,
  LineTabs,
  PhoneSheet,
  param,
  ScreenHeading,
  SectionTitle,
  SoftChip,
  StatusAlert,
  useGuestLang,
} from "./ui";

export type FolioStage = "in-stay" | "checked-out";
export type FolioPaymentState = "ready" | "pending" | "unknown" | "verified";
const STAGES = ["in-stay", "checked-out"] as const;
const PAYMENTS = ["ready", "pending", "unknown", "verified"] as const;
const TITLES = { en: "Your bill", rw: "Fagitire yawe", fr: "Votre note" } as const;

/** Guest · bill and receipts. `?stage=` is in-stay or checked-out; `?payment=` is ready, pending, unknown or verified. */
export default function GuestFolioScreen() {
  const search = useLocalSearchParams<{ stage?: string; payment?: string }>();
  const stageParam = param(search.stage);
  const paymentParam = param(search.payment);
  const stage: FolioStage = includes(STAGES, stageParam) ? stageParam : "in-stay";
  const payment: FolioPaymentState = includes(PAYMENTS, paymentParam) ? paymentParam : "ready";

  const folios = getCollection<GuestFolioRecord>("guest.folios");
  const charges = getCollection<FolioCharge>("guest.folioCharges");
  const payments = getCollection<FolioPayment>("guest.folioPayments");
  const methods = getCollection<PaymentMethod>("guest.paymentMethods");
  const stays = getCollection<GuestStayRecord>("guest.stays");
  const folio = folios[0];
  const stay = stays[0];

  const [lang, setLang] = useGuestLang();
  const [tab, setTab] = useState("charges");
  const [pay, setPay] = useState<FolioPaymentState | null>(null);
  const [sheet, setSheet] = useState(false);
  const [method, setMethod] = useState(methods.find((item) => item.available)?.id ?? "mtn");
  const [checks, setChecks] = useState(0);
  const [momo, setMomo] = useState(folio?.momoNumber ?? "");
  const [airtel, setAirtel] = useState("");
  const [company, setCompany] = useState("");
  const [tin, setTin] = useState("");
  const [coError, setCoError] = useState(false);
  const [tinError, setTinError] = useState(false);
  const [invSent, setInvSent] = useState(false);

  if (!folio || !stay || !charges.length) return null;

  const out = stage === "checked-out";
  const payState: FolioPaymentState = out ? "verified" : (pay ?? payment);
  const shownCharges = charges.filter(
    (item) => item.stage === "both" || item.stage === (out ? "checked-out" : "in-stay"),
  );
  const postedTotal = shownCharges.filter((item) => !item.upcoming).reduce((sum, item) => sum + item.amount, 0);
  const rows = payments.flatMap((item) => {
    const row = paymentRow(item, payState, out);
    return row ? [{ ...item, ...row }] : [];
  });
  const paid = rows.filter((row) => row.status === "Verified").reduce((sum, row) => sum + row.amount, 0);
  const balanceNow = Math.max(postedTotal - paid, 0);
  const balancePay = payments.find((item) => item.kind === "balance");
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

  const receipts = rows.filter((row) => row.status === "Verified");
  const docCount = receipts.length + 1 + (out ? 1 : 0);
  const isAirtel = method === "airtel";
  const tinDigits = tin.replace(/\D/g, "");

  const submitInv = () => {
    const coBad = company.trim().length < 3;
    const tinBad = tinDigits.length !== 9;
    setCoError(coBad);
    setTinError(tinBad);
    if (!coBad && !tinBad) setInvSent(true);
  };

  return (
    <>
      <GuestTop
        lead={<InitialsAvatar initials={stay.initials} label={stay.property} />}
        title={stay.property}
        sub={`Bill ${folio.id} · room ${folio.room}`}
        lang={lang}
        onLang={setLang}
      />
      <PhoneBody>
        <View className="gap-[14px]">
          <ScreenHeading
            title={TITLES[lang]}
            sub={
              out
                ? `Checked out ${folio.checkedOutOn} · stay ${folio.stay}`
                : `Live from the hotel · updated ${folio.updatedAt}`
            }
          />

          <Card className="gap-3 p-4">
            <View className="flex-row items-end justify-between gap-3">
              <View>
                <Text accessibilityRole="header" className="text-xs leading-4 font-medium text-muted">
                  {balLabel}
                </Text>
                <Text className="text-[30px] leading-9 font-semibold text-foreground">{formatRwf(balanceNow)}</Text>
              </View>
              <Chip variant="soft" color={toneColor(balTone)}>
                <Chip.Label>{balChip}</Chip.Label>
              </Chip>
            </View>
            <Text className="text-xs leading-4 text-muted">{balNote}</Text>

            {payState === "ready" && !out ? (
              <Button size="lg" onPress={() => setSheet(true)}>
                <Icon name="Smartphone" tone="accent-foreground" />
                <Button.Label>Pay {formatRwf(balanceNow)} now</Button.Label>
              </Button>
            ) : null}
            {payState === "pending" && balancePay ? (
              <>
                <StatusAlert
                  status="default"
                  indicator={<Spinner size="sm" />}
                  title="Pending · approve on your phone"
                  description={`We sent an MTN MoMo request for ${formatRwf(balancePay.amount)} to ${folio.momoNumber} (${balancePay.id}). Enter your MoMo PIN to approve. No prompt? Check MoMo’s pending approvals.`}
                />
                <Button variant="secondary" onPress={() => check(payState, checks, setPay, setChecks)}>
                  <Icon name="ArrowsRotateRight" />
                  <Button.Label>I’ve approved, check status</Button.Label>
                </Button>
              </>
            ) : null}
            {payState === "unknown" && balancePay ? (
              <>
                <StatusAlert
                  status="warning"
                  icon="CircleQuestion"
                  title="Unknown · checking with MTN"
                  description={`MTN hasn’t answered yet about ${formatRwf(balancePay.amount)} (${balancePay.id}). Your phone may already have approved it, so please don’t pay again. Last checked ${balancePay.lastCheckedAt}.`}
                />
                <Button variant="secondary" onPress={() => check(payState, checks, setPay, setChecks)}>
                  <Icon name="ArrowsRotateRight" />
                  <Button.Label>Check again</Button.Label>
                </Button>
              </>
            ) : null}
            {payState === "verified" && balancePay ? (
              <StatusAlert
                status="success"
                icon="CircleCheck"
                title={out ? "All payments verified" : "Payment verified"}
                description={
                  out
                    ? `${rows.length} MTN MoMo payments, each confirmed by MTN. Receipts are in Documents.`
                    : `${formatRwf(balancePay.amount)} · MTN MoMo · ref ${balancePay.providerRef} · confirmed by MTN at ${balancePay.confirmedAt}.`
                }
              />
            ) : null}
          </Card>

          <LineTabs
            label="Bill details"
            value={tab}
            onChange={setTab}
            items={[
              { id: "charges", label: "Charges", badge: String(shownCharges.length) },
              { id: "payments", label: "Payments", badge: String(rows.length) },
              { id: "docs", label: "Documents", badge: String(docCount) },
            ]}
          />

          {tab === "charges" ? (
            <View className="gap-2">
              {shownCharges.map((charge) => (
                <View key={charge.id} className="flex-row items-start gap-3">
                  <Icon name={charge.icon} tone="muted" />
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="font-medium text-foreground">{charge.title}</Text>
                    <Text className="text-xs leading-4 text-muted">{charge.meta}</Text>
                    {charge.upcoming ? <SoftChip label="Not posted yet" /> : null}
                  </View>
                  <Text className={`font-semibold ${charge.upcoming ? "text-muted" : "text-foreground"}`}>
                    {formatNumber(charge.amount)}
                  </Text>
                </View>
              ))}
              <View className="flex-row items-center justify-between px-1">
                <Text className="font-semibold text-foreground">Posted so far</Text>
                <Text className="font-semibold text-foreground">{formatRwf(postedTotal)}</Text>
              </View>
              <Text className="px-1 text-xs leading-4 text-muted">
                Tax codes are set up by the hotel; your EBM fiscal receipt is the official tax breakdown. Coffee from
                Ikawa Corner isn’t on this bill: it’s a separate business with its own receipts.
              </Text>
              <Link href={screenHref("GuestRequests") as never} asChild>
                <Button variant="tertiary" size="sm" className="self-start">
                  <Icon name="Comments" />
                  <Button.Label>Question about a charge?</Button.Label>
                </Button>
              </Link>
            </View>
          ) : null}

          {tab === "payments" ? (
            <View className="gap-2">
              {rows.map((row) => (
                <Card key={row.id} className="gap-2 px-4 py-3.5">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold text-foreground">{row.title}</Text>
                      <Text className="text-xs leading-4 text-muted">{row.method}</Text>
                    </View>
                    <View className="items-end gap-1">
                      <Text className="font-semibold text-foreground">{formatRwf(row.amount)}</Text>
                      <Chip size="sm" variant="soft" color={toneColor(row.tone)}>
                        <Chip.Label>{row.status}</Chip.Label>
                      </Chip>
                    </View>
                  </View>
                  <Text className="text-xs leading-4 text-muted">{row.evidence}</Text>
                </Card>
              ))}
              <Text className="px-1 text-xs leading-4 text-muted">
                We count a payment only after the provider confirms it. Refunds, if any, go back to the same MoMo number
                and show here as Pending until MTN confirms.
              </Text>
            </View>
          ) : null}

          {tab === "docs" ? (
            <View className="gap-2.5">
              <Card className="gap-2.5 p-4">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <SectionTitle>Fiscal receipt (EBM)</SectionTitle>
                    <Text className="text-xs leading-4 text-muted">
                      The official tax receipt, issued once when your bill closes
                    </Text>
                  </View>
                  <Chip size="sm" variant="soft" color={out ? "success" : "warning"}>
                    <Chip.Label>{out ? "Issued" : "Pending"}</Chip.Label>
                  </Chip>
                </View>
                {out ? (
                  <>
                    <View className="flex-row items-start gap-3.5">
                      <View
                        accessibilityLabel="Fiscal receipt QR code"
                        className="size-[88px] items-center justify-center rounded-xl bg-surface-secondary"
                      >
                        <Icon name="QrCode" size={48} tone="muted" />
                      </View>
                      <KeyValue
                        items={[
                          { label: "Fiscal number", value: folio.fiscal.number },
                          { label: "Issued", value: folio.fiscal.issued },
                          { label: "Seller", value: folio.fiscal.seller },
                        ]}
                      />
                    </View>
                    <Button variant="secondary" size="sm" className="self-start">
                      <Icon name="ArrowDownToLine" />
                      <Button.Label>Download PDF</Button.Label>
                    </Button>
                  </>
                ) : (
                  <Text className="text-[13px] leading-[18px] text-muted">
                    Issued by the hotel’s EBM when your bill is closed at checkout. You’ll get it here and by email. If
                    something is wrong after that, it’s corrected with a credit note, never edited.
                  </Text>
                )}
              </Card>

              <Card className="gap-2 p-4">
                <SectionTitle>Payment Receipts</SectionTitle>
                <Text className="text-xs leading-4 text-muted">Proof you paid. Not a tax document.</Text>
                {receipts.map((receipt) => (
                  <Card key={receipt.id} variant="secondary" className="flex-row items-center gap-3 p-3">
                    <IconTile name="FileCheck" />
                    <View className="min-w-0 flex-1">
                      <Text className="font-semibold text-foreground">
                        {receipt.title} · {receipt.id}
                      </Text>
                      <Text className="text-xs text-muted">
                        {formatRwf(receipt.amount)} · {receipt.date}
                      </Text>
                    </View>
                    <Button variant="ghost" size="sm" accessibilityLabel={`View ${receipt.title} · ${receipt.id}`}>
                      <Button.Label>View</Button.Label>
                    </Button>
                  </Card>
                ))}
              </Card>

              <Card className="gap-2 p-4">
                <SectionTitle>Proforma</SectionTitle>
                <Text className="text-xs leading-4 text-muted">
                  The estimate sent when you booked. Not a receipt or invoice.
                </Text>
                <Card variant="secondary" className="flex-row items-center gap-3 p-3">
                  <IconTile name="FileText" />
                  <View className="min-w-0 flex-1">
                    <Text className="font-semibold text-foreground">Proforma for {folio.booking}</Text>
                    <Text className="text-xs text-muted">
                      {folio.proforma.date} · {formatRwf(folio.proforma.amount)} for {folio.proforma.nights} nights
                    </Text>
                  </View>
                  <Button variant="ghost" size="sm" accessibilityLabel={`View proforma for ${folio.booking}`}>
                    <Button.Label>View</Button.Label>
                  </Button>
                </Card>
              </Card>

              <Card className="gap-3 p-4">
                <SectionTitle>Invoice for Your Company</SectionTitle>
                <Text className="text-xs leading-4 text-muted">
                  {out
                    ? "Your fiscal receipt was issued without a company TIN. Issued receipts can’t be edited: the hotel issues a credit note, then a new receipt with your company’s details."
                    : "Add it before checkout: the company name and TIN go on the fiscal receipt and on a commercial invoice (INV-26-…)."}
                </Text>
                {invSent ? (
                  <>
                    <Card variant="secondary" className="flex-row items-start gap-3 p-3">
                      <IconTile name="Briefcase" />
                      <View className="min-w-0 flex-1">
                        <Text className="font-semibold text-foreground">{company.trim()}</Text>
                        <Text className="text-xs leading-4 text-muted">
                          TIN {tinDigits}
                          {out
                            ? " · finance reviews the credit note and reissue, usually within 1 working day"
                            : " · the front desk confirms before checkout"}
                        </Text>
                      </View>
                      <SoftChip label="Requested" tone="warning" />
                    </Card>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onPress={() => {
                        setInvSent(false);
                        setCompany("");
                        setTin("");
                      }}
                    >
                      <Button.Label>Change details</Button.Label>
                    </Button>
                  </>
                ) : (
                  <>
                    <TextField isInvalid={coError}>
                      <Label>Company name</Label>
                      <Input
                        value={company}
                        onChangeText={(value) => {
                          setCompany(value);
                          setCoError(false);
                        }}
                        placeholder="As registered with RRA"
                      />
                      {coError ? <FieldError>Enter the company’s registered name.</FieldError> : null}
                    </TextField>
                    <TextField isInvalid={tinError}>
                      <Label>Company TIN</Label>
                      <Input
                        value={tin}
                        onChangeText={(value) => {
                          setTin(value);
                          setTinError(false);
                        }}
                        keyboardType="number-pad"
                        placeholder="9 digits"
                      />
                      {tinError ? (
                        <FieldError>A Rwandan TIN has 9 digits. Check it on the company’s RRA certificate.</FieldError>
                      ) : (
                        <Description>Printed on the fiscal receipt exactly as entered.</Description>
                      )}
                    </TextField>
                    <Button variant="secondary" onPress={submitInv}>
                      <Icon name="Briefcase" />
                      <Button.Label>{out ? "Request a corrected receipt" : "Request invoice"}</Button.Label>
                    </Button>
                  </>
                )}
              </Card>
            </View>
          ) : null}

          {out ? (
            <Link href={screenHref("GuestReview") as never} asChild>
              <Pressable>
                <Card className="flex-row items-center gap-3 p-3.5">
                  <IconTile name="Star" />
                  <View className="min-w-0 flex-1">
                    <Text className="font-semibold text-foreground">How was your stay?</Text>
                    <Text className="text-xs text-muted">Review Isangano and see your points</Text>
                  </View>
                  <Icon name="ChevronRight" tone="muted" />
                </Card>
              </Pressable>
            </Link>
          ) : null}
        </View>
      </PhoneBody>

      <PhoneSheet
        isOpen={sheet}
        onOpenChange={setSheet}
        heading={`Pay ${formatRwf(balanceNow)}`}
        description={`Balance on bill ${folio.id} now. Tonight’s room night is added later and settled at checkout.`}
      >
        <RadioGroup accessibilityLabel="Payment method" value={method} onValueChange={setMethod} className="gap-2">
          {methods.map((item) => (
            <RadioGroup.Item
              key={item.id}
              value={item.id}
              isDisabled={!item.available}
              className={`min-h-14 w-full flex-row items-center gap-3 rounded-2xl border bg-surface px-4 py-3 ${method === item.id ? "border-accent" : "border-separator"}`}
            >
              <Icon name={item.icon} tone="muted" />
              <View className="min-w-0 flex-1">
                <Text className="font-semibold text-foreground">{item.label}</Text>
                <Text className="text-xs leading-4 text-muted">{item.note}</Text>
              </View>
              <Radio />
            </RadioGroup.Item>
          ))}
        </RadioGroup>
        <TextField>
          <Label>{isAirtel ? "Airtel Money number" : "MTN MoMo number"}</Label>
          <Input
            value={isAirtel ? airtel : momo}
            onChangeText={isAirtel ? setAirtel : setMomo}
            keyboardType="phone-pad"
            placeholder={isAirtel ? "073 XXX XXXX" : undefined}
          />
          <Description>You approve on your phone. We mark it paid only when the provider confirms.</Description>
        </TextField>
        <View className="flex-row gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onPress={() => setSheet(false)}>
            <Button.Label>Cancel</Button.Label>
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
            <Button.Label>Send payment request</Button.Label>
          </Button>
        </View>
      </PhoneSheet>
    </>
  );
}

function paymentRow(item: FolioPayment, pay: FolioPaymentState, out: boolean) {
  if (item.kind === "deposit")
    return { status: "Verified", tone: "success" as const, evidence: item.evidence.verified };
  if (item.kind === "final") {
    return out ? { status: "Verified", tone: "success" as const, evidence: item.evidence.verified } : null;
  }
  if (pay === "ready") return null;
  if (pay === "pending") return { status: "Pending", tone: "warning" as const, evidence: item.evidence.pending ?? "" };
  if (pay === "unknown") return { status: "Unknown", tone: "warning" as const, evidence: item.evidence.unknown ?? "" };
  return { status: "Verified", tone: "success" as const, evidence: item.evidence.verified };
}

function check(
  pay: FolioPaymentState,
  checks: number,
  setPay: (next: FolioPaymentState) => void,
  setChecks: (next: number) => void,
) {
  if (pay === "pending" && checks === 0) {
    setPay("unknown");
    setChecks(1);
  } else {
    setPay("verified");
    setChecks(checks + 1);
  }
}
