"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowRotateRight,
  ArrowsRotateLeftSlash,
  ArrowsRotateRight,
  Check,
  CircleCheck,
  CircleExclamation,
  CircleInfo,
  ClockArrowRotateLeft,
  Copy,
  FileCheck,
  Lock,
  PersonsLock,
  ShieldKeyhole,
  TriangleExclamation,
  Xmark,
} from "@gravity-ui/icons";
import { Alert, Button, Checkbox, Chip, ProgressBar, Radio, RadioGroup, Skeleton, Spinner, Table } from "@heroui/react";
import { ActionBar, Segment, Stepper } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  BulkRoom,
  EvidenceLine,
  MakerCheckerRequest,
  PaymentStateCard,
  StateCopy,
  SubmissionStep,
  WriteOffReason,
} from "@injishi/data/fixtures/shared";
import { GateChip, Icon, LinkButton, SectionHeader, toneColor } from "@injishi/ui";
import { useState } from "react";
import { IconTile, PublicBar } from "./ui";

interface StatesData {
  payments: PaymentStateCard[];
  fiscal: StateCopy[];
  steps: SubmissionStep[];
  outcomes: StateCopy[];
  evidence: EvidenceLine[];
  reasons: WriteOffReason[];
  requests: MakerCheckerRequest[];
  rooms: BulkRoom[];
}

const SKEL = [70, 55, 80, 62];

/** High-stakes states (artifact: StatesGallery.dc.html). */
export function StatesGalleryView({ data }: { data: StatesData }) {
  const [attempts, setAttempts] = useState(2);
  const [retrying, setRetrying] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [done, setDone] = useState(false);
  const [view, setView] = useState("maker");
  const [bulk, setBulk] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.rooms.map((r) => [r.id, r.selected])),
  );
  const request = data.requests[0];
  const selected = data.rooms.filter((r) => bulk[r.id]);
  const cantConfirm = !reason || !ack;

  return (
    <>
      <PublicBar label="Injishi · High-stakes states" maxWidth={1376}>
        <span className="flex-1" />
        <LinkButton href={screenHref("Main")} variant="ghost" size="sm">
          <ArrowLeft className="size-4" />
          All roles
        </LinkButton>
      </PublicBar>
      <main className="mx-auto flex w-full max-w-[1376px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl leading-8 font-semibold tracking-[-0.015em]">
            How Injishi Shows What Is Really True
          </h1>
          <p className="text-sm text-muted">
            Money, fiscal and government states, plus the loading, error, recovery and approval patterns every screen
            reuses. Nothing claims success without the counterpart’s evidence.
          </p>
        </div>

        <section aria-labelledby="pay-h" className="flex flex-col gap-2.5">
          <SectionHeader
            id="pay-h"
            title="Payment States"
            action={
              <span className="text-xs text-muted">
                Only Verified looks like success, and it always shows provider, reference and time
              </span>
            }
          />
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
            {data.payments.map((p) => (
              <article
                key={p.id}
                className={`flex flex-col gap-1.5 rounded-2xl px-4 py-3.5 shadow-surface ${p.success ? "bg-success-soft" : "bg-surface"}`}
              >
                <Chip variant="soft" color={toneColor(p.tone)} className="self-start">
                  <Icon name={p.icon} className="size-3.5" />
                  <Chip.Label>{p.label}</Chip.Label>
                </Chip>
                <p className="text-[13px] leading-[19px]">{p.copy}</p>
                <span className="text-xs leading-4 text-muted tabular">{p.ref}</span>
              </article>
            ))}
          </div>
        </section>

        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))]">
          <section
            aria-labelledby="fis-h"
            className="flex flex-col gap-3 rounded-2xl bg-surface p-[18px] shadow-surface"
          >
            <div>
              <h2 id="fis-h" className="text-[15px] font-semibold">
                Fiscal Document States
              </h2>
              <p className="text-[13px] text-muted">EBM receipts signed by the VSDC</p>
            </div>
            <ul className="flex list-none flex-col gap-2 p-0">
              {data.fiscal.map((f) => (
                <li key={f.id} className="flex items-start gap-3">
                  <Chip
                    size="sm"
                    variant="soft"
                    color={toneColor(f.tone)}
                    className="min-w-[74px] shrink-0 justify-center"
                  >
                    {f.label}
                  </Chip>
                  <span className="text-[13px] leading-[19px]">{f.copy}</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-separator pt-2 text-xs leading-[17px] text-muted">
              Four different documents: a proforma is a quote, a commercial invoice says what is owed, a fiscal receipt
              is signed by the VSDC, a payment receipt confirms money received. Corrections are credit notes or refund
              receipts, never edits.
            </p>
          </section>

          <section
            aria-labelledby="sub-h"
            className="flex flex-col gap-3.5 rounded-2xl bg-surface p-[18px] shadow-surface"
          >
            <div>
              <h2 id="sub-h" className="text-[15px] font-semibold">
                Government and Partner Submissions
              </h2>
              <p className="text-[13px] text-muted">
                Tourism licence renewal to RDB · basis: licence conditions on file
              </p>
            </div>
            <Stepper orientation="horizontal" size="sm" currentStep={3} aria-label="Submission">
              {data.steps.map((s, i) => (
                <Stepper.Step key={s.id}>
                  <Stepper.Indicator>{s.complete ? <Check className="size-3" /> : i + 1}</Stepper.Indicator>
                  <Stepper.Content>
                    <Stepper.Title>{s.title}</Stepper.Title>
                    <Stepper.Description>{s.when}</Stepper.Description>
                  </Stepper.Content>
                  <Stepper.Separator />
                </Stepper.Step>
              ))}
            </Stepper>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr))]">
              {data.outcomes.map((o) => (
                <div key={o.id} className="flex flex-col gap-1 rounded-[14px] bg-surface-secondary px-3 py-2.5">
                  <Chip size="sm" variant="soft" color={toneColor(o.tone)} className="self-start">
                    {o.label}
                  </Chip>
                  <span className="text-xs leading-[17px]">{o.copy}</span>
                </div>
              ))}
            </div>
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <GateChip icon={<Lock className="size-3" />}>External gate</GateChip>
              <span className="text-muted">
                Sent by approved manual export. Sending is not acknowledgement; only the counterpart’s reference is.
              </span>
            </p>
          </section>
        </div>

        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
          <section
            aria-labelledby="ld-h"
            aria-busy="true"
            className="flex flex-col gap-2.5 rounded-2xl bg-surface p-[18px] shadow-surface"
          >
            <h2 id="ld-h" className="text-[15px] leading-[22px] font-semibold">
              Loading
            </h2>
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Arrivals, loading">
                  <Table.Header>
                    <Table.Column isRowHeader>Guest</Table.Column>
                    <Table.Column>Room</Table.Column>
                    <Table.Column className="text-right">Balance</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {SKEL.map((w) => (
                      <Table.Row key={w} id={`sk-${w}`}>
                        <Table.Cell>
                          <Skeleton className="block h-3 rounded-md" style={{ width: `${w}%` }} />
                        </Table.Cell>
                        <Table.Cell>
                          <Skeleton className="block h-3 w-8 rounded-md" />
                        </Table.Cell>
                        <Table.Cell>
                          <Skeleton className="ml-auto block h-3 w-[70px] rounded-md" />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
            <p className="text-xs text-muted">Skeletons match the final layout so nothing jumps when data arrives.</p>
          </section>

          <section
            aria-labelledby="ps-h"
            className="flex flex-col gap-2.5 rounded-2xl bg-surface p-[18px] shadow-surface"
          >
            <h2 id="ps-h" className="text-[15px] leading-[22px] font-semibold">
              Partial Sync
            </h2>
            <Alert status="warning" role="status">
              <Alert.Indicator>
                <ArrowsRotateLeftSlash />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Partly up to date</Alert.Title>
                <Alert.Description>
                  Bookings and rooms synced at 10:44. The channel manager last answered at 09:40, so availability on
                  other channels may be off by a room.
                </Alert.Description>
              </Alert.Content>
            </Alert>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary">
                <ArrowsRotateRight className="size-3.5" />
                Sync now
              </Button>
              <span className="text-xs text-muted">Showing saved data from 09:40</span>
            </div>
          </section>

          <section
            aria-labelledby="er-h"
            className="flex flex-col gap-2.5 rounded-2xl bg-surface p-[18px] shadow-surface"
          >
            <h2 id="er-h" className="text-[15px] leading-[22px] font-semibold">
              Error With Retry
            </h2>
            {retrying ? (
              <div role="status" className="flex items-center gap-2.5 rounded-[14px] bg-surface-secondary p-3.5">
                <Spinner size="sm" color="accent" aria-hidden="true" />
                <span className="text-[13px]">Retrying with the same request, so nothing is posted twice…</span>
              </div>
            ) : (
              <>
                <Alert status="danger" role="alert">
                  <Alert.Indicator>
                    <CircleExclamation />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Couldn’t load folio F-5590</Alert.Title>
                    <Alert.Description>
                      The server didn’t respond (attempt {attempts} at 10:4{attempts + 4}). Nothing was changed and your
                      notes are saved on this device.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onPress={() => {
                      setRetrying(true);
                      window.setTimeout(() => {
                        setRetrying(false);
                        setAttempts((n) => n + 1);
                      }, 1600);
                    }}
                  >
                    <ArrowRotateRight className="size-3.5" />
                    Retry
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Copy reference ERR-7Q2M-4410">
                    <Copy className="size-3.5" />
                    ERR-7Q2M-4410
                  </Button>
                </div>
              </>
            )}
            <p className="text-xs text-muted">Quote the reference to support; it links to the server log.</p>
          </section>

          <section
            aria-labelledby="ds-h"
            className="flex flex-col gap-2.5 rounded-2xl bg-surface p-[18px] shadow-surface"
          >
            <h2 id="ds-h" className="text-[15px] leading-[22px] font-semibold">
              Disabled, With a Reason
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" isDisabled aria-describedby="close-why">
                Close folio
              </Button>
              <Button size="sm" variant="secondary">
                Take payment
              </Button>
            </div>
            <p id="close-why" className="flex gap-2 text-[13px] leading-[19px]">
              <CircleInfo className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>RWF 165,200 is unpaid and one payment is Unknown. Close the folio once both are settled.</span>
            </p>
            <p className="flex gap-2 text-xs text-muted">
              <Lock className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              <span>At a permission boundary: “Rates are managed by your general manager.” No dead buttons.</span>
            </p>
          </section>

          <section
            aria-labelledby="sc-h"
            className="flex flex-col gap-2.5 rounded-2xl bg-surface p-[18px] shadow-surface"
          >
            <h2 id="sc-h" className="text-[15px] leading-[22px] font-semibold">
              Success, With Evidence
            </h2>
            <Alert status="success" role="status">
              <Alert.Indicator>
                <CircleCheck />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Check-out complete · Room 305</Alert.Title>
                <Alert.Description>Each step below was confirmed by its own system.</Alert.Description>
              </Alert.Content>
            </Alert>
            <ul className="flex list-none flex-col gap-1.5 p-0 text-xs leading-[17px]">
              {data.evidence.map((e) => (
                <li key={e.id} className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                  <span className="tabular">{e.text}</span>
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="rc-h"
            className="flex flex-col gap-2.5 rounded-2xl bg-surface p-[18px] shadow-surface"
          >
            <h2 id="rc-h" className="text-[15px] leading-[22px] font-semibold">
              Recovery
            </h2>
            {resumed ? (
              <>
                <ProgressBar value={75} aria-label="Check-in progress" color="accent" className="gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Step 3 of 4 · Guest signature</span>
                    <span className="text-sm">Resumed</span>
                  </div>
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
                <LinkButton href={screenHref("CheckIn")} size="sm" className="self-start">
                  Open check-in
                  <ArrowRight className="size-3.5" />
                </LinkButton>
              </>
            ) : (
              <>
                <Alert status="accent">
                  <Alert.Indicator>
                    <ClockArrowRotateLeft />
                  </Alert.Indicator>
                  <Alert.Content>
                    <Alert.Title>Resume check-in for Aisha Mohammed?</Alert.Title>
                    <Alert.Description>
                      The desk tablet lost its connection at 11:52 on step 3 of 4 (guest signature). The ID scan and
                      room 310 are saved.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
                <div className="flex gap-2">
                  <Button size="sm" onPress={() => setResumed(true)}>
                    Resume at signature
                  </Button>
                  <Button size="sm" variant="ghost">
                    Start over
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>

        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))]">
          <section
            role="dialog"
            aria-modal="false"
            aria-labelledby="wo-h"
            className="flex flex-col gap-3.5 rounded-2xl bg-surface p-[18px] shadow-surface"
          >
            <div className="flex items-start gap-3">
              <IconTile icon={<TriangleExclamation />} tone="danger" size={36} />
              <div className="flex flex-col gap-0.5">
                <h2 id="wo-h" className="text-base leading-[22px] font-semibold">
                  Write off RWF 85,000 on F-5577?
                </h2>
                <span className="text-xs text-muted">Irreversible · reason code required</span>
              </div>
            </div>
            {done ? (
              <Alert role="status">
                <Alert.Indicator>
                  <FileCheck />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Written off · {reason}</Alert.Title>
                  <Alert.Description>
                    F-5577 closed at 10:52 by Grace Uwera. Recorded in the audit log as AUD-26-30418.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : (
              <>
                <p className="text-[13px] leading-[19px]">
                  The folio closes and a bad-debt entry posts to the ledger. This can’t be undone; a later payment is
                  recorded as a recovery.
                </p>
                <RadioGroup aria-label="Reason code" value={reason ?? ""} onChange={setReason} className="gap-2">
                  {data.reasons.map((r) => (
                    <Radio key={r.id} value={r.id} isDisabled={r.disabled}>
                      <Radio.Content className="items-start">
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <span className="flex flex-col">
                          <span>{r.label}</span>
                          <span className="text-[13px] text-muted">{r.desc}</span>
                        </span>
                      </Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
                <Checkbox isSelected={ack} onChange={setAck}>
                  <Checkbox.Content className="gap-2">
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="text-[13px]">I understand this can’t be undone</span>
                  </Checkbox.Content>
                </Checkbox>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="ghost">
                    Cancel
                  </Button>
                  <Button size="sm" variant="danger" isDisabled={cantConfirm} onPress={() => setDone(true)}>
                    Write off RWF 85,000
                  </Button>
                </div>
                <p className="text-right text-xs text-muted">
                  {cantConfirm
                    ? "Choose a reason code and confirm to continue."
                    : "Write-offs above RWF 50,000 also ask for an authenticator code."}
                </p>
              </>
            )}
          </section>

          {request ? (
            <section
              aria-labelledby="mc-h"
              className="flex flex-col gap-3 rounded-2xl bg-surface p-[18px] shadow-surface"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="mc-h" className="text-[15px] leading-[22px] font-semibold">
                  Maker and Checker
                </h2>
                <Segment aria-label="View as" selectedKey={view} onSelectionChange={(k) => setView(String(k))}>
                  <Segment.Item id="maker">Aline · preparer</Segment.Item>
                  <Segment.Item id="checker">Didier · approver</Segment.Item>
                </Segment>
              </div>
              <div className="flex flex-col gap-2.5 rounded-2xl bg-surface-secondary px-4 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold">{request.title}</span>
                    <span className="text-xs text-muted">{request.context}</span>
                  </div>
                  <Chip size="sm" variant="soft" color="warning">
                    {request.status}
                  </Chip>
                </div>
                <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs">
                  {request.facts.map((f) => (
                    <div key={f.label} className="contents">
                      <dt className="text-muted">{f.label}</dt>
                      <dd className="font-medium">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {view === "maker" ? (
                <>
                  <Alert>
                    <Alert.Indicator>
                      <PersonsLock />
                    </Alert.Indicator>
                    <Alert.Content>
                      <Alert.Title>You prepared this — another approver must confirm</Alert.Title>
                      <Alert.Description>
                        Waiting for {request.approver} ({request.approverRole}) since {request.preparedAt}. You can
                        withdraw it, but you can’t approve your own request.
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                  <div className="flex gap-2">
                    <Button size="sm" isDisabled>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost">
                      Withdraw request
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[13px] leading-[19px]">
                    {request.preparedBy} prepared this. Approving asks for your authenticator code and sends the refund
                    to MTN MoMo; it shows as Pending until the provider confirms.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <LinkButton href={screenHref("Approvals")} size="sm">
                      <ShieldKeyhole className="size-3.5" />
                      Approve with code
                    </LinkButton>
                    <Button size="sm" variant="secondary">
                      Send back with a note
                    </Button>
                  </div>
                </>
              )}
            </section>
          ) : null}

          <section
            aria-labelledby="cmd-h"
            className="flex flex-col gap-3 rounded-2xl bg-surface p-[18px] shadow-surface"
          >
            <div>
              <h2 id="cmd-h" className="text-[15px] font-semibold">
                Command Hierarchy
              </h2>
              <p className="text-[13px] text-muted">Five kinds of action, each with its own weight</p>
            </div>
            <ul className="flex list-none flex-col gap-2.5 p-0">
              <li className="flex items-center justify-between gap-2.5">
                <span className="flex flex-col">
                  <span className="text-[13px] font-medium">Primary</span>
                  <span className="text-xs text-muted">One per screen, the main job</span>
                </span>
                <Button size="sm">Check in</Button>
              </li>
              <li className="flex items-center justify-between gap-2.5">
                <span className="flex flex-col">
                  <span className="text-[13px] font-medium">Inline</span>
                  <span className="text-xs text-muted">Beside the record it acts on</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-[13px] tabular">Room 204</span>
                  <Button size="sm" variant="ghost">
                    Assign
                  </Button>
                </span>
              </li>
              <li className="flex items-center justify-between gap-2.5">
                <span className="flex flex-col">
                  <span className="text-[13px] font-medium">Approval</span>
                  <span className="text-xs text-muted">Goes to someone with authority</span>
                </span>
                <Button size="sm" variant="secondary">
                  Send for approval
                </Button>
              </li>
              <li className="flex items-center justify-between gap-2.5">
                <span className="flex flex-col">
                  <span className="text-[13px] font-medium">Irreversible</span>
                  <span className="text-xs text-muted">Confirm, reason code, maybe step-up</span>
                </span>
                <Button size="sm" variant="danger-soft">
                  Write off…
                </Button>
              </li>
            </ul>
            <div className="flex flex-col gap-1.5 border-t border-separator pt-2.5">
              <span className="text-[13px] font-medium">Bulk · appears when rows are selected</span>
              {data.rooms.map((b) => (
                <Checkbox
                  key={b.id}
                  isSelected={!!bulk[b.id]}
                  onChange={(on) => setBulk((p) => ({ ...p, [b.id]: on }))}
                  className="w-full"
                >
                  <Checkbox.Content className="w-full gap-2">
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="flex-1 text-[13px] tabular">{b.label}</span>
                    <Chip size="sm" variant="soft" color={toneColor(b.statusTone)}>
                      {b.status}
                    </Chip>
                  </Checkbox.Content>
                </Checkbox>
              ))}
              {selected.length ? (
                <ActionBar aria-label="Bulk actions" isOpen isAttached={false} className="mt-1">
                  <ActionBar.Prefix>
                    <Chip size="sm" variant="soft" color="accent">
                      {selected.length} selected
                    </Chip>
                  </ActionBar.Prefix>
                  <ActionBar.Content>
                    <Button size="sm" variant="ghost">
                      Assign housekeeper
                    </Button>
                    <Button size="sm" variant="ghost">
                      Mark priority
                    </Button>
                  </ActionBar.Content>
                  <ActionBar.Suffix>
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
                      aria-label="Clear selection"
                      onPress={() => setBulk({})}
                    >
                      <Xmark className="size-4" />
                    </Button>
                  </ActionBar.Suffix>
                </ActionBar>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
