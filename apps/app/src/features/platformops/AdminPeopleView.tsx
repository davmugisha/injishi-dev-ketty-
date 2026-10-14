"use client";

import { Ban, Check, CircleCheck, CircleDashed, CircleXmark, Clock, Lock, PersonPlus } from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Chip, Label, ProgressBar, Table, Tag, TagGroup } from "@heroui/react";
import type { AccessReview, Broker, RoleFamily, StaffMember, Tone } from "@injishi/data/fixtures/platformops";
import { GateChip, PageContent, PageHeader, SectionHeader, StatusDot } from "@injishi/ui";
import { useState } from "react";
import { firstKey, initials, selectableRow, ToneChip } from "./shared";

export interface AdminPeopleData {
  families: RoleFamily[];
  staff: StaffMember[];
  reviews: AccessReview[];
  brokers: Broker[];
}

const REASONS = ["Fees above disclosed terms", "Misrepresentation", "Identity concerns"];

const CHECK_ICON = {
  ok: { Icon: CircleCheck, className: "text-success" },
  bad: { Icon: CircleXmark, className: "text-danger" },
  optional: { Icon: CircleDashed, className: "text-muted" },
} as const;

type Decision = "keep" | "revoke";

function familyOf(families: RoleFamily[], id: string): RoleFamily {
  const found = families.find((f) => f.id === id);
  if (!found) throw new Error(`missing role family ${id}`);
  return found;
}

export function AdminPeopleView({ data }: { data: AdminPeopleData }) {
  const [sel, setSel] = useState("patience");
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [brokerId, setBrokerId] = useState("twagira");
  const [reason, setReason] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});

  const person = data.staff.find((s) => s.id === sel) ?? data.staff[0];
  const family = person ? familyOf(data.families, person.family) : data.families[0];
  const self = person?.name === "Kevin Mugisha";
  const broker = data.brokers.find((b) => b.id === brokerId) ?? data.brokers[0];
  const decidedCount = 9 + Object.keys(decisions).length;
  const pct = Math.round((decidedCount / 14) * 100);

  const reviewLabel = (s: StaffMember): { text: string; tone: Tone } => {
    const d = s.reviewId ? decisions[s.reviewId] : undefined;
    if (d === "keep") return { text: "Reviewed", tone: "success" };
    if (d === "revoke") return { text: "Revoked", tone: "danger" };
    return { text: s.review, tone: s.reviewTone };
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow="Platform › Staff and brokers"
        title="Staff and Brokers"
        description="Injishi staff roles are their own universe: no business role opens this console, and no staff role can join a tenant’s Team & roles."
        actions={
          <Button variant="secondary">
            <PersonPlus />
            Invite staff member
          </Button>
        }
      />

      <div className="flex flex-wrap items-start gap-4">
        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-2.5" aria-labelledby="st-h">
          <div className="flex items-end justify-between gap-2">
            <SectionHeader id="st-h" title="Platform Staff" />
            <span className="text-xs text-muted">
              11 people · 4 role families · MFA required for every console sign-in
            </span>
          </div>
          <Table>
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Platform staff"
                selectionMode="single"
                selectionBehavior="replace"
                disallowEmptySelection
                selectedKeys={new Set([person?.id ?? "patience"])}
                onSelectionChange={(keys) => {
                  const k = firstKey(keys as "all" | Set<Key>);
                  if (k) setSel(k);
                }}
              >
                <Table.Header>
                  <Table.Column isRowHeader>Person</Table.Column>
                  <Table.Column>Staff role</Table.Column>
                  <Table.Column>MFA</Table.Column>
                  <Table.Column className="text-right">View-as · 30 d</Table.Column>
                  <Table.Column>Access review</Table.Column>
                </Table.Header>
                <Table.Body>
                  {data.staff.map((s) => {
                    const fam = familyOf(data.families, s.family);
                    const rev = reviewLabel(s);
                    return (
                      <Table.Row key={s.id} id={s.id} className={selectableRow}>
                        <Table.Cell>
                          <span className="flex items-center gap-2.5">
                            <Avatar size="sm" variant="soft" color="accent">
                              <Avatar.Fallback>{initials(s.name)}</Avatar.Fallback>
                            </Avatar>
                            <span className="flex flex-col">
                              <span className="font-medium">{s.name}</span>
                              <span className="text-xs text-muted">Active {s.lastActive}</span>
                            </span>
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <ToneChip tone={fam.tone}>{s.role}</ToneChip>
                        </Table.Cell>
                        <Table.Cell>
                          <span className="flex items-center gap-1.5 text-[13px]">
                            <StatusDot tone={s.mfaTone} />
                            {s.mfa}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="text-right tabular">{s.viewAs}</Table.Cell>
                        <Table.Cell>
                          <ToneChip tone={rev.tone}>{rev.text}</ToneChip>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </section>

        {person && family ? (
          <Card className="min-w-0 flex-[1_1_340px] gap-3 p-[18px]" aria-labelledby="who-h">
            <div className="flex items-start gap-3">
              <Avatar size="md" variant="soft" color="accent">
                <Avatar.Fallback>{initials(person.name)}</Avatar.Fallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h2 id="who-h" className="text-[17px] leading-6 font-semibold">
                  {person.name}
                </h2>
                <span className="text-xs text-muted">
                  {person.role} · {person.family} family
                </span>
              </div>
              <ToneChip tone={family.tone}>Injishi staff</ToneChip>
            </div>
            {person.mfa === "Not enrolled" ? (
              <Alert status="danger">
                <Alert.Indicator>
                  <Lock />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Access paused</Alert.Title>
                  <Alert.Description>
                    No MFA method enrolled. The account cannot sign in to the console until one is added.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label>Can do</Label>
              {family.can.map((t) => (
                <span key={t} className="flex items-start gap-2 text-[13px]">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  {t}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Cannot do</Label>
              {family.cannot.map((t) => (
                <span key={t} className="flex items-start gap-2 text-[13px] text-muted">
                  <Ban className="mt-0.5 size-4 shrink-0" />
                  {t}
                </span>
              ))}
            </div>
            <dl className="grid grid-cols-[minmax(120px,max-content)_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px] leading-5">
              <dt className="text-muted">Business roles</dt>
              <dd className="font-medium">None · not allowed</dd>
              <dt className="text-muted">MFA methods</dt>
              <dd className="font-medium">
                {person.mfa === "SMS code only" ? "SMS code · move to authenticator by 31 Oct" : person.mfa}
              </dd>
              <dt className="text-muted">Last sign-in</dt>
              <dd className="font-medium">
                {person.lastActive === "now" ? "Today · Kigali office network" : person.lastActive}
              </dd>
            </dl>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" isDisabled={self}>
                Change role
              </Button>
              <Button size="sm" variant="danger-soft" isDisabled={self}>
                Pause access
              </Button>
            </div>
            <span className="text-xs leading-4 text-muted">
              {self
                ? "You cannot change your own role or access. Alain Ntwari can."
                : person.family === "Support"
                  ? "Role changes for your team go to Alain Ntwari for approval and are logged."
                  : `Only ${person.family} leads and Alain Ntwari can change this person’s access.`}
            </span>
          </Card>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <Card className="min-w-0 flex-[1_1_380px] gap-3 p-[18px]" aria-labelledby="ar-h">
          <div className="flex flex-col gap-0.5">
            <h2 id="ar-h" className="text-[15px] leading-[22px] font-semibold">
              Access Review · Q4 2026
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">
              Each lead confirms their team’s console access. Due 31 Oct · Alain Ntwari signs off.
            </p>
          </div>
          <ProgressBar aria-label="Access review progress" value={pct} color="accent" className="gap-1">
            <div className="flex items-center justify-between gap-2">
              <Label>Decided</Label>
              <span className="text-sm tabular">{decidedCount} of 14</span>
            </div>
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
          {data.reviews.map((r) => {
            const d = decisions[r.id];
            return (
              <div key={r.id} className="flex items-start gap-3 border-t border-separator py-2">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13px] font-medium">
                    {r.who} · {r.grant}
                  </span>
                  <span className="text-xs leading-4 text-muted">{r.evidence}</span>
                </div>
                {r.mine && !d ? (
                  <span className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => setDecisions((s) => ({ ...s, [r.id]: "keep" }))}
                    >
                      Keep
                    </Button>
                    <Button
                      size="sm"
                      variant="danger-soft"
                      onPress={() => setDecisions((s) => ({ ...s, [r.id]: "revoke" }))}
                    >
                      Revoke
                    </Button>
                  </span>
                ) : null}
                {d ? (
                  <ToneChip tone={d === "keep" ? "success" : "danger"}>
                    {d === "keep" ? "Kept · 09:43" : "Revoked · takes effect now"}
                  </ToneChip>
                ) : null}
                {!r.mine ? <GateChip>{r.reviewer}</GateChip> : null}
              </div>
            );
          })}
        </Card>

        <Card className="min-w-0 flex-[1.6_1_520px] gap-3 p-[18px]" aria-labelledby="br-h">
          <div className="flex flex-col gap-0.5">
            <h2 id="br-h" className="text-[15px] leading-[22px] font-semibold">
              Broker Administration
            </h2>
            <p className="text-[13px] leading-[18px] text-muted">
              External residence brokers. Verification, credits, suspension and disputes; brokers never see landlord or
              resident data beyond a paid reveal.
            </p>
          </div>
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content
                aria-label="Brokers"
                selectionMode="single"
                selectionBehavior="replace"
                disallowEmptySelection
                selectedKeys={new Set([broker?.id ?? "twagira"])}
                onSelectionChange={(keys) => {
                  const k = firstKey(keys as "all" | Set<Key>);
                  if (k) setBrokerId(k);
                }}
              >
                <Table.Header>
                  <Table.Column isRowHeader>Broker</Table.Column>
                  <Table.Column>Verification</Table.Column>
                  <Table.Column className="text-right">Credits</Table.Column>
                  <Table.Column className="text-right">Placements · 90 d</Table.Column>
                  <Table.Column>Disputes</Table.Column>
                </Table.Header>
                <Table.Body>
                  {data.brokers.map((b) => (
                    <Table.Row key={b.id} id={b.id} className={selectableRow}>
                      <Table.Cell>
                        <span className="flex flex-col">
                          <span className="font-medium">{b.name}</span>
                          <span className="text-xs text-muted">{b.area}</span>
                        </span>
                      </Table.Cell>
                      <Table.Cell>
                        <ToneChip tone={b.tone}>{b.state}</ToneChip>
                      </Table.Cell>
                      <Table.Cell className="text-right tabular">{b.credits}</Table.Cell>
                      <Table.Cell className="text-right tabular">{b.placements}</Table.Cell>
                      <Table.Cell className="text-[13px]">{b.disputes}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          {broker ? (
            <BrokerDetail
              broker={broker}
              reason={reason[broker.id] ?? REASONS[0]}
              done={!!done[broker.id]}
              onReason={(r) => setReason((s) => ({ ...s, [broker.id]: r }))}
              onAct={() => setDone((s) => ({ ...s, [broker.id]: true }))}
            />
          ) : null}
        </Card>
      </div>
    </PageContent>
  );
}

function BrokerDetail({
  broker,
  reason,
  done,
  onReason,
  onAct,
}: {
  broker: Broker;
  reason: string;
  done: boolean;
  onReason: (reason: string) => void;
  onAct: () => void;
}) {
  const canSuspend = !done && (broker.id === "twagira" || broker.id === "habyalimana" || broker.id === "uwamariya");
  const canVerify = !done && broker.id === "nshuti";
  const canReinstate = !done && broker.id === "murekatete";
  const doneText =
    broker.id === "nshuti"
      ? "New selfie requested · broker notified by SMS"
      : broker.id === "murekatete"
        ? "Reinstatement requested · with Compliance"
        : `Suspension requested · ${reason} · with Compliance`;

  return (
    <Card variant="secondary" className="gap-2.5 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">{broker.name}</span>
        <ToneChip tone={broker.tone}>{broker.state}</ToneChip>
      </div>
      <div className="grid gap-x-4 gap-y-1.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
        {broker.checks.map((ck) => {
          const icon = CHECK_ICON[ck.state];
          return (
            <span key={ck.text} className="flex items-center gap-2 text-[13px]">
              <icon.Icon className={`size-4 shrink-0 ${icon.className}`} />
              {ck.text}
            </span>
          );
        })}
      </div>
      <p className="text-xs leading-4 text-muted">{broker.note}</p>
      {canSuspend ? (
        <div className="flex flex-col gap-2">
          <TagGroup
            aria-label="Suspend for"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[reason]}
            onSelectionChange={(keys) => {
              const k = [...keys][0];
              if (k) onReason(String(k));
            }}
            className="flex flex-row flex-wrap items-center gap-1.5"
          >
            <Label className="mr-1">Suspend for</Label>
            <TagGroup.List className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <Tag key={r} id={r}>
                  {r}
                </Tag>
              ))}
            </TagGroup.List>
          </TagGroup>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="danger-soft" onPress={onAct}>
              Request suspension
            </Button>
            <span className="text-xs text-muted">
              Needs Bosco Rutayisire (Compliance) to approve. Unused credits are frozen, not removed.
            </span>
          </div>
        </div>
      ) : null}
      {canVerify ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary" isDisabled>
            Verify broker
          </Button>
          <Button size="sm" variant="secondary" onPress={onAct}>
            Ask for a new selfie
          </Button>
          <span className="text-xs text-muted">Verify unlocks when the selfie matches the ID.</span>
        </div>
      ) : null}
      {canReinstate ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onPress={onAct}>
            Request reinstatement
          </Button>
          <span className="text-xs text-muted">Needs Compliance approval and a signed corrective plan.</span>
        </div>
      ) : null}
      {done ? (
        <Chip variant="soft" color="warning" className="self-start">
          <Clock className="size-3" />
          <Chip.Label>{doneText}</Chip.Label>
        </Chip>
      ) : null}
    </Card>
  );
}

type Key = string | number;
