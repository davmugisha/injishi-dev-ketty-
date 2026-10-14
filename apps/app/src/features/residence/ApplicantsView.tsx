"use client";

import {
  CircleCheck,
  CircleInfo,
  Envelope,
  Eye,
  FilePlus,
  FileText,
  Lock,
  PaperPlane,
  PlugConnection,
  Sliders,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Description,
  Drawer,
  Input,
  Label,
  ProgressBar,
  SearchField,
  Separator,
  Table,
  Tabs,
  TextArea,
  TextField,
  Toast,
  toast,
} from "@heroui/react";
import { EmptyState, ListView } from "@heroui-pro/react";
import { type Persona, screenHref } from "@injishi/data";
import type {
  Applicant,
  ApplicantProfile,
  RegistrationInvitation,
  ScreeningCheck,
  Vacancy,
} from "@injishi/data/fixtures/residence";
import { GateChip, KeyValueList, LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { useState } from "react";
import { FormDialog, firstKey, lineTab, money, plain, SelectField, SubHeading, TabCount, ToneChip } from "./shared";

export interface ApplicantsData {
  applicants: Applicant[];
  checks: ScreeningCheck[];
  invitations: RegistrationInvitation[];
  vacancies: Vacancy[];
}

type Tab = "applicants" | "invites";

/** The next lease number, as the lease register will assign it. */
const NEXT_LEASE = "L-KC-025";
/** A draft holds the unit until this date; then it is released. */
const HOLD_UNTIL = "26 Oct";
const TEMPLATES = ["Kacyiru Court residential lease v3", "Kacyiru Court company lease v2"];

const inviteMessage = (unit: string) =>
  `Thank you for viewing ${unit}. Please register and upload your ID and proof of income.`;

export function ApplicantsView({ persona, data }: { persona: Persona; data: ApplicantsData }) {
  const [tab, setTab] = useState<Tab>("applicants");
  const [sel, setSel] = useState(data.applicants[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean[]>>(() =>
    Object.fromEntries(data.applicants.filter((a) => a.profile).map((a) => [a.id, [...(a.profile?.checks ?? [])]])),
  );
  const [convertOpen, setConvertOpen] = useState(false);
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const unitOptions = data.vacancies.map((v) => ({
    id: v.unit,
    label: `${v.unit} · ${v.type} · ${money(v.rent)}`,
  }));
  const defaultUnit = unitOptions.find((o) => o.id === "C-03")?.id ?? unitOptions[0]?.id ?? "";
  const [invite, setInvite] = useState({ name: "", email: "", unit: defaultUnit, note: inviteMessage(defaultUnit) });
  const [sent, setSent] = useState<RegistrationInvitation[]>([]);

  const invitations = [...sent, ...data.invitations];
  const total = data.checks.length;
  const doneOf = (id: string) => (checks[id] ?? []).filter(Boolean).length;
  const stageOf = (a: Applicant) => (a.stage === "Screening" ? `Screening ${doneOf(a.id)}/${total}` : a.stage);

  const q = query.trim().toLowerCase();
  const list = data.applicants.filter(
    (a) => !q || `${a.name} ${a.unit} ${a.source} ${stageOf(a)}`.toLowerCase().includes(q),
  );

  const applicant = data.applicants.find((a) => a.id === sel) ?? data.applicants[0];
  const profile = applicant?.profile ?? null;
  const state = (applicant && checks[applicant.id]) || [];
  const done = state.filter(Boolean).length;
  const ready = !!profile && done === total;

  const toggleCheck = (i: number, on: boolean) => {
    if (!applicant) return;
    setChecks((m) => {
      const next = [...(m[applicant.id] ?? [])];
      next[i] = on;
      return { ...m, [applicant.id]: next };
    });
  };

  const openInvite = () => {
    setInvite({ name: "", email: "", unit: defaultUnit, note: inviteMessage(defaultUnit) });
    setInviteOpen(true);
  };
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email.trim());
  const canSend = invite.name.trim().length > 1 && emailOk;
  const sendInvite = () => {
    if (!canSend) return;
    // Addresses are shown masked after the @, as in the rest of the register.
    const [local] = invite.email.trim().split("@");
    setSent((s) => [
      {
        id: `inv-new-${s.length + 1}`,
        name: invite.name.trim(),
        contact: `${local}@… · email`,
        unit: invite.unit,
        by: persona.name,
        sent: "12 Oct",
        expires: "19 Oct",
        status: "Sent",
        statusTone: "info",
        action: "Resend",
      },
      ...s,
    ]);
    setInviteOpen(false);
    setTab("invites");
    toast.success(`Invitation sent to ${invite.name.trim()} · expires 19 Oct`, {
      indicator: <CircleCheck className="size-4" />,
    });
  };

  const openProfile = (id: string) => {
    setSel(id);
    setQuery("");
    setTab("applicants");
  };

  return (
    <PageContent>
      <PageHeader
        eyebrow="Tenancy · Kacyiru Court Residences"
        title="Applicants"
        description="Invite prospective residents to register, check their documents, and turn a successful application into a lease draft."
        actions={
          <>
            <LinkButton href={screenHref("SettingsBusiness")} variant="ghost">
              <Sliders className="size-4" />
              Screening checklist
            </LinkButton>
            <Button onPress={openInvite}>
              <Envelope className="size-4" />
              Send registration invitation
            </Button>
          </>
        }
      />

      <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(k) => setTab(String(k) as Tab)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Applicant views">
            <Tabs.Tab id="applicants" className={lineTab}>
              Applicants
              <TabCount>{data.applicants.length}</TabCount>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="invites" className={lineTab}>
              Registration invitations
              <TabCount>{invitations.length}</TabCount>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="applicants" className="pt-5">
          <div className="grid items-start gap-[16px] lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-3">
              <SearchField aria-label="Search applicants" value={query} onChange={setQuery} fullWidth>
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Search applicants" />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
              <ListView
                aria-label="Applicants"
                items={list}
                selectionMode="single"
                selectionBehavior="replace"
                disallowEmptySelection
                selectedKeys={new Set([applicant?.id ?? ""])}
                onSelectionChange={(keys) => {
                  const k = firstKey(keys);
                  if (k) setSel(k);
                }}
                renderEmptyState={() => (
                  <p className="px-3 py-4 text-[13px] text-muted">No applicant matches “{query}”.</p>
                )}
              >
                {(a) => (
                  <ListView.Item id={a.id} textValue={a.name} className="data-[selected=true]:bg-default">
                    <ListView.ItemContent>
                      <Avatar size="sm" variant="soft" color={toneColor(a.avatarTone)} className="shrink-0">
                        <Avatar.Fallback>{a.initials}</Avatar.Fallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <ListView.Title>{a.name}</ListView.Title>
                        <ListView.Description>
                          {a.unit} · {a.source}
                        </ListView.Description>
                      </div>
                    </ListView.ItemContent>
                    <ListView.ItemAction>
                      <ToneChip tone={a.stageTone} className="tabular">
                        {stageOf(a)}
                      </ToneChip>
                    </ListView.ItemAction>
                  </ListView.Item>
                )}
              </ListView>
              <Alert>
                <Alert.Indicator>
                  <CircleInfo />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>A resident profile is its own identity</Alert.Title>
                  <Alert.Description>
                    Registering does not create a staff login or a hotel guest record, and applicants never see other
                    applicants.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            </div>

            {applicant && profile ? (
              <ProfileCard
                applicant={applicant}
                profile={profile}
                checks={data.checks}
                state={state}
                done={done}
                ready={ready}
                onToggle={toggleCheck}
                onConvert={() => setConvertOpen(true)}
              />
            ) : applicant ? (
              <Card className="p-5" aria-label="Registration not completed" render={(p) => <section {...p} />}>
                <EmptyState>
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <Envelope />
                    </EmptyState.Media>
                    <EmptyState.Title>{applicant.name} has not registered yet</EmptyState.Title>
                    <EmptyState.Description>{applicant.pendingNote}</EmptyState.Description>
                  </EmptyState.Header>
                  <EmptyState.Content className="flex flex-row flex-wrap justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() =>
                        toast.success(`Invitation resent to ${applicant.name} · expires 19 Oct`, {
                          indicator: <CircleCheck className="size-4" />,
                        })
                      }
                    >
                      Resend invitation
                    </Button>
                    <Button size="sm" variant="ghost">
                      Revoke
                    </Button>
                  </EmptyState.Content>
                </EmptyState>
              </Card>
            ) : null}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="invites" className="pt-5">
          <section className="flex flex-col gap-3" aria-label="Registration invitations">
            <p className="text-[13px] text-muted">
              Invitations are sent by email or in-app link and expire after 7 days. Accepting creates a resident
              profile, not a lease.
            </p>
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Registration invitations">
                  <Table.Header>
                    <Table.Column isRowHeader>Invitee</Table.Column>
                    <Table.Column>Unit</Table.Column>
                    <Table.Column>Sent by</Table.Column>
                    <Table.Column>Sent</Table.Column>
                    <Table.Column>Expires</Table.Column>
                    <Table.Column>Status</Table.Column>
                    <Table.Column className="text-right">Action</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {invitations.map((i) => (
                      <Table.Row key={i.id} id={i.id}>
                        <Table.Cell>
                          <span className="flex flex-col">
                            <span className="font-medium">{i.name}</span>
                            <span className="text-[12px] text-muted">{i.contact}</span>
                          </span>
                        </Table.Cell>
                        <Table.Cell className="tabular">{i.unit}</Table.Cell>
                        <Table.Cell>{i.by}</Table.Cell>
                        <Table.Cell className="tabular">{i.sent}</Table.Cell>
                        <Table.Cell className="tabular">{i.expires}</Table.Cell>
                        <Table.Cell>
                          <ToneChip tone={i.statusTone}>{i.status}</ToneChip>
                        </Table.Cell>
                        <Table.Cell className="text-right">
                          {i.action === "View profile" && i.applicant ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`View profile of ${i.name}`}
                              onPress={() => openProfile(i.applicant ?? "")}
                            >
                              View profile
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Resend invitation to ${i.name}`}
                              onPress={() =>
                                toast.success(`Invitation resent to ${i.name} · expires 19 Oct`, {
                                  indicator: <CircleCheck className="size-4" />,
                                })
                              }
                            >
                              Resend
                            </Button>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </section>
        </Tabs.Panel>
      </Tabs>

      {applicant && profile ? (
        <FormDialog
          isOpen={convertOpen && ready}
          onOpenChange={setConvertOpen}
          size="lg"
          className="sm:max-w-[640px]"
          title={`Create lease draft ${NEXT_LEASE}`}
          description={`${applicant.name} · ${profile.unitLabel}`}
          footer={
            <>
              <Button variant="secondary" onPress={() => setConvertOpen(false)}>
                Cancel
              </Button>
              <LinkButton href={screenHref("Leases")}>Create draft and open lease</LinkButton>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField fullWidth defaultValue={profile.moveIn} className="gap-1">
              <Label>Start date</Label>
              <Input />
            </TextField>
            <TextField fullWidth defaultValue={profile.term} className="gap-1">
              <Label>Term</Label>
              <Input />
            </TextField>
            <TextField fullWidth defaultValue={plain(profile.rent)} className="gap-1">
              <Label>Monthly rent (RWF)</Label>
              <Input inputMode="numeric" className="tabular" />
              <Description>Due on the 1st of each month</Description>
            </TextField>
            <TextField fullWidth defaultValue={plain(profile.deposit)} className="gap-1">
              <Label>Caution deposit (RWF)</Label>
              <Input inputMode="numeric" className="tabular" />
              <Description>Two months’ rent, held as a liability</Description>
            </TextField>
            <TextField fullWidth defaultValue="30 days" className="gap-1">
              <Label>Notice period</Label>
              <Input />
            </TextField>
            <SelectField label="Contract template" value={template} options={TEMPLATES} onChange={setTemplate} />
          </div>
          <Alert status="accent">
            <Alert.Indicator>
              <CircleInfo />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>The unit is held for these dates</Alert.Title>
              <Alert.Description>
                {applicant.unit} is held while the draft is out for signature and released if it is not signed by{" "}
                {HOLD_UNTIL}. It is never offered as a nightly stay.
              </Alert.Description>
            </Alert.Content>
          </Alert>
          {profile.broker ? (
            <p className="text-[12px] leading-4 text-muted">
              A placement event for {profile.broker.name} is recorded only when both parties have signed.
            </p>
          ) : null}
        </FormDialog>
      ) : null}

      <Drawer.Backdrop isOpen={inviteOpen} onOpenChange={setInviteOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog aria-labelledby="inv-h" className="w-[min(460px,100vw)]">
            <Drawer.CloseTrigger aria-label="Close" />
            <Drawer.Header className="flex flex-col gap-0.5">
              <Drawer.Heading id="inv-h" className="text-[17px] leading-6 font-semibold">
                Send registration invitation
              </Drawer.Heading>
              <p className="text-[13px] text-muted">The person registers their own profile and uploads documents</p>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-4">
              <TextField
                fullWidth
                isRequired
                value={invite.name}
                onChange={(v) => setInvite((s) => ({ ...s, name: v }))}
                className="gap-1"
              >
                <Label>Full name</Label>
                <Input placeholder="As on their ID" autoComplete="off" />
              </TextField>
              <TextField
                fullWidth
                isRequired
                type="email"
                value={invite.email}
                onChange={(v) => setInvite((s) => ({ ...s, email: v }))}
                isInvalid={invite.email.trim().length > 3 && !emailOk}
                className="gap-1"
              >
                <Label>Email</Label>
                <Input placeholder="name@example.com" autoComplete="off" />
                <Description>Email and in-app links only. SMS is not available yet.</Description>
              </TextField>
              <SelectField
                label="Unit of interest"
                value={invite.unit}
                options={unitOptions}
                onChange={(unit) =>
                  setInvite((s) => ({
                    ...s,
                    unit,
                    note: s.note === inviteMessage(s.unit) ? inviteMessage(unit) : s.note,
                  }))
                }
              />
              <TextField
                fullWidth
                value={invite.note}
                onChange={(v) => setInvite((s) => ({ ...s, note: v }))}
                className="gap-1"
              >
                <Label>Message</Label>
                <TextArea rows={3} />
              </TextField>
              <p className="text-[12px] text-muted">
                Expires in 7 days. You can resend or revoke it from Registration invitations.
              </p>
            </Drawer.Body>
            <Drawer.Footer className="flex justify-end gap-2">
              <Button variant="secondary" onPress={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button onPress={sendInvite} isDisabled={!canSend}>
                <PaperPlane className="size-4" />
                Send invitation
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}

function ProfileCard({
  applicant,
  profile,
  checks,
  state,
  done,
  ready,
  onToggle,
  onConvert,
}: {
  applicant: Applicant;
  profile: ApplicantProfile;
  checks: ScreeningCheck[];
  state: boolean[];
  done: number;
  ready: boolean;
  onToggle: (i: number, on: boolean) => void;
  onConvert: () => void;
}) {
  const total = checks.length;
  const broker = profile.broker;
  return (
    <Card className="min-w-0 gap-4 p-5" aria-labelledby="ap-h" render={(p) => <section {...p} />}>
      <div className="flex items-start gap-3">
        <Avatar variant="soft" color="accent" className="shrink-0">
          <Avatar.Fallback>{applicant.initials}</Avatar.Fallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 id="ap-h" className="text-lg leading-[26px] font-semibold">
            {applicant.name}
          </h2>
          <span className="text-[13px] text-muted tabular">
            {profile.contact} · registered {profile.registered}
          </span>
        </div>
        <ToneChip tone={profile.statusTone}>{profile.status}</ToneChip>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
        <Card variant="secondary" className="gap-2.5 p-[14px]">
          <SubHeading className="text-sm leading-5">Requested tenancy</SubHeading>
          <KeyValueList
            items={[
              { label: "Unit", value: profile.unitLabel },
              { label: "Move-in", value: profile.moveIn },
              { label: "Term", value: profile.term },
              { label: "Occupants", value: profile.occupants },
              { label: "Monthly rent", value: <span className="tabular">{money(profile.rent)}</span> },
            ]}
          />
        </Card>
        {broker ? (
          <Card variant="secondary" className="gap-2.5 p-[14px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SubHeading className="text-sm leading-5">Broker attribution</SubHeading>
              <ToneChip tone="info">Broker-referred</ToneChip>
            </div>
            <div className="flex items-center gap-2.5">
              <Avatar size="sm" className="shrink-0">
                <Avatar.Fallback>{broker.initials}</Avatar.Fallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <span className="font-medium">{broker.name}</span>
                <span className="text-[12px] text-muted">{broker.detail}</span>
              </div>
            </div>
            <KeyValueList
              items={[
                { label: "Placement fee", value: <span className="tabular">{money(broker.fee)}</span> },
                { label: "Fee terms", value: broker.terms },
                { label: "Due when", value: broker.due },
              ]}
            />
            <p className="text-[12px] leading-4 text-muted">
              The broker sees the application stage only, never documents or screening notes.
            </p>
          </Card>
        ) : (
          <Card variant="secondary" className="gap-2.5 p-[14px]">
            <SubHeading className="text-sm leading-5">Source</SubHeading>
            <p className="text-[13px] leading-5">{profile.sourceLong}</p>
            <p className="text-[12px] leading-4 text-muted">No broker is attributed, so no placement fee applies.</p>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <SubHeading>Documents</SubHeading>
          <Button
            size="sm"
            variant="ghost"
            onPress={() =>
              toast.success(`Document request sent to ${applicant.name}`, {
                indicator: <CircleCheck className="size-4" />,
              })
            }
          >
            <PaperPlane className="size-4" />
            Request a document
          </Button>
        </div>
        <ListView aria-label="Documents" variant="secondary" items={profile.docs.map((d) => ({ ...d, id: d.name }))}>
          {(d) => (
            <ListView.Item id={d.id} textValue={d.name}>
              <ListView.ItemContent>
                <FileText className="size-4 shrink-0 text-muted" aria-hidden="true" />
                <div className="flex min-w-0 flex-col">
                  <ListView.Title>{d.name}</ListView.Title>
                  <ListView.Description>{d.meta}</ListView.Description>
                </div>
              </ListView.ItemContent>
              <ListView.ItemAction className="flex items-center gap-2">
                <ToneChip tone={d.tone}>{d.state}</ToneChip>
                <Button size="sm" variant="ghost" isIconOnly aria-label={`View ${d.name}`}>
                  <Eye className="size-4" />
                </Button>
              </ListView.ItemAction>
            </ListView.Item>
          )}
        </ListView>
      </div>

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr))]">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <SubHeading>Manual screening</SubHeading>
            <span className="text-[12px] text-muted tabular">
              {done} of {total} done
            </span>
          </div>
          <ProgressBar value={total ? Math.round((done / total) * 100) : 0} aria-label="Screening checks complete">
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
          {checks.map((c, i) => (
            <Checkbox key={c.id} isSelected={!!state[i]} onChange={(on) => onToggle(i, on)} className="w-full">
              <Checkbox.Content className="flex w-full items-start gap-2.5">
                <Checkbox.Control className="mt-0.5">
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13px] font-medium">{c.label}</span>
                  <span className="text-[12px] text-muted">{c.hint}</span>
                </span>
              </Checkbox.Content>
            </Checkbox>
          ))}
        </div>
        <Card variant="secondary" className="gap-2.5 p-[14px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SubHeading className="text-sm leading-5">Automated screening</SubHeading>
            <GateChip icon={<Lock className="size-3" />}>No provider connected</GateChip>
          </div>
          <EmptyState size="sm">
            <EmptyState.Header>
              <EmptyState.Media variant="icon">
                <PlugConnection />
              </EmptyState.Media>
              <EmptyState.Title>No screening network is connected</EmptyState.Title>
              <EmptyState.Description>
                Injishi does not run credit or background checks for you. Record each manual check with its evidence
                instead.
              </EmptyState.Description>
            </EmptyState.Header>
            <EmptyState.Content>
              <LinkButton href={screenHref("SettingsBusiness")} size="sm" variant="secondary">
                See connection requirements
              </LinkButton>
            </EmptyState.Content>
          </EmptyState>
        </Card>
      </div>

      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-muted" role="status">
          {ready
            ? "All checks recorded. Converting creates a draft; nothing is signed yet."
            : `Finish ${total - done} remaining checks before converting to a lease.`}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost">Decline with reason</Button>
          <Button isDisabled={!ready} onPress={onConvert}>
            <FilePlus className="size-4" />
            Convert to lease draft
          </Button>
        </div>
      </div>
    </Card>
  );
}
