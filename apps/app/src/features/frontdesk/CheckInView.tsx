"use client";

import {
  ArrowLeft,
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
  FieldError,
  Input,
  Kbd,
  Label,
  TextArea,
  TextField,
  Toast,
  toast,
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
import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { readFrancs } from "@/lib/francs";
import { checkInGuest } from "./actions";
import { ChoiceSelect, isReady, ROOM_STATUS } from "./shared";

type Step = 1 | 2 | 3 | 4 | 5;
type PayState = "idle" | "pending" | "verified" | "cash";

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

export function CheckInView({
  persona,
  file,
  property,
}: {
  persona: Persona;
  file: CheckInFile;
  /** The property the desk's day is read for, as the API names it. */
  property: string;
}) {
  // A guest already checked in opens on the finished card (the page reads the stay back after the command).
  const [step, setStep] = useState<Step>(file.stayId ? 5 : 1);
  /**
   * Opened on a guest who was checked in before this screen was: nothing was counted or handed over
   * here, and the booking's deposit is not what the stay owes now. The card says so and sends the
   * person to the stay, whose bill holds the truth. (Completing check-in here keeps its own card.)
   */
  const [arrivedEarlier] = useState(Boolean(file.stayId));
  const [maxStep, setMaxStep] = useState<Step>(file.stayId ? 5 : 1);
  const [saving, startSaving] = useTransition();
  /** The key of the one press of "Record cash", minted at that press and sent with the check-in. */
  const [cashKey, setCashKey] = useState<string | null>(null);
  /** The cash the person typed, fixed at the press of "Record cash": exactly what goes on the bill. */
  const [cashTaken, setCashTaken] = useState(0);
  const [cashAt, setCashAt] = useState("");
  const [idOk, setIdOk] = useState(false);
  // No candidate profile means nothing to review (guest profiles per business are not built yet).
  const dup: "open" | "separate" = file.duplicate.cards.length ? "open" : "separate";
  const [room, setRoom] = useState(file.stayId ? file.preAssignedRoom || file.defaultRoom : file.defaultRoom);
  const [ovr, setOvr] = useState<"none" | "form">("none");
  const [ovrReason, setOvrReason] = useState(file.override.reasons[0] ?? "");
  const [ovrApprover, setOvrApprover] = useState(file.override.approvers[0] ?? "");
  // The first way to pay the desk can take today; a booking paid in full online owes nothing at the desk.
  const [pay, setPay] = useState<PaymentMethod["id"]>(
    file.deposit.amount === 0 ? "later" : (file.methods.find((m) => !m.disabled && m.id !== "later")?.id ?? "later"),
  );
  const [net, setNet] = useState<MobileNetwork["id"]>("MTN");
  const [payState, setPayState] = useState<PayState>("idle");
  // Empty until the person types what they counted: the bill records that, never the amount due.
  const [cashIn, setCashIn] = useState("");
  const [cards, setCards] = useState(2);
  const [keyGiven, setKeyGiven] = useState(false);

  const network = file.networks.find((n) => n.id === net) ?? file.networks[0];
  const netLabel = network?.label ?? "";
  const momoRef = network?.ref ?? "";
  const deposit = formatRwf(file.deposit.amount);
  const paid = payState === "verified" || payState === "cash";
  /** Nothing here is connected to a provider or a lock: say so, and change nothing. */
  const unavailable = (what: string) => toast.warning(`${what} is not available yet. Nothing was changed.`);
  /** Paid in full online when booked: the bill opens with it credited, and nothing is taken at the desk. */
  const nothingDue = file.deposit.amount === 0;
  const roomState = file.rooms.find((r) => r.room === room);
  /** Only a clean or inspected room can be checked into; a guest already checked in is in the stay's room. */
  const roomReady = Boolean(file.stayId) || isReady(roomState?.status);
  /** The guest sent their ID from the guest app before arriving (the booking's own record says so). */
  const idSent = file.primaryDocument.some((f) => /guest app/i.test(f.value));

  const payDesc: Record<PayState, string> = {
    idle: "Not started",
    pending: `${netLabel} · pending`,
    verified: `${netLabel} · verified`,
    cash: `Cash ${formatRwf(cashTaken)} counted`,
  };
  const steps = arrivedEarlier
    ? [
        { title: "Guest", desc: "Checked in" },
        { title: "Room", desc: `Room ${room}` },
        { title: "Payment", desc: "On the stay's bill" },
        { title: "Key", desc: "Not recorded here" },
        { title: "Done", desc: "Checked in" },
      ]
    : [
        { title: "Guest", desc: idOk ? "ID checked" : "Check ID" },
        { title: "Room", desc: `Room ${room}` },
        {
          title: "Payment",
          desc:
            nothingDue && payState === "idle" ? "Paid online" : pay === "later" ? "Pay at checkout" : payDesc[payState],
        },
        { title: "Key", desc: keyGiven ? "Physical key given" : "Physical key" },
        { title: "Done", desc: "Registration" },
      ];

  let payCheck: [Tone, string] = ["warning", "Not started"];
  if (pay === "later") payCheck = ["success", "Pay at checkout · left on the bill"];
  else if (payState === "pending") payCheck = ["warning", `${netLabel} pending · not paid yet`];
  else if (payState === "verified") payCheck = ["success", `Verified · ${netLabel} · ${momoRef}`];
  else if (payState === "cash") payCheck = ["success", `Cash ${formatRwf(cashTaken)} counted · ${file.deposit.till}`];
  // Paid in full online when booked: nothing to take at the desk, whichever way pays the extras.
  if (nothingDue && payState === "idle") payCheck = ["success", "Paid online when booked"];

  const deskChecks: { label: string; tone: Tone; state: string }[] = [
    {
      label: "ID checked",
      tone: idOk ? "success" : "warning",
      // The check is the desk's own confirmation; the stay does not record it yet.
      state: idOk ? "Compared at the desk · not recorded on the stay" : "Compare the ID with the guest",
    },
    {
      label: "Duplicate reviewed",
      tone: dup !== "open" ? "success" : "warning",
      state: dup === "open" ? "Possible match to review" : "No guest profiles to compare yet",
    },
    {
      label: "Room ready",
      tone: roomReady ? "success" : "warning",
      state: `Room ${room} · ${roomState ? ROOM_STATUS[roomState.status].label : "status not known"}`,
    },
    { label: "Deposit", tone: payCheck[0], state: payCheck[1] },
    {
      label: "Key",
      tone: keyGiven ? "success" : "default",
      state: keyGiven ? `Physical key ${room} · ${cards} cards handed over` : "No lock provider · physical key",
    },
  ];

  // Opened on a guest checked in earlier: nothing below was done on this screen, so none of it is listed.
  const checks: { label: string; tone: Tone; state: string }[] = arrivedEarlier
    ? [
        {
          label: "Checked in",
          tone: "success",
          state: `${file.checkedInAt ? `At ${file.checkedInAt} · ` : ""}stay ${file.stayId} · room ${room}`,
        },
        { label: "Bill", tone: "default", state: "Open the stay for what is owed and what was paid" },
      ]
    : deskChecks;

  const allRecords = [
    {
      icon: "House",
      title: `Stay ${file.stayId}`,
      desc: `Room ${room} · ${file.dates}`,
      chip: "In house",
      tone: "success",
    },
    {
      icon: "Receipt",
      title: `Folio ${file.folioId}`,
      desc: nothingDue
        ? "Room paid online · extras settled at checkout"
        : payState === "cash"
          ? file.deposit.amount > cashTaken
            ? `${formatRwf(file.deposit.amount - cashTaken)} still due after the cash`
            : cashTaken > file.deposit.amount
              ? `${formatRwf(cashTaken - file.deposit.amount)} in credit for extras`
              : "Room paid · extras settled at checkout"
          : `${formatRwf(file.deposit.amount)} due`,
      chip: "Open",
      tone: "default",
    },
    { icon: "Calendar", title: `Booking ${file.id}`, desc: "Terms unchanged", chip: "Confirmed", tone: "default" },
    {
      icon: "Wallet",
      title: `Deposit ${file.depositId}`,
      desc: nothingDue && payState === "idle" ? payCheck[1] : pay === "later" ? "Collect at checkout" : payCheck[1],
      chip:
        nothingDue && payState === "idle"
          ? "Paid"
          : pay === "later"
            ? "Not taken"
            : payState === "verified"
              ? "Verified"
              : payState === "cash"
                ? "Recorded"
                : payState === "pending"
                  ? "Pending"
                  : "Not started",
      tone: paid || nothingDue ? "success" : "warning",
    },
  ] as const;
  // Opened on a guest checked in earlier: the stay and booking only. What is owed is on the stay's bill,
  // and no deposit was taken on this screen.
  const records = arrivedEarlier
    ? [
        allRecords[0],
        {
          icon: "Receipt",
          title: `Folio ${file.folioId}`,
          desc: "What is owed is on the stay's bill",
          chip: "Open",
          tone: "default",
        } as const,
        allRecords[2],
      ]
    : allRecords;

  const blocked =
    saving ||
    (step === 1 && !idOk) ||
    (step === 2 && !roomReady) ||
    (step === 3 && pay !== "later" && payState === "idle" && !nothingDue) ||
    (step === 4 && !keyGiven);
  const hint =
    step === 1
      ? idOk
        ? dup === "open"
          ? "The possible duplicate can be reviewed later in Guests"
          : "Ready for the room"
        : "Confirm the ID check to continue"
      : step === 2
        ? roomReady
          ? `Room ${room} is ready`
          : `Room ${room} is ${roomState ? ROOM_STATUS[roomState.status].label.toLowerCase() : "not marked ready"} · choose a clean or inspected room`
        : step === 3
          ? blocked
            ? "Take the deposit or choose pay at checkout"
            : nothingDue && payState === "idle"
              ? "Paid online when booked · nothing to take now"
              : payState === "cash" && cashTaken < file.deposit.amount
                ? `${formatRwf(file.deposit.amount - cashTaken)} stays due and is collected at checkout`
                : payState === "cash"
                  ? "Cash counted for check-in"
                  : "Settled for check-in"
          : step === 4
            ? keyGiven
              ? "Physical key handed over"
              : "Tick when the key cards are handed over"
            : "";

  const next = () => {
    if (blocked || step >= 5) return;
    const n = (step + 1) as Step;
    if (n === 5) {
      // Complete check-in: the stay and its bill open on the API, and cash counted at the desk is
      // recorded on that bill under the key minted when it was counted.
      startSaving(async () => {
        const result = await checkInGuest({
          bookingRef: file.id,
          roomLabel: room,
          // The cash the person typed and recorded, never the amount due.
          cash:
            payState === "cash" && cashKey && cashTaken > 0 ? { amountRwf: cashTaken, idempotencyKey: cashKey } : null,
        });
        if (!result.ok) {
          toast.danger(`Check-in needs attention: ${result.error}`);
          return;
        }
        setStep(5);
        setMaxStep(5);
      });
      return;
    }
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

  /** What the bill would owe (positive) or hold in credit (negative) once the typed cash is recorded. */
  // Whole francs only ("RWF 170,000" → 170000); a decimal part is refused with its reason, never folded in.
  const { amount: cashTyped, error: cashError } = readFrancs(cashIn);
  const leftAfterCash = file.deposit.amount - cashTyped;

  return (
    <PageContent className="text-[14px] leading-5">
      <Toast.Provider placement="bottom" />
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
            {/* Nothing locks an arrival to one desk; a second check-in of the same booking gets the same stay. */}
            <GateChip icon={<Lock className="size-3" />}>
              Opened {file.lockedSince} · checking in twice opens one stay
            </GateChip>
            <LinkButton href={screenHref("Messages")} variant="ghost">
              <Comment className="size-4" />
              Message
            </LinkButton>
            {/* Only a link: nothing typed here is kept until check-in is completed. */}
            <LinkButton href={screenHref("FrontDeskToday")} variant="secondary">
              Exit to Today
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
                <Chip size="sm" variant="soft" color={idSent ? "accent" : "default"}>
                  <Smartphone className="size-3" />
                  <Chip.Label>{idSent ? "ID sent from the guest app" : "No ID sent ahead"}</Chip.Label>
                </Chip>
              </div>

              {!file.duplicate.cards.length ? null : (
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
                      {/* Guest profiles per business are not built, so nothing can be linked or kept apart. */}
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => unavailable("Linking a stay to a guest profile")}
                      >
                        Same person · link this stay
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => unavailable("Recording two profiles as different people")}
                      >
                        Different people · keep separate
                      </Button>
                      <LinkButton href={screenHref("Guests")} size="sm" variant="ghost">
                        Compare in Guests
                      </LinkButton>
                    </div>
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
                  <Button size="sm" variant="ghost" onPress={() => unavailable("Opening the guest's document here")}>
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
                  Full document numbers stay masked. Compare the ID the guest hands you with the name on the booking.
                </p>
                <Checkbox isSelected={idOk} onChange={setIdOk}>
                  <Checkbox.Content className="flex items-center gap-2.5">
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="font-medium">I compared the ID photo and name with the guest at the desk</span>
                  </Checkbox.Content>
                </Checkbox>
                <p className="text-xs text-muted">
                  Your confirmation lets you continue; the stay does not record the ID check yet.
                </p>
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
                      <Chip size="sm" variant="soft" color="warning">
                        ID not received
                      </Chip>
                    </span>
                  </div>
                  <Button size="sm" variant="secondary" onPress={() => unavailable("Scanning a document")}>
                    <Camera className="size-4" />
                    Scan document
                  </Button>
                </div>
                {/* A stay records one guest's registration card; a second guest's document has nowhere to go yet. */}
                <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr))]">
                  <ChoiceSelect
                    label="Document type"
                    options={file.occupant.documentTypes}
                    value={file.occupant.documentTypes[0] ?? ""}
                    onChange={() => unavailable("Recording a second guest's document")}
                  />
                  <TextField isDisabled className="flex flex-col gap-1">
                    <Label>Document number</Label>
                    <Input placeholder="As printed" className="tabular" />
                  </TextField>
                </div>
                <p className="text-xs text-muted">
                  Recording a second guest's document is not available yet: nothing typed here would be kept.
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
                    {file.preAssignedRoom && room !== file.preAssignedRoom
                      ? `The guest is checked in to ${room}. ${file.preAssignedRoom} stays held for this booking until checkout; release it from Reservations if nobody else needs it.`
                      : "The stay opens in this room when you complete check-in."}
                  </Alert.Description>
                </Alert.Content>
              </Alert>
              <Card variant="secondary" className="gap-2.5 p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold">Need a room that isn't ready?</span>
                  <span className="text-[13px] text-muted">
                    Checking into a dirty or out-of-order room needs a manager's approval, and approvals are not
                    connected yet. Choose a ready room.
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
                      <Button size="sm" onPress={() => unavailable("Sending a room override for approval")}>
                        Send for approval
                      </Button>
                      <Button size="sm" variant="ghost" onPress={() => setOvr("none")}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : null}
              </Card>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="flex flex-col gap-4">
              <SectionTitle title="Deposit and Payment">
                {nothingDue ? (
                  <>
                    The stay was paid in full online when it was booked (voucher {file.deposit.voucher}), so there is
                    nothing to take now. Extras go on the bill and are settled at checkout.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-foreground tabular">{deposit}</span> is still due on booking{" "}
                    {file.deposit.voucher}. Take it now in cash, or leave it on the bill and collect it at checkout.
                  </>
                )}
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
                  {/* A prompt from the desk to the guest's phone has no route: the bill takes cash only. */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button onPress={() => unavailable(`A ${netLabel} payment request from the desk`)}>
                      <PaperPlane className="size-4" />
                      Send payment request
                    </Button>
                    <span className="text-xs text-muted">
                      Mobile money prompts are not connected yet. Take cash, or collect at checkout.
                    </span>
                  </div>
                </Card>
              ) : null}

              {pay === "cash" ? (
                <Card variant="secondary" className="gap-3 p-4">
                  <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                    <TextField
                      value={cashIn}
                      onChange={setCashIn}
                      isReadOnly={payState === "cash"}
                      isInvalid={!!cashError}
                      className="flex flex-col gap-1"
                    >
                      <Label>Cash received for the bill</Label>
                      <Input className="tabular" inputMode="numeric" />
                      <FieldError>{cashError}</FieldError>
                    </TextField>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">After this cash</span>
                      <output className="pt-1.5 text-lg font-semibold tabular" aria-live="polite">
                        {leftAfterCash > 0
                          ? `${formatRwf(leftAfterCash)} still due`
                          : leftAfterCash < 0
                            ? `${formatRwf(-leftAfterCash)} in credit`
                            : "Settled"}
                      </output>
                    </div>
                  </div>
                  <p className="text-xs text-muted">
                    Type what goes into the till for this bill, after any change you give back. Exactly that amount is
                    recorded; anything above {deposit} stays on the bill as credit for extras.
                  </p>
                  {payState === "idle" ? (
                    <div>
                      <Button
                        onPress={() => {
                          // One key per press, and the amount fixed at the press: what is recorded is what was typed.
                          setCashTaken(cashTyped);
                          setCashKey(crypto.randomUUID());
                          setCashAt(
                            new Intl.DateTimeFormat("en-GB", {
                              timeZone: "Africa/Kigali",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            }).format(new Date()),
                          );
                          setPayState("cash");
                        }}
                        isDisabled={cashTyped <= 0}
                      >
                        <Wallet className="size-4" />
                        Record {formatRwf(cashTyped)} cash
                      </Button>
                    </div>
                  ) : null}
                  {payState === "cash" ? (
                    <Alert status="default" role="status">
                      <Alert.Indicator>
                        <Wallet />
                      </Alert.Indicator>
                      <Alert.Content>
                        <Alert.Title>
                          {formatRwf(cashTaken)} counted for {file.deposit.till} · {cashAt}
                        </Alert.Title>
                        <Alert.Description>
                          This cash is recorded on the bill when you complete check-in.{" "}
                          <Button
                            size="sm"
                            variant="ghost"
                            onPress={() => {
                              setPayState("idle");
                              setCashKey(null);
                              setCashTaken(0);
                            }}
                          >
                            Change amount
                          </Button>
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
                    <Alert.Title>{nothingDue ? "Nothing to take now" : "Pay at checkout"}</Alert.Title>
                    <Alert.Description>
                      {nothingDue
                        ? "The bill opens with the room's online payment credited, so it owes nothing for the nights. Extras are collected at checkout."
                        : `Nothing is taken now. The bill opens with ${formatRwf(file.deposit.amount)} due, collected at checkout.`}
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              ) : null}
            </div>
          ) : null}

          {step === 4 ? (
            <div className="flex flex-col gap-4">
              <SectionTitle title="Key and Guest App">
                Hand over the room key and give {file.firstName} a way to open the stay in the guest app.
              </SectionTitle>
              <Alert status="default">
                <Alert.Indicator>
                  <Lock />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>No lock provider connected · issue physical key {room}</Alert.Title>
                  <Alert.Description>
                    Digital keys only appear when an authorised lock provider is connected to {property}.
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
                  <p className="text-xs text-muted">
                    A reminder for the desk: key cards are not recorded on the stay yet. Collect them at checkout.
                  </p>
                </Card>
                <Card variant="secondary" className="gap-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">Stay claim</span>
                    <Chip size="sm" variant="soft" color="default">
                      {file.claimCode ? "Not claimed" : "Made at check-in"}
                    </Chip>
                  </div>
                  <div className="flex items-start gap-3.5">
                    <div
                      role="img"
                      aria-label="Stay claim QR code"
                      className="flex size-[104px] flex-none items-center justify-center rounded-[14px] bg-surface shadow-surface"
                    >
                      <QrCode className="size-[72px]" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted">Claim code</span>
                      <span className="text-lg font-semibold tracking-[0.04em] tabular">
                        {file.claimCode || "None yet"}
                      </span>
                      <span className="text-xs text-muted">
                        {file.claimCode
                          ? `Stay ${file.stayId} · works once, when the guest claims it`
                          : "The stay does not exist yet"}
                      </span>
                    </div>
                  </div>
                  {/* POST /ops/stays/:id/claim-invite needs the stay, which completing check-in opens. SMS has no route. */}
                  <Button size="sm" variant="secondary" className="self-start" isDisabled>
                    <PaperPlane className="size-4" />
                    Email the claim code
                  </Button>
                  <p className="text-xs text-muted">
                    A guest who booked with an Injishi account finds the stay in their app once checked in, with no
                    code. For anyone else, email the code from the stay's page after check-in. Codes are not sent by
                    SMS.
                  </p>
                  <GateChip icon={<ShieldExclamation className="size-3" />} className="self-start">
                    A claim is not proof of identity
                  </GateChip>
                  <p className="text-xs text-muted">
                    Scanning links the trip in {file.firstName}'s app. The ID check in step 1 is still needed; the claim
                    doesn't replace it.
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
                    {file.guest} {arrivedEarlier ? "is already checked in" : "is checked in"} to room {room}
                  </h2>
                  <span className="text-[13px] text-muted">
                    {file.checkedInAt ? `Checked in ${file.checkedInAt}` : "Checked in"}
                    {file.stayId ? ` · stay ${file.stayId}` : ""} · signed in as {persona.name}
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
                <LinkButton href={screenHref("FrontDeskToday")} variant={arrivedEarlier ? "secondary" : "primary"}>
                  <ArrowLeft className="size-4" />
                  Back to Today
                </LinkButton>
                <LinkButton
                  href={file.stayId ? `/stays/${encodeURIComponent(file.stayId)}` : screenHref("FrontDeskToday")}
                  variant={arrivedEarlier ? "primary" : "secondary"}
                >
                  <Receipt className="size-4" />
                  {arrivedEarlier ? "Open the stay" : "Open stay folio"}
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
