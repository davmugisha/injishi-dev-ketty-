"use client";

import { Check, CircleCheck, CircleXmark, Comment, Hourglass, TriangleExclamation, Xmark } from "@gravity-ui/icons";
import { Alert, Avatar, Button, Drawer, FieldError, Label, TextArea, TextField } from "@heroui/react";
import { Stepper } from "@heroui-pro/react";
import { KeyValueList, LinkButton } from "@injishi/ui";
import { useState } from "react";
import type { LeaveRequest, LeaveStep } from "../../model/people.ts";
import type { Persona } from "../../model/shared.ts";
import { useBoardHref } from "../mount.tsx";
import { avatarColor, firstName, initials } from "./parts";

/** What the API names when a person's manager is not on file: not somebody to message. */
const NO_MANAGER = "No line manager";

const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

/**
 * One leave request, opened from the queue: its steps, what it does to the balance and the roster, and
 * what the person signed in can do with it. Anyone who holds `leave.approve` may decide either step the
 * API lets them, so the first step never waits on one manager; approved leave can still be cancelled.
 */
export function LeaveDecisionDrawer({
  request,
  step,
  isOpen,
  pending,
  persona,
  onOpenChange,
  onDecide,
  onCancel,
}: {
  request: LeaveRequest | null;
  /** The step as the screen shows it: a decision just taken counts before the page reloads. */
  step: LeaveStep;
  isOpen: boolean;
  pending: boolean;
  persona: Persona;
  onOpenChange: (open: boolean) => void;
  onDecide: (decision: "approved" | "declined", reason: string | null) => void;
  onCancel: (reason: string) => void;
}) {
  return (
    <Drawer.Backdrop isOpen={isOpen && request !== null} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog aria-labelledby="dec-h" className="w-full max-w-[520px]">
          <Drawer.CloseTrigger aria-label="Close" />
          {request ? (
            <DrawerBody
              key={request.id}
              cur={request}
              st={step}
              pending={pending}
              persona={persona}
              onDecide={onDecide}
              onCancel={onCancel}
            />
          ) : null}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

function DrawerBody({
  cur,
  st,
  pending,
  persona,
  onDecide,
  onCancel,
}: {
  cur: LeaveRequest;
  st: LeaveStep;
  pending: boolean;
  persona: Persona;
  onDecide: (decision: "approved" | "declined", reason: string | null) => void;
  onCancel: (reason: string) => void;
}) {
  const screenHref = useBoardHref();
  const [declining, setDeclining] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [why, setWhy] = useState("");
  const [whyErr, setWhyErr] = useState(false);

  const first = firstName(cur.name);
  const hrDone = st === "approved" || st === "declined";
  // A one-step leave type has no line manager step at all; the source leaves `lm` empty for it.
  const hasLmStep = Boolean(cur.lm);
  const canMessage = hasLmStep && cur.lm !== NO_MANAGER;
  const undecided = st === "hr" || st === "lm";
  const canDecide = undecided && !cur.blockedWhy && !cur.hrDecision;

  const decline = () => {
    if (!declining) {
      setDeclining(true);
      return;
    }
    if (!why.trim()) {
      setWhyErr(true);
      return;
    }
    onDecide("declined", why.trim());
  };
  const cancelLeave = () => {
    if (!cancelling) {
      setCancelling(true);
      return;
    }
    if (why.trim().length < 3) {
      setWhyErr(true);
      return;
    }
    onCancel(why.trim());
  };

  const steps = [
    { title: `Requested by ${first}`, desc: cur.sub, cross: false, unreached: false },
    ...(hasLmStep
      ? [
          {
            title:
              st === "lm"
                ? `Line manager · ${cur.lm}`
                : st === "lmdeclined"
                  ? `Declined by ${cur.lm}`
                  : `Approved by ${cur.lm}`,
            desc: st === "lm" ? `Since ${cur.sub.split(" ·")[0]}` : cur.lmNote,
            cross: st === "lmdeclined",
            unreached: false,
          },
        ]
      : []),
    {
      title: st === "approved" ? "Approved by HR" : st === "declined" ? "Declined by HR" : "HR · you",
      desc: hrDone ? (cur.by ?? `${persona.name} · just now`) : st === "hr" ? "Your decision" : "Not reached",
      cross: st === "declined",
      unreached: st === "lmdeclined",
    },
  ];
  // The step now open, counted from the first: with no line manager step, HR is the second of two.
  const currentStep = (st === "lm" ? 1 : st === "hr" || st === "lmdeclined" ? 2 : 3) - (hasLmStep ? 0 : 1);

  const outcome =
    st === "approved"
      ? {
          status: "success" as const,
          icon: <CircleCheck />,
          title: "Approved",
          text: cur.by ?? `Balance now ${cur.balance.split("→ ")[1] ?? cur.balance}`,
        }
      : st === "declined"
        ? {
            status: "default" as const,
            icon: <CircleXmark />,
            title: "Declined",
            text: `“${cur.hrReason || "See note"}”`,
          }
        : st === "lmdeclined"
          ? {
              status: "default" as const,
              icon: <CircleXmark />,
              title: "Manager declined",
              text: cur.by ?? "",
            }
          : null;

  return (
    <>
      <Drawer.Header className="flex flex-row items-start gap-3 pr-12">
        <Avatar variant="soft" color={avatarColor(cur.name)}>
          <Avatar.Fallback>{initials(cur.name)}</Avatar.Fallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Drawer.Heading id="dec-h" className="text-base leading-[22px] font-semibold">
            {cur.name}
          </Drawer.Heading>
          <span className="text-[13px] text-muted">
            {cur.type} · {cur.dates} · {days(cur.days)}
          </span>
        </div>
      </Drawer.Header>
      <Drawer.Body className="flex flex-col gap-3.5 [&>*]:shrink-0">
        <Stepper orientation="vertical" size="sm" currentStep={currentStep} aria-label="Approval steps">
          {steps.map((s, i) => (
            <Stepper.Step key={s.title}>
              {s.unreached ? (
                <Stepper.Indicator className="border-border bg-transparent text-muted">{i + 1}</Stepper.Indicator>
              ) : s.cross ? (
                <Stepper.Indicator>
                  <Xmark className="size-3" />
                </Stepper.Indicator>
              ) : (
                <Stepper.Indicator />
              )}
              <Stepper.Content>
                <Stepper.Title className={`text-sm ${s.unreached ? "text-muted" : ""}`}>{s.title}</Stepper.Title>
                <Stepper.Description className={s.unreached ? "opacity-60" : ""}>{s.desc}</Stepper.Description>
              </Stepper.Content>
              <Stepper.Separator />
            </Stepper.Step>
          ))}
        </Stepper>

        <KeyValueList
          items={[
            { label: "Balance", value: <span className="tabular">{cur.balance}</span> },
            { label: "Roster", value: cur.roster },
            { label: "Evidence", value: cur.attach },
          ]}
        />

        {cur.warn && undecided ? (
          <Alert status="warning">
            <Alert.Indicator>
              <TriangleExclamation />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>{cur.warn}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}

        {st === "lm" ? (
          <Alert>
            <Alert.Indicator>
              <Hourglass />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>{canMessage ? `Waiting for ${cur.lm}` : "No line manager on file"}</Alert.Title>
              {canDecide ? (
                <Alert.Description>You can decide this step. Someone else then decides the next one.</Alert.Description>
              ) : null}
            </Alert.Content>
          </Alert>
        ) : null}
        {st === "lm" && canMessage ? (
          <LinkButton href={screenHref("Messages")} variant="secondary" className="self-start">
            <Comment className="size-4" />
            {`Message ${firstName(cur.lm)}`}
          </LinkButton>
        ) : null}

        {undecided && cur.blockedWhy ? (
          <Alert>
            <Alert.Indicator>
              <Hourglass />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>{cur.blockedWhy}</Alert.Title>
            </Alert.Content>
          </Alert>
        ) : null}

        {outcome ? (
          <Alert status={outcome.status}>
            <Alert.Indicator>{outcome.icon}</Alert.Indicator>
            <Alert.Content>
              <Alert.Title>{outcome.title}</Alert.Title>
              <Alert.Description>{outcome.text}</Alert.Description>
            </Alert.Content>
          </Alert>
        ) : null}

        {canDecide ? (
          <div className="flex flex-col gap-2">
            {declining ? (
              <TextField
                value={why}
                onChange={(v) => {
                  setWhy(v);
                  setWhyErr(false);
                }}
                isInvalid={whyErr}
                className="flex flex-col gap-1"
              >
                <Label>Reason for declining</Label>
                <TextArea rows={2} placeholder={`Sent to ${first} and the line manager`} />
                <FieldError>Add a reason.</FieldError>
              </TextField>
            ) : null}
            <div className="flex items-center gap-2">
              <Button className="flex-1" onPress={() => onDecide("approved", null)} isDisabled={pending}>
                <Check className="size-4" />
                Approve
              </Button>
              <Button variant="secondary" onPress={decline} isDisabled={pending}>
                {declining ? "Confirm decline" : "Decline"}
              </Button>
            </div>
          </div>
        ) : null}

        {st === "approved" ? (
          <div className="flex flex-col gap-2">
            {cancelling ? (
              <>
                <TextField
                  value={why}
                  onChange={(v) => {
                    setWhy(v);
                    setWhyErr(false);
                  }}
                  isInvalid={whyErr}
                  className="flex flex-col gap-1"
                >
                  <Label>Reason for cancelling</Label>
                  <TextArea rows={2} placeholder={`${first} reads this`} />
                  <FieldError>Add a reason.</FieldError>
                </TextField>
                <p className="text-xs leading-4 text-muted">
                  The days go back on the balance. Shifts taken off for this leave stay off the roster.
                </p>
              </>
            ) : null}
            <div className="flex items-center gap-2">
              <Button variant="danger-soft" onPress={cancelLeave} isDisabled={pending}>
                {cancelling ? "Confirm cancel" : "Cancel this leave"}
              </Button>
              {cancelling ? (
                <Button variant="ghost" onPress={() => setCancelling(false)}>
                  Keep it
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Drawer.Body>
    </>
  );
}
