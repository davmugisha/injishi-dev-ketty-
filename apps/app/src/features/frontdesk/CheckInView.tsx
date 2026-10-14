"use client";

import {
  ArrowLeft,
  ArrowsRotateRight,
  Camera,
  CircleCheck,
  CircleInfo,
  Clock,
  Comment,
  Eye,
  Key,
  Lock,
  PaperPlane,
  Persons,
  Printer,
  QrCode,
  Receipt,
  ShieldExclamation,
  Smartphone,
  Wallet,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Chip,
  Input,
  Kbd,
  Label,
  Spinner,
  TextArea,
  TextField,
} from "@heroui/react";
import { ItemCard, ListView, RadioButtonGroup, Segment, Stepper } from "@heroui-pro/react";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { type Persona, screenHref } from "@injishi/data";
import type { CheckInFile, MobileNetwork, PaymentMethod } from "@injishi/data/fixtures/frontdesk";
import {
  formatRwf,
  GateChip,
  Icon,
  KeyValueList,
  LinkButton,
  PageContent,
  PageHeader,
  StatusDot,
  type Tone,
  toneColor,
} from "@injishi/ui";
import NextLink from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ChoiceSelect, isReady, ROOM_STATUS } from "./shared";

type Step = 1 | 2 | 3 | 4 | 5;
type PayState = "idle" | "pending" | "verified" | "cash";

/** Digits of a typed amount ("RWF 170,000" → 170000). */
const amountOf = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

function SectionTitle({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 id="step-h" className="text-[15px] leading-[22px] font-semibold">
        {title}
      </h2>
      {children ? <p className="text-[13px] text-muted">{children}</p> : null}
    </div>
  );
}

export function CheckInView({ persona, file }: { persona: Persona; file: CheckInFile }) {
  const [step, setStep] = useState<Step>(1);
  const [maxStep, setMaxStep] = useState<Step>(1);
  const [idOk, setIdOk] = useState(false);
  const [occScanned, setOccScanned] = useState(false);
  const [occType, setOccType] = useState(file.occupant.documentTypes[0] ?? "Passport");
  const [occNo, setOccNo] = useState("");
  const [dup, setDup] = useState<"open" | "linked" | "separate">("open");
  const [room, setRoom] = useState(file.defaultRoom);
  const [ovr, setOvr] = useState<"none" | "form" | "sent">("none");
  const [ovrReason, setOvrReason] = useState(file.override.reasons[0] ?? "");
  const [ovrApprover, setOvrApprover] = useState(file.override.approvers[0] ?? "");
  const [pay, setPay] = useState<PaymentMethod["id"]>("momo");
  const [net, setNet] = useState<MobileNetwork["id"]>("MTN");
  const [payState, setPayState] = useState<PayState>("idle");
  const [cashIn, setCashIn] = useState(formatRwf(file.deposit.cashReceived));
  const [cards, setCards] = useState(2);
  const [keyGiven, setKeyGiven] = useState(false);
  const [claimSent, setClaimSent] = useState(false);

  const network = file.networks.find((n) => n.id === net) ?? file.networks[0];
  const netLabel = network?.label ?? "";
  const momoRef = network?.ref ?? "";
  const deposit = formatRwf(file.deposit.amount);
  const approverName = ovrApprover.split(" · ")[0] ?? ovrApprover;
  const approverFirst = approverName.split(" ")[0];
  const paid = payState === "verified" || payState === "cash";
  const roomState = file.rooms.find((r) => r.room === room);

  const payDesc: Record<PayState, string> = {
    idle: "Not started",
    pending: `${netLabel} · pending`,
    verified: `${netLabel} · verified`,
    cash: "Cash recorded",
  };
  const steps = [
    { title: "Guest", desc: idOk ? "ID checked" : "Check ID" },
    { title: "Room", desc: `Room ${room}` },
    { title: "Payment", desc: pay === "later" ? "Pay at checkout" : payDesc[payState] },
    { title: "Key", desc: keyGiven ? "Physical key given" : "Physical key" },
    { title: "Done", desc: "Registration" },
  ];

  let payCheck: [Tone, string] = ["warning", "Not started"];
  if (pay === "later") payCheck = ["success", "Pay at checkout · agent guarantee"];
  else if (payState === "pending") payCheck = ["warning", `${netLabel} pending · not paid yet`];
  else if (payState === "verified") payCheck = ["success", `Verified · ${netLabel} · ${momoRef}`];
  else if (payState === "cash") payCheck = ["success", `Cash recorded · ${file.deposit.till}`];

  const checks: { label: string; tone: Tone; state: string }[] = [
    {
      label: "ID checked",
      tone: idOk ? "success" : "warning",
      state: idOk ? "Passport compared at the desk" : "Compare the passport with the guest",
    },
    {
      label: "Duplicate reviewed",
      tone: dup !== "open" ? "success" : "warning",
      state:
        dup === "linked"
          ? `Linked to ${file.duplicate.existingId}`
          : dup === "separate"
            ? "Kept separate"
            : "Possible match to review",
    },
    {
      label: "Room ready",
      tone: "success",
      state: `Room ${room} · ${roomState ? ROOM_STATUS[roomState.status].label : "Inspected"}`,
    },
    { label: "Deposit", tone: payCheck[0], state: payCheck[1] },
    {
      label: "Key",
      tone: keyGiven ? "success" : "default",
      state: keyGiven ? `Physical key ${room} · ${cards} cards` : "No lock provider · physical key",
    },
  ];

  const records = [
    {
      icon: "House",
      title: `Stay ${file.stayId}`,
      desc: `Room ${room} · 12 → 14 Oct`,
      chip: "In house",
      tone: "success",
    },
    {
      icon: "Receipt",
      title: `Folio ${file.folioId}`,
      desc: paid
        ? `${formatRwf(file.deposit.stayTotal - file.deposit.amount)} due after deposit`
        : `${formatRwf(file.deposit.stayTotal)} due`,
      chip: "Open",
      tone: "default",
    },
    { icon: "Calendar", title: `Booking ${file.id}`, desc: "Terms unchanged", chip: "Confirmed", tone: "default" },
    {
      icon: "Wallet",
      title: `Deposit ${file.depositId}`,
      desc: pay === "later" ? "Collect at checkout" : payCheck[1],
      chip:
        pay === "later"
          ? "Not taken"
          : payState === "verified"
            ? "Verified"
            : payState === "cash"
              ? "Recorded"
              : payState === "pending"
                ? "Pending"
                : "Not started",
      tone: paid ? "success" : "warning",
    },
  ] as const;

  const blocked =
    (step === 1 && !idOk) || (step === 3 && pay !== "later" && payState === "idle") || (step === 4 && !keyGiven);
  const hint =
    step === 1
      ? idOk
        ? dup === "open"
          ? "The possible duplicate can be reviewed later in Guests"
          : "Ready for the room"
        : "Confirm the ID check to continue"
      : step === 2
        ? `Room ${room} is ready`
        : step === 3
          ? blocked
            ? "Take the deposit or choose pay at checkout"
            : payState === "pending"
              ? "You can continue: the folio shows the deposit as pending until the provider confirms"
              : "Deposit settled for check-in"
          : step === 4
            ? keyGiven
              ? "Physical key handed over"
              : "Tick when the key cards are handed over"
            : "";

  const next = () => {
    if (blocked || step >= 5) return;
    const n = (step + 1) as Step;
    setStep(n);
    setMaxStep((m) => (n > m ? n : m));
  };
  const back = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  // Enter continues, as the Continue button's key hint promises (not while typing in a field).
  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented) return;
      if (e.target instanceof HTMLElement && e.target !== document.body) return;
      nextRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const change = amountOf(cashIn) - file.deposit.amount;

  return (
    <PageContent className="text-[14px] leading-5">
      <PageHeader
        eyebrow={
          <>
            <NextLink href={screenHref("FrontDeskToday")} className="text-inherit no-underline hover:underline">
              Today
            </NextLink>
            <span aria-hidden="true">›</span>
            <span>Arrivals</span>
            <span aria-hidden="true">›</span>
            <span className="tabular">{file.id}</span>
          </>
        }
        title={`Check in ${file.guest}`}
        description={`${file.roomType} · ${file.dates} · ${file.nights} nights · ${file.adults} adults · booked by ${file.bookedBy}`}
        actions={
          <>
            <GateChip icon={<Lock className="size-3" />}>
              Only this desk can check in {file.id} · since {file.lockedSince}
            </GateChip>
            <LinkButton href={screenHref("Messages")} variant="ghost">
              <Comment className="size-4" />
              Message
            </LinkButton>
            <LinkButton href={screenHref("FrontDeskToday")} variant="secondary">
              Save and exit
            </LinkButton>
          </>
        }
      />

      <Card className="px-5 py-[18px]" aria-label="Check-in progress">
        <Stepper
          currentStep={step === 5 ? steps.length : step - 1}
          onStepChange={(i) => {
            const n = (i + 1) as Step;
            if (step !== 5 && n <= maxStep) setStep(n);
          }}
          className="w-full"
        >
          {steps.map((s, i) => (
            <Stepper.Step key={s.title} aria-current={i + 1 === step ? "step" : undefined}>
              <Stepper.Indicator />
              <Stepper.Content>
                <Stepper.Title>{s.title}</Stepper.Title>
                <Stepper.Description>{s.desc}</Stepper.Description>
              </Stepper.Content>
              <Stepper.Separator />
            </Stepper.Step>
          ))}
        </Stepper>
      </Card>

      <div className="flex flex-wrap items-start gap-4">
        <Card className="min-w-0 flex-[999_1_620px] gap-4 p-5" aria-labelledby="step-h">
          {step === 1 ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <SectionTitle title="Guest and Occupants">
                  Check the ID against the person at the desk. Booker, occupants and payer stay separate roles.
                </SectionTitle>
                <Chip size="sm" variant="soft" color="accent">
                  <Smartphone className="size-3" />
                  <Chip.Label>ID sent from the guest app</Chip.Label>
                </Chip>
              </div>

              {dup === "open" ? (
                <Alert status="warning" role="status">
                  <Alert.Indicator>
                    <Persons />
                  </Alert.Indicator>
                  <Alert.Content className="w-full">
                    <Alert.Title>Possible duplicate guest</Alert.Title>
                    <Alert.Description>
                      An existing profile matches on name, date of birth and nationality. Nothing is merged
                      automatically.
                    </Alert.Description>
                    <div className="mt-2.5 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
                      {file.duplicate.cards.map((c) => (
                        <Card key={c.title} variant="secondary" className="gap-0.5 px-3 py-2.5 text-xs leading-[18px]">
                          <span className="text-[13px] font-semibold">{c.title}</span>
                          {c.lines.map((l) => (
                            <span key={l} className="tabular">
                              {l}
                            </span>
                          ))}
                          <span className="text-muted">{c.note}</span>
                        </Card>
                      ))}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onPress={() => setDup("linked")}>
                        Same person · link this stay
                      </Button>
                      <Button size="sm" variant="secondary" onPress={() => setDup("separate")}>
                        Different people · keep separate
                      </Button>
                      <LinkButton href={screenHref("Guests")} size="sm" variant="ghost">
                        Compare in Guests
                      </LinkButton>
                    </div>
                  </Alert.Content>
                </Alert>
              ) : (
                <Alert status="default" role="status">
                  <Alert.Indicator>
                    <CircleCheck />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>
                      {dup === "linked"
                        ? `Stay linked to existing profile ${file.duplicate.existingId}`
                        : "Kept as a separate new profile"}
                    </Alert.Title>
                    <Alert.Description>
                      {dup === "linked"
                        ? "Only this stay is linked; the two records are not merged. Logged with your name."
                        : "Both profiles stay as they are. Logged with your name."}{" "}
                      <Button size="sm" variant="ghost" onPress={() => setDup("open")}>
                        Undo
                      </Button>
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              <Card variant="secondary" className="gap-3 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar variant="soft" color="accent">
                    <Avatar.Fallback>{file.initials}</Avatar.Fallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">{file.guest}</span>
                    <span className="flex flex-wrap gap-1.5">
                      {file.primaryRoles.map((r) => (
                        <Chip key={r} size="sm" variant="soft">
                          {r}
                        </Chip>
                      ))}
                    </span>
                  </div>
                  <Button size="sm" variant="ghost">
                    <Eye className="size-4" />
                    View document
                  </Button>
                </div>
                <KeyValueList
                  items={file.primaryDocument.map((f) => ({
                    label: f.label,
                    value: <span className="tabular">{f.value}</span>,
                  }))}
                />
                <p className="text-xs text-muted">
                  Full document numbers stay masked. Opening the document is logged with your name and the reason
                  “check-in”.
                </p>
                <Checkbox isSelected={idOk} onChange={setIdOk}>
                  <Checkbox.Content className="flex items-center gap-2.5">
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="font-medium">
                      I compared the passport photo and name with the guest at the desk
                    </span>
                  </Checkbox.Content>
                </Checkbox>
              </Card>

              <Card variant="secondary" className="gap-3 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar variant="soft">
                    <Avatar.Fallback>{file.occupant.initials}</Avatar.Fallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-semibold">{file.occupant.name}</span>
                    <span className="flex flex-wrap gap-1.5">
                      <Chip size="sm" variant="soft">
                        Occupant
                      </Chip>
                      <Chip size="sm" variant="soft" color={occScanned ? "success" : "warning"}>
                        {occScanned ? `Scanned at desk ${file.occupant.scannedAt}` : "ID not received"}
                      </Chip>
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      setOccScanned(true);
                      setOccNo(file.occupant.scannedNumber);
                    }}
                  >
                    <Camera className="size-4" />
                    Scan document
                  </Button>
                </div>
                <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr))]">
                  <ChoiceSelect
                    label="Document type"
                    options={file.occupant.documentTypes}
                    value={occType}
                    onChange={setOccType}
                  />
                  <TextField value={occNo} onChange={setOccNo} className="flex flex-col gap-1">
                    <Label>Document number</Label>
                    <Input placeholder="As printed" className="tabular" />
                  </TextField>
                </div>
                <p className="text-xs text-muted">
                  Fields follow this property's registration settings. {file.occupant.name.split(" ")[0]}'s details can
                  be completed before tonight's guest register closes.
                </p>
              </Card>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Who is who on this booking</h3>
                <ListView aria-label="Who is who on this booking" variant="secondary" items={file.parties}>
                  {(p) => (
                    <ListView.Item id={p.id} textValue={p.name}>
                      <ListView.ItemContent>
                        <Icon name={p.icon} className="size-4 text-muted" />
                        <div className="flex min-w-0 flex-col">
                          <ListView.Title>{p.name}</ListView.Title>
                          <ListView.Description>{p.desc}</ListView.Description>
                        </div>
                      </ListView.ItemContent>
                      <ListView.ItemAction>
                        <Chip size="sm" variant="soft" color={toneColor(p.tone)}>
                          {p.role}
                        </Chip>
                      </ListView.ItemAction>
                    </ListView.Item>
                  )}
                </ListView>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="flex flex-col gap-4">
              <SectionTitle title="Room">
                Booked {file.roomType}, pre-assigned {file.preAssignedRoom}. Only clean or inspected rooms can be
                chosen.
              </SectionTitle>
              <RadioButtonGroup
                aria-label={`${file.roomType} rooms`}
                value={room}
                onChange={(v) => v && setRoom(v)}
                layout="grid"
                className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]"
              >
                {file.rooms.map((o) => {
                  const st = ROOM_STATUS[o.status];
                  return (
                    <RadioButtonGroup.Item
                      key={o.id}
                      value={o.room}
                      isDisabled={!isReady(o.status)}
                      className="gap-1.5 px-3.5 py-3"
                    >
                      <RadioButtonGroup.ItemContent className="flex w-full flex-col gap-1.5">
                        <span className="flex items-center justify-between gap-2">
                          <Label className="text-lg font-semibold tabular">{o.room}</Label>
                          <Chip size="sm" variant="soft" color={toneColor(st.tone)}>
                            {st.label}
                          </Chip>
                        </span>
                        <span className="text-xs leading-4 text-muted">{o.note}</span>
                      </RadioButtonGroup.ItemContent>
                    </RadioButtonGroup.Item>
                  );
                })}
              </RadioButtonGroup>
              <Alert status="accent">
                <Alert.Indicator>
                  <CircleInfo />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Room {room} · same type and rate as booked</Alert.Title>
                  <Alert.Description>
                    Housekeeping is told {file.preAssignedRoom} is no longer needed for this arrival. The change is
                    saved on the stay's room history.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
              <Card variant="secondary" className="gap-2.5 p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold">Need a room that isn't ready?</span>
                  <span className="text-[13px] text-muted">
                    Checking into a dirty or out-of-order room needs a reason and a manager's approval. It's recorded
                    with your name.
                  </span>
                </div>
                {ovr === "none" ? (
                  <div>
                    <Button size="sm" variant="secondary" onPress={() => setOvr("form")}>
                      <ShieldExclamation className="size-4" />
                      Request override for {file.preAssignedRoom}
                    </Button>
                  </div>
                ) : null}
                {ovr === "form" ? (
                  <>
                    <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr))]">
                      <ChoiceSelect
                        label="Reason"
                        options={file.override.reasons}
                        value={ovrReason}
                        onChange={setOvrReason}
                      />
                      <ChoiceSelect
                        label="Approver"
                        options={file.override.approvers}
                        value={ovrApprover}
                        onChange={setOvrApprover}
                      />
                    </div>
                    <TextField defaultValue={file.override.note} className="flex flex-col gap-1">
                      <Label>Note for the approver</Label>
                      <TextArea rows={2} />
                    </TextField>
                    <div className="flex gap-2">
                      <Button size="sm" onPress={() => setOvr("sent")}>
                        Send for approval
                      </Button>
                      <Button size="sm" variant="ghost" onPress={() => setOvr("none")}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : null}
                {ovr === "sent" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip variant="soft" color="warning">
                      <Clock className="size-3" />
                      <Chip.Label>
                        Waiting for {approverName} · sent {file.override.sentAt}
                      </Chip.Label>
                    </Chip>
                    <span className="text-xs text-muted">
                      Continue with {room} meanwhile. {file.preAssignedRoom} unlocks here only if {approverFirst}{" "}
                      approves.
                    </span>
                  </div>
                ) : null}
              </Card>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-4">
              <SectionTitle title="Deposit and Payment">
                {file.deposit.policy}, from this booking's terms: a 1-night deposit of{" "}
                <span className="font-semibold text-foreground tabular">{deposit}</span> now, or pay at checkout because{" "}
                {file.bookedBy} guarantees the booking (voucher {file.deposit.voucher}).
              </SectionTitle>
              <RadioButtonGroup
                aria-label={`How ${file.firstName} pays`}
                value={pay}
                onChange={(v) => {
                  if (!v) return;
                  setPay(v as PaymentMethod["id"]);
                  setPayState("idle");
                }}
                layout="grid"
                className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))]"
              >
                {file.methods.map((m) => (
                  <RadioButtonGroup.Item
                    key={m.id}
                    value={m.id}
                    isDisabled={m.disabled}
                    className="gap-1.5 px-3.5 py-3"
                  >
                    <RadioButtonGroup.ItemIcon>
                      <Icon name={m.icon} className="size-5" />
                    </RadioButtonGroup.ItemIcon>
                    <RadioButtonGroup.ItemContent className="flex flex-col gap-1">
                      <Label className="font-semibold">{m.label}</Label>
                      <span className="text-xs leading-4 text-muted">{m.note}</span>
                    </RadioButtonGroup.ItemContent>
                  </RadioButtonGroup.Item>
                ))}
              </RadioButtonGroup>

              {pay === "momo" ? (
                <Card variant="secondary" className="gap-3 p-4">
                  <Segment
                    aria-label="Mobile money network"
                    selectedKey={net}
                    onSelectionChange={(k) => {
                      setNet(k as MobileNetwork["id"]);
                      setPayState("idle");
                    }}
                    className="self-start"
                  >
                    {file.networks.map((n) => (
                      <Segment.Item key={n.id} id={n.id}>
                        {n.label}
                      </Segment.Item>
                    ))}
                  </Segment>
                  <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                    <TextField defaultValue={file.deposit.phone} className="flex flex-col gap-1">
                      <Label>
                        {file.firstName}'s {netLabel} number
                      </Label>
                      <Input className="tabular" />
                    </TextField>
                    <TextField defaultValue={deposit} className="flex flex-col gap-1">
                      <Label>Amount</Label>
                      <Input className="tabular" />
                    </TextField>
                  </div>
                  {payState === "idle" ? (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Button onPress={() => setPayState("pending")}>
                        <PaperPlane className="size-4" />
                        Send payment request
                      </Button>
                      <span className="text-xs text-muted">
                        {file.firstName} approves it on her phone with her PIN.
                      </span>
                    </div>
                  ) : null}
                  {payState === "pending" ? (
                    <Alert status="default" role="status">
                      <Alert.Indicator>
                        <Spinner size="sm" aria-label="Waiting" />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>Pending · waiting for {netLabel} to confirm</Alert.Title>
                        <Alert.Description className="tabular">
                          Sent {file.deposit.sentAt} to {file.deposit.phoneMasked} · provider ref {momoRef} · not paid
                          until the provider confirms.
                        </Alert.Description>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="secondary" onPress={() => setPayState("verified")}>
                            <ArrowsRotateRight className="size-4" />
                            Check status
                          </Button>
                          <Button size="sm" variant="ghost" onPress={() => setPayState("idle")}>
                            Cancel request
                          </Button>
                        </div>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                  {payState === "verified" ? (
                    <Alert status="success" role="status">
                      <Alert.Indicator>
                        <CircleCheck />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>Verified by {netLabel}</Alert.Title>
                        <Alert.Description className="tabular">
                          {deposit} · ref {momoRef} · confirmed {file.deposit.confirmedAt} · allocated to folio{" "}
                          {file.folioId} as a deposit. A payment receipt prints now; the EBM fiscal receipt is issued at
                          settlement.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                  <p className="text-xs text-muted">
                    Resending uses the same request key, so {file.firstName} can't be charged twice.
                  </p>
                </Card>
              ) : null}

              {pay === "cash" ? (
                <Card variant="secondary" className="gap-3 p-4">
                  <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                    <TextField value={cashIn} onChange={setCashIn} className="flex flex-col gap-1">
                      <Label>Cash received</Label>
                      <Input className="tabular" inputMode="numeric" />
                    </TextField>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">Change to give</span>
                      <output className="pt-1.5 text-lg font-semibold tabular" aria-live="polite">
                        {change >= 0 ? formatRwf(change) : `${formatRwf(-change)} short`}
                      </output>
                    </div>
                  </div>
                  {payState === "idle" ? (
                    <div>
                      <Button onPress={() => setPayState("cash")} isDisabled={change < 0}>
                        <Wallet className="size-4" />
                        Record {deposit} cash
                      </Button>
                    </div>
                  ) : null}
                  {payState === "cash" ? (
                    <Alert status="default" role="status">
                      <Alert.Indicator>
                        <Wallet />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>Cash recorded to {file.deposit.till} · 10:48</Alert.Title>
                        <Alert.Description>
                          Counted against {persona.name}'s shift at shift close. Payment receipt printed; not a fiscal
                          receipt.
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                </Card>
              ) : null}

              {pay === "later" ? (
                <Alert status="default">
                  <Alert.Indicator>
                    <Clock />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Pay at checkout</Alert.Title>
                    <Alert.Description>
                      Allowed by {file.deposit.policy} because {file.bookedBy} guarantees the booking (voucher{" "}
                      {file.deposit.voucher}). The folio opens with {formatRwf(file.deposit.stayTotal)} due.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="flex flex-col gap-4">
              <SectionTitle title="Key and Guest App">
                Hand over the room key and give {file.firstName} a way to open her stay in the guest app.
              </SectionTitle>
              <Alert status="default">
                <Alert.Indicator>
                  <Lock />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>No lock provider connected · issue physical key {room}</Alert.Title>
                  <Alert.Description>
                    Digital keys only appear when an authorised lock provider is connected to Isangano Lakeside Hotel.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
              <div className="grid items-start gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
                <Card variant="secondary" className="gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Physical key · room {room}</span>
                    <Key className="size-4 text-muted" aria-hidden="true" />
                  </div>
                  <NumberStepper
                    value={cards}
                    onChange={setCards}
                    minValue={1}
                    maxValue={3}
                    className="flex items-center gap-2.5"
                  >
                    <Label>Key cards</Label>
                    <NumberStepper.Group>
                      <NumberStepper.DecrementButton aria-label="Fewer key cards" />
                      <NumberStepper.Value />
                      <NumberStepper.IncrementButton aria-label="More key cards" />
                    </NumberStepper.Group>
                  </NumberStepper>
                  <Checkbox isSelected={keyGiven} onChange={setKeyGiven}>
                    <Checkbox.Content className="flex items-center gap-2.5">
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <span className="font-medium">Key cards handed to {file.guest}</span>
                    </Checkbox.Content>
                  </Checkbox>
                  <p className="text-xs text-muted">Logged on the stay. Collected back at checkout.</p>
                </Card>
                <Card variant="secondary" className="gap-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Stay claim</span>
                    <Chip size="sm" variant="soft" color={claimSent ? "warning" : "default"}>
                      {claimSent ? "Link sent 10:49 · not claimed yet" : "Not claimed"}
                    </Chip>
                  </div>
                  <div className="flex items-start gap-3.5">
                    <div
                      role="img"
                      aria-label={`Stay claim QR code for ${file.stayId}`}
                      className="flex size-[104px] flex-none items-center justify-center rounded-[14px] bg-surface shadow-surface"
                    >
                      <QrCode className="size-[72px]" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted">Claim code</span>
                      <span className="text-lg font-semibold tracking-[0.04em] tabular">{file.claimCode}</span>
                      <span className="text-xs text-muted">Stay {file.stayId} · expires at checkout</span>
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" className="self-start" onPress={() => setClaimSent(true)}>
                    <PaperPlane className="size-4" />
                    Send link by SMS
                  </Button>
                  <GateChip icon={<ShieldExclamation className="size-3" />} className="self-start">
                    A claim is not proof of identity
                  </GateChip>
                  <p className="text-xs text-muted">
                    Scanning links the trip in {file.firstName}'s app. Her ID was checked in step 1; the claim doesn't
                    replace that check.
                  </p>
                </Card>
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3.5">
                <span className="inline-flex size-11 flex-none items-center justify-center rounded-full bg-success-soft text-success">
                  <CircleCheck className="size-5" aria-hidden="true" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <h2 id="step-h" className="text-lg leading-6 font-semibold">
                    {file.guest} is checked in to room {room}
                  </h2>
                  <span className="text-[13px] text-muted">
                    {file.checkedInAt} · by {persona.name} · Isangano Lakeside Hotel
                  </span>
                </div>
              </div>
              <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                {records.map((rc) => (
                  <ItemCard key={rc.title} variant="secondary" className="items-start">
                    <ItemCard.Icon>
                      <Icon name={rc.icon} />
                    </ItemCard.Icon>
                    <ItemCard.Content>
                      <ItemCard.Title className="tabular">{rc.title}</ItemCard.Title>
                      <ItemCard.Description className="whitespace-normal">{rc.desc}</ItemCard.Description>
                      <Chip size="sm" variant="soft" color={toneColor(rc.tone)} className="mt-1 self-start">
                        {rc.chip}
                      </Chip>
                    </ItemCard.Content>
                  </ItemCard>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Documents</h3>
                <ListView aria-label="Documents" variant="secondary" items={file.documents}>
                  {(d) => (
                    <ListView.Item id={d.id} textValue={d.title}>
                      <ListView.ItemContent>
                        <Icon name={d.icon} className="size-4 text-muted" />
                        <div className="flex min-w-0 flex-col">
                          <ListView.Title className="tabular">{d.title}</ListView.Title>
                          <ListView.Description>{d.desc}</ListView.Description>
                        </div>
                      </ListView.ItemContent>
                      <ListView.ItemAction className="flex items-center gap-2">
                        <Chip size="sm" variant="soft" color={toneColor(d.tone)}>
                          {d.chip}
                        </Chip>
                        {d.printable ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            aria-label={`Print ${d.title}`}
                            onPress={() => window.print()}
                          >
                            <Printer className="size-4" />
                          </Button>
                        ) : null}
                      </ListView.ItemAction>
                    </ListView.Item>
                  )}
                </ListView>
              </div>
              <div className="flex flex-wrap gap-2">
                <LinkButton href={screenHref("FrontDeskToday")}>
                  <ArrowLeft className="size-4" />
                  Back to Today
                </LinkButton>
                <LinkButton href={screenHref("StayFolio")} variant="secondary">
                  <Receipt className="size-4" />
                  Open stay folio
                </LinkButton>
                <LinkButton href={screenHref("Messages")} variant="ghost">
                  <Comment className="size-4" />
                  Message {file.firstName}
                </LinkButton>
              </div>
            </div>
          ) : null}

          {step < 5 ? (
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-separator pt-3.5">
              <Button variant="secondary" isDisabled={step === 1} onPress={back}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <span className="flex-[1_1_200px] text-right text-xs text-muted" aria-live="polite">
                {hint}
              </span>
              <Button isDisabled={blocked} onPress={next}>
                {step === 4 ? "Complete check-in" : "Continue"}
                <Kbd variant="light" aria-hidden="true" className="bg-accent-foreground/20 text-accent-foreground">
                  Enter
                </Kbd>
              </Button>
            </div>
          ) : null}
        </Card>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4" aria-label="Booking summary">
          <Card className="gap-3 p-4" aria-labelledby="bk-h">
            <div className="flex items-center justify-between gap-2">
              <h2 id="bk-h" className="text-[15px] leading-[22px] font-semibold tabular">
                {file.id}
              </h2>
              <Chip size="sm" variant="soft" color="success">
                {file.bookingStatus}
              </Chip>
            </div>
            <KeyValueList
              items={file.facts.map((f) => ({ label: f.label, value: <span className="tabular">{f.value}</span> }))}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted">Requests</span>
              <span className="flex flex-wrap gap-1.5">
                {file.requests.map((r) => (
                  <Chip key={r} size="sm" variant="soft">
                    {r}
                  </Chip>
                ))}
              </span>
            </div>
          </Card>
          <Card className="gap-2.5 p-4" aria-labelledby="ck-h">
            <h2 id="ck-h" className="text-[15px] leading-[22px] font-semibold">
              Before the Key
            </h2>
            <ul className="flex flex-col gap-2.5">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2.5">
                  <StatusDot tone={c.tone} className="mt-1.5" />
                  <span className="flex flex-col">
                    <span className="font-medium">{c.label}</span>
                    <span className="text-xs text-muted">{c.state}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <p className="px-1 text-xs leading-4 text-muted">
            Booking, stay, folio and payments are separate records. Checking in creates the stay and opens the folio; it
            doesn't change the booking's terms.
          </p>
        </aside>
      </div>
    </PageContent>
  );
}
