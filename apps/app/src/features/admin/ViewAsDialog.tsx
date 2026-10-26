"use client";

import { ArrowUpRightFromSquare, CircleCheck, CircleCheckFill, Eye, PersonsLock } from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  Skeleton,
  TextArea,
  TextField,
} from "@heroui/react";
import { ListView, RadioButtonGroup, Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type { Business, ViewAsSession } from "@injishi/data/fixtures/admin";
import { KeyValueList, LinkButton, TextLink } from "@injishi/ui";
import { useState } from "react";
import { clockAfter, OptionSelect } from "./shared";

export type AccessMode = "read" | "assist";

const LIMITS = [15, 30, 60];

const MODES: { id: AccessMode; label: string; desc: string }[] = [
  {
    id: "read",
    label: "Read-only",
    desc: "Default. Every change is blocked; you can navigate, search and open records.",
  },
  {
    id: "assist",
    label: "Assisted changes",
    desc: "Owner consents in-app and a second staff member approves. Money, payroll and fiscal actions stay blocked.",
  },
];

const REASONS = [
  { id: "ticket", label: "Investigate a support ticket" },
  { id: "kyb", label: "Review KYB documents with the owner" },
  { id: "incident", label: "Check the impact of an incident" },
];

/** Compliance reviewer who approves sessions outside policy VA-1. */
const REVIEWER = "Bosco Rutayisire";

/**
 * "View as" dialog: start a justified, time-limited and logged session inside a tenant workspace
 * (artifact: AdminBusinesses .ij-dialog).
 */
export function ViewAsDialog({
  business: b,
  staffName,
  sessions,
  isOpen,
  limit,
  mode,
  started,
  onLimit,
  onMode,
  onStart,
  onClose,
}: {
  business: Business;
  staffName: string;
  sessions: ViewAsSession[];
  isOpen: boolean;
  limit: number;
  mode: AccessMode;
  started: boolean;
  onLimit: (minutes: number) => void;
  onMode: (mode: AccessMode) => void;
  onStart: () => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(REASONS[0].id);
  const ends = clockAfter(limit);
  const needsApproval = mode === "assist" || limit > 30;
  const consentRequired = b.consent === "consent";
  const pending = started && (needsApproval || consentRequired);
  const ticket = b.ticket?.id ?? "No open ticket";
  const modeLabel = mode === "read" ? "Read-only" : "Assisted changes";
  const startLabel = needsApproval
    ? "Request approval"
    : consentRequired
      ? "Ask owner for consent"
      : "Start read-only session";

  const log = started
    ? pending
      ? [
          {
            id: "req",
            t: "09:42:31",
            text: `View-as requested · ${modeLabel.toLowerCase()}`,
            meta: `${staffName} · ${b.ticket?.id ?? ""}`,
          },
          {
            id: "sent",
            t: "09:42:31",
            text: consentRequired ? "Consent request sent to owner" : `Approval request sent to ${REVIEWER}`,
            meta: "Expires 09:57",
          },
        ]
      : [
          {
            id: "start",
            t: "09:42:31",
            text: `Session started · read-only · ${limit} min`,
            meta: `${staffName} · ${b.ticket?.id ?? ""}`,
          },
          { id: "notified", t: "09:42:31", text: "Owner notified in-app and by email", meta: b.owner },
          {
            id: "banner",
            t: "09:42:32",
            text: "Banner shown in workspace",
            meta: "All signed-in users of this business",
          },
        ]
    : sessions.length
      ? sessions.map((v) => ({
          id: v.id,
          t: v.started,
          text:
            v.status === "open" ? `${v.id} · ${v.staff} · ${v.mode} · open` : `${v.id} · ${v.staff} · ${v.duration}`,
          meta:
            v.status === "open"
              ? `${v.ticket} · ${v.events} events so far · ends ${v.ends}`
              : `${v.ticket} · ${v.events} events · ended by ${v.endedBy}`,
        }))
      : [
          {
            id: "none",
            t: "—",
            text: "No view-as sessions in the last 90 days",
            meta: "Sessions appear here with their full event log",
          },
        ];
  const logTitle = started ? "This session" : "Previous sessions for this business";

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => (open ? undefined : onClose())}>
      <Modal.Container size="lg" scroll="outside">
        <Modal.Dialog aria-labelledby="va-h" className="gap-5 sm:max-w-[900px]">
          <Modal.CloseTrigger aria-label="Close" />
          <Modal.Header className="flex-row items-start gap-3 pr-8">
            <Avatar variant="soft" color="warning">
              <Avatar.Fallback>
                <Eye className="size-4" />
              </Avatar.Fallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Modal.Heading id="va-h" className="text-lg leading-[26px] font-semibold">
                View {b.name} as support
              </Modal.Heading>
              <p className="text-[13px] leading-[18px] text-muted">
                You see what the owner sees. Card numbers, ID document images and salaries stay masked in every mode.
              </p>
            </div>
          </Modal.Header>

          <Modal.Body className="flex flex-wrap items-start gap-5 overflow-visible">
            <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-[14px]">
              {started ? (
                <>
                  <Alert status="success" role="status">
                    <Alert.Indicator>
                      <CircleCheck />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>
                        {pending
                          ? `Waiting for ${consentRequired ? `${b.owner}’s consent` : "approval"}`
                          : "Session VS-0385 started"}
                      </Alert.Title>
                      <Alert.Description>
                        {pending
                          ? `Nothing in the workspace is visible until ${consentRequired ? "the owner accepts" : `${REVIEWER} approves`}. The request expires in 15 minutes.`
                          : `The banner is showing in the workspace. ${b.owner} has been notified.`}
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                  <KeyValueList
                    items={[
                      { label: "Session", value: <span className="tabular">VS-0385</span> },
                      { label: "Mode", value: modeLabel },
                      { label: "Ticket", value: ticket },
                      { label: "Ends", value: <span className="tabular">{ends} CAT</span> },
                      { label: "Step-up", value: "Authenticator · 09:31" },
                    ]}
                  />
                </>
              ) : (
                <>
                  <OptionSelect label="Reason" options={REASONS} value={reason} onChange={setReason} />
                  <TextField fullWidth defaultValue={b.why}>
                    <Label>What you need to check</Label>
                    <TextArea rows={2} />
                  </TextField>
                  <TextField fullWidth defaultValue={b.ticket?.id ?? ""} isInvalid={!b.ticket}>
                    <Label>Ticket</Label>
                    <Input placeholder="SUP-0000" />
                    {b.ticket ? (
                      <Description>{b.ticket.note}</Description>
                    ) : (
                      <FieldError>
                        Link an open ticket to continue. Sessions without a ticket are not allowed.
                      </FieldError>
                    )}
                  </TextField>
                  <div className="flex flex-col gap-1.5">
                    <Label elementType="span" id="va-limit">
                      Time limit
                    </Label>
                    <Segment
                      aria-labelledby="va-limit"
                      className="w-full"
                      selectedKey={String(limit)}
                      onSelectionChange={(k) => onLimit(Number(k))}
                    >
                      {LIMITS.map((m) => (
                        <Segment.Item key={m} id={String(m)} className="flex-1">
                          {m} min
                        </Segment.Item>
                      ))}
                    </Segment>
                    <span className="text-xs leading-4 text-muted">
                      Ends automatically at {ends} CAT.{" "}
                      {limit > 30
                        ? "Over 30 minutes needs approval from the on-duty compliance reviewer."
                        : "Policy VA-1 pre-approves read-only sessions up to 30 minutes on an open ticket."}
                    </span>
                  </div>
                  <RadioButtonGroup
                    value={mode}
                    onChange={(v) => onMode(v as AccessMode)}
                    className="flex flex-col gap-2"
                  >
                    <Label>Access</Label>
                    {MODES.map((m) => (
                      <RadioButtonGroup.Item key={m.id} value={m.id}>
                        <RadioButtonGroup.Indicator>
                          <CircleCheckFill />
                        </RadioButtonGroup.Indicator>
                        <RadioButtonGroup.ItemContent>
                          <Label className="text-sm font-semibold">{m.label}</Label>
                          <Description className="text-xs leading-4">{m.desc}</Description>
                        </RadioButtonGroup.ItemContent>
                      </RadioButtonGroup.Item>
                    ))}
                  </RadioButtonGroup>
                  <Alert>
                    <Alert.Indicator>
                      <PersonsLock />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>
                        Consent policy · {consentRequired ? "Owner consent required" : "Notify the owner"}
                      </Alert.Title>
                      <Alert.Description>
                        {consentRequired
                          ? `${b.owner} set this workspace to require consent. The session starts only after they accept in the app or by SMS.`
                          : `${b.owner} is told in-app and by email when the session starts and ends.`}
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                </>
              )}
            </div>

            <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-[14px]">
              <div className="flex flex-col gap-1.5">
                <Label elementType="span">Banner the owner and you will see</Label>
                <Card variant="secondary" className="gap-2 p-2.5">
                  <div className="flex items-center gap-2.5 rounded-xl bg-warning-soft px-3 py-2 text-xs leading-4 text-warning-soft-foreground">
                    <Eye className="size-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1">
                      <strong>Injishi support · {staffName}</strong> is viewing this workspace ·{" "}
                      {mode === "read" ? "Read-only" : "Assisted"} · ends {ends} · {ticket}
                    </span>
                    <span className="font-semibold underline">End session</span>
                  </div>
                  <div className="flex gap-2 px-1" aria-hidden="true">
                    <Skeleton animationType="none" className="h-2.5 w-[30%] rounded-md" />
                    <Skeleton animationType="none" className="h-2.5 w-[45%] rounded-md" />
                  </div>
                </Card>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label elementType="span">{logTitle}</Label>
                  <TextLink href={screenHref("AdminAudit")} className="text-xs">
                    Full audit log
                  </TextLink>
                </div>
                <ListView aria-label={logTitle} variant="secondary" items={log}>
                  {(l) => (
                    <ListView.Item id={l.id} textValue={l.text}>
                      <ListView.ItemContent>
                        <span className="w-[58px] flex-none text-xs text-muted tabular">{l.t}</span>
                        <div className="flex min-w-0 flex-col">
                          <ListView.Title className="text-[13px] whitespace-normal">{l.text}</ListView.Title>
                          <ListView.Description className="whitespace-normal">{l.meta}</ListView.Description>
                        </div>
                      </ListView.ItemContent>
                    </ListView.Item>
                  )}
                </ListView>
                <p className="text-xs leading-4 text-muted">
                  Every page, search and export in a session is written to the audit log and shown to the owner under
                  Settings › Audit log.
                </p>
              </div>
            </div>
          </Modal.Body>

          <Modal.Footer className="flex-wrap items-center justify-end gap-2 border-t border-separator pt-[14px]">
            {started ? (
              <>
                <Button variant="danger-soft" onPress={onClose}>
                  End session
                </Button>
                {pending ? null : (
                  <LinkButton href={screenHref("OwnerHome")}>
                    <ArrowUpRightFromSquare className="size-4" />
                    Open workspace read-only
                  </LinkButton>
                )}
              </>
            ) : (
              <>
                <span className="text-xs text-muted">
                  {needsApproval ? `Goes to ${REVIEWER}` : "Uses your step-up from 09:31"}
                </span>
                <Button variant="secondary" onPress={onClose}>
                  Cancel
                </Button>
                <Button isDisabled={!b.ticket} onPress={onStart}>
                  {startLabel}
                </Button>
              </>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
