"use client";

import {
  ArrowDownToLine,
  ArrowRightFromSquare,
  Bell,
  Envelope,
  FileArrowUp,
  Fingerprint,
  Folder,
  Gear,
  Key,
  LayoutCellsLarge,
  Lock,
  Person,
  ScalesBalanced,
  SealCheck,
  ShieldExclamation,
  ShieldKeyhole,
  TrashBin,
} from "@gravity-ui/icons";
import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  Chip,
  Description,
  Input,
  Label,
  Switch,
  Table,
  Tabs,
  TextField,
} from "@heroui/react";
import { DropZone, EmptyState, ListView } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  AccountIdentity,
  AccountWorkspace,
  DataRequest,
  KycCheck,
  KycState,
  NotificationCategory,
  PersonalFile,
  PrivacyRight,
  ProfileField,
  SignInMethod,
} from "@injishi/data/fixtures/shared";
import { GateChip, Icon, LinkButton, PageContent, TextLink, toneColor } from "@injishi/ui";
import { useState, useTransition } from "react";
import { signOutOtherSessions, signOutSession } from "@/lib/auth-actions";
import type { SessionRow } from "@/lib/sessions";
import { CardHeading, LINE_LIST, LINE_TAB, ProcessTimeline } from "./ui";

interface AccountData {
  identity: AccountIdentity;
  profile: ProfileField[];
  methods: SignInMethod[];
  /** The person's own sessions, from the API (`sessionRow`). */
  sessions: SessionRow[];
  checks: KycCheck[];
  kycStates: KycState[];
  workspaces: AccountWorkspace[];
  categories: NotificationCategory[];
  rights: PrivacyRight[];
  requests: DataRequest[];
  files: PersonalFile[];
}

const TABS = [
  { id: "profile", label: "Profile", icon: Person },
  { id: "security", label: "Sign-in & sessions", icon: Key },
  { id: "kyc", label: "Identity verification", icon: Fingerprint },
  { id: "workspaces", label: "Workspaces", icon: LayoutCellsLarge },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "privacy", label: "Privacy & data", icon: ShieldKeyhole },
  { id: "files", label: "Files", icon: Folder },
];

const CHANNELS = ["In-app", "Email", "SMS"] as const;

function bound(identity: AccountIdentity, field: ProfileField): string {
  if (!field.bind) return field.value;
  return identity[field.bind];
}

function methodText(identity: AccountIdentity, method: SignInMethod, key: "desc" | "chip"): string {
  const raw = method[key].replaceAll("{role}", identity.role);
  if (!method.bind || key === "chip") return raw;
  return identity[method.bind];
}

/** Personal account (artifact: Account.dc.html). Opens on Sign-in & sessions. */
export function AccountView({ data, initialTab = "security" }: { data: AccountData; initialTab?: string }) {
  const idn = data.identity;
  const [tab, setTab] = useState(TABS.some((t) => t.id === initialTab) ? initialTab : "security");
  // Which session sign-out is running ("others" for all of them), and why the last one did not happen.
  const [ending, setEnding] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [, startSessionChange] = useTransition();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [news, setNews] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [left, setLeft] = useState(false);
  const [corr, setCorr] = useState(false);
  const [display, setDisplay] = useState(idn.displayName);

  const others = data.sessions.filter((s) => !s.current);
  /** End sessions on the API; the action re-reads them, so a row leaves only once it is really gone. */
  const endSessions = (key: string, change: () => Promise<{ error?: string }>) => {
    setEnding(key);
    setSessionError(null);
    startSessionChange(async () => {
      const { error } = await change();
      setSessionError(error ?? null);
      setEnding(null);
    });
  };
  const signIn = data.methods.filter((m) => m.group === "signin");
  const recovery = data.methods.filter((m) => m.group === "recovery");
  const requests: DataRequest[] = corr
    ? [
        {
          id: "DSR-26-0034",
          title: "Correction",
          ref: "DSR-26-0034 · submitted just now",
          chip: "Submitted",
          chipTone: "default",
          summary: "We’ll confirm it’s you, then reply with what changed.",
          steps: [
            { status: "current", title: "Submitted", when: "12 Oct 2026, 10:33" },
            { status: "default", title: "Identity confirmed", when: "Next" },
            { status: "default", title: "Reply with outcome", when: "Target date set by policy" },
          ],
        },
        ...data.requests,
      ]
    : data.requests;

  const cellOn = (cat: NotificationCategory, index: number) => {
    const key = `${cat.id}:${index}`;
    const base = key in prefs ? prefs[key] : [cat.inApp, cat.email, cat.sms][index];
    if (cat.id === "news" && !news) return false;
    return !!base;
  };

  return (
    <PageContent>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-[1_1_420px] items-center gap-4">
          <Avatar variant="soft" color="accent" className="size-14 text-lg">
            <Avatar.Fallback>{idn.initials}</Avatar.Fallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-[13px] leading-[18px] font-medium text-muted">Personal account</p>
            <h1 className="text-2xl leading-8 font-semibold tracking-[-0.015em]">{idn.legalName}</h1>
            <p className="text-sm text-muted">
              Your identity, sign-in, notifications and privacy. Business settings live under Settings.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip variant="soft" color="success">
            <SealCheck className="size-3.5" />
            <Chip.Label>Identity verified</Chip.Label>
          </Chip>
          <LinkButton href={screenHref("SettingsBusiness")} variant="secondary">
            <Gear className="size-4" />
            Business settings
          </LinkButton>
        </div>
      </div>

      <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Account sections" className={LINE_LIST}>
            {TABS.map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className={LINE_TAB}>
                <t.icon className="size-4" aria-hidden="true" />
                {t.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="profile" className="pt-1">
          <div className="flex flex-wrap items-start gap-4">
            <section
              aria-label="Profile"
              className="flex min-w-0 flex-[1.5_1_480px] flex-col gap-4 rounded-2xl bg-surface p-5 shadow-surface"
            >
              <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr))]">
                {data.profile.map((p) => {
                  const value = p.id === "pf-display" ? display : bound(idn, p);
                  return (
                    <TextField
                      key={p.id}
                      fullWidth
                      value={p.id === "pf-display" ? display : undefined}
                      defaultValue={p.id === "pf-display" ? undefined : value}
                      onChange={p.id === "pf-display" ? setDisplay : undefined}
                      isReadOnly={p.locked}
                      className="gap-1"
                    >
                      <span className="flex items-center gap-1.5">
                        <Label htmlFor={p.id}>{p.label}</Label>
                        {p.verified ? (
                          <Chip size="sm" variant="soft" color="success">
                            Verified
                          </Chip>
                        ) : null}
                      </span>
                      <Input id={p.id} aria-readonly={p.locked || undefined} />
                      <Description>{p.help}</Description>
                    </TextField>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button>Save changes</Button>
                <Button variant="ghost" onPress={() => setDisplay(idn.displayName)}>
                  Cancel
                </Button>
              </div>
            </section>
            <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-2.5 rounded-2xl bg-surface-secondary p-5">
              <h2 className="text-[15px] leading-[22px] font-semibold">You, Not Your Employee Record</h2>
              <p className="text-[13px] leading-[19px]">
                This is you as a person. Amahoro Hospitality Ltd may keep a separate employee record about you for HR
                and payroll. Editing this profile doesn’t change that record, and that record never gives anyone sign-in
                access.
              </p>
              <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px]">
                <dt className="text-muted">Account created</dt>
                <dd className="font-medium">{idn.created}</dd>
                <dt className="text-muted">Account ID</dt>
                <dd className="font-medium tabular">{idn.accountId}</dd>
              </dl>
            </aside>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="security" className="flex flex-col gap-4 pt-1">
          <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
            {(
              [
                ["Ways to Sign In", "One-time codes, Google, and an authenticator for sensitive roles", signIn],
                ["Recovery", "How you get back in if you lose your phone or email", recovery],
              ] as const
            ).map(([title, desc, rows]) => (
              <section key={title} className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-surface">
                <div>
                  <CardHeading>{title}</CardHeading>
                  <p className="text-[13px] text-muted">{desc}</p>
                </div>
                <ListView aria-label={title} variant="secondary" items={rows}>
                  {(m) => (
                    <ListView.Item id={m.id} textValue={m.title}>
                      <ListView.ItemContent className="gap-3">
                        <Icon name={m.icon} />
                        <div className="flex flex-col gap-0.5">
                          <ListView.Title>{m.title}</ListView.Title>
                          <ListView.Description className="whitespace-normal">
                            {methodText(idn, m, "desc")}
                          </ListView.Description>
                        </div>
                      </ListView.ItemContent>
                      <ListView.ItemAction className="flex items-center gap-2">
                        <Chip size="sm" variant="soft" color={toneColor(m.chipTone)}>
                          {methodText(idn, m, "chip")}
                        </Chip>
                        {m.action ? (
                          <Button size="sm" variant="ghost">
                            {m.action}
                          </Button>
                        ) : null}
                      </ListView.ItemAction>
                    </ListView.Item>
                  )}
                </ListView>
              </section>
            ))}
          </div>

          <section aria-labelledby="sess-h" className="flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-surface">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-[300px] flex-1 flex-col gap-0.5">
                <h2 id="sess-h" className="text-[15px] leading-[22px] font-semibold">
                  Active Sessions
                </h2>
                <p className="text-[13px] text-muted">
                  Every device signed in to your account, with the network address it last used. Sign out anything you
                  don’t recognise.
                </p>
              </div>
              <Button
                size="sm"
                variant="danger-soft"
                isDisabled={others.length === 0 || ending !== null}
                isPending={ending === "others"}
                onPress={() => endSessions("others", () => signOutOtherSessions())}
              >
                <ArrowRightFromSquare className="size-4" />
                Sign out all other sessions
              </Button>
            </div>
            {sessionError ? (
              <p role="alert" className="text-sm text-danger">
                {sessionError}
              </p>
            ) : null}
            <Table>
              <Table.ScrollContainer>
                <Table.Content aria-label="Active sessions">
                  <Table.Header>
                    <Table.Column isRowHeader>Device</Table.Column>
                    <Table.Column>Network address</Table.Column>
                    <Table.Column>Signed in</Table.Column>
                    <Table.Column>Last active</Table.Column>
                    <Table.Column className="text-right">Action</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {data.sessions.map((s) => (
                      <Table.Row key={s.id} id={s.id}>
                        <Table.Cell>
                          <span className="flex items-center gap-2.5">
                            <Icon name={s.icon} />
                            <span className="font-medium">{s.device}</span>
                            {s.current ? (
                              <Chip size="sm" variant="soft" color="accent">
                                This device
                              </Chip>
                            ) : null}
                          </span>
                        </Table.Cell>
                        <Table.Cell className="tabular">{s.place}</Table.Cell>
                        <Table.Cell className="tabular">{s.since}</Table.Cell>
                        <Table.Cell className="tabular">{s.last}</Table.Cell>
                        <Table.Cell className="text-right">
                          {s.current ? null : (
                            <Button
                              size="sm"
                              variant="secondary"
                              aria-label={`Sign out ${s.device} at ${s.place}`}
                              isDisabled={ending !== null}
                              isPending={ending === s.id}
                              onPress={() => endSessions(s.id, () => signOutSession(s.id))}
                            >
                              Sign out
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

        <Tabs.Panel id="kyc" className="pt-1">
          <div className="flex flex-wrap items-start gap-4">
            <section
              aria-labelledby="kyc-h"
              className="flex min-w-0 flex-[1.4_1_460px] flex-col gap-3.5 rounded-2xl bg-surface p-5 shadow-surface"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-success-soft text-success">
                  <Fingerprint className="size-4" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <h2 id="kyc-h" className="text-[15px] leading-[22px] font-semibold">
                    Identity Verified
                  </h2>
                  <span className="text-[13px] leading-[18px] text-muted">
                    Anchored on your Rwandan national ID. Required the first time you took an elevated role:{" "}
                    {idn.verifiedFor}, {idn.verifiedOn}.
                  </span>
                </div>
                <Chip variant="soft" color="success">
                  Verified
                </Chip>
              </div>
              <ProcessTimeline
                label="Verification checks"
                steps={data.checks.map((k) => ({
                  id: k.id,
                  status: "success" as const,
                  icon: "Check" as const,
                  title: k.title,
                  detail: k.detail,
                  extra: k.registryGate ? (
                    <GateChip icon={<ShieldExclamation className="size-3" />}>
                      Registry connection needs verification
                    </GateChip>
                  ) : null,
                }))}
              />
              <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-2xl bg-surface-secondary px-4 py-3 text-[13px]">
                <dt className="text-muted">Document</dt>
                <dd className="font-medium tabular">National ID · •••• •••• •••• 4471</dd>
                <dt className="text-muted">Valid until</dt>
                <dd className="font-medium">14 Jun 2031</dd>
                <dt className="text-muted">Checked again</dt>
                <dd className="font-medium">If your legal name changes or the ID expires</dd>
              </dl>
            </section>
            <aside
              aria-labelledby="kst-h"
              className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-2xl bg-surface-secondary p-5"
            >
              <div>
                <CardHeading id="kst-h">Verification States</CardHeading>
                <p className="text-[13px] text-muted">What anyone verifying for an elevated role may see</p>
              </div>
              <ul className="flex list-none flex-col gap-2.5 p-0">
                {data.kycStates.map((k) => (
                  <li
                    key={k.id}
                    className={`flex items-start gap-2.5 rounded-[10px] px-2 py-1.5 ${k.current ? "bg-surface" : ""}`}
                  >
                    <Chip size="sm" variant="soft" color={toneColor(k.tone)} className="shrink-0">
                      {k.label}
                    </Chip>
                    <span className="text-xs leading-[17px] text-muted">{k.text}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="workspaces" className="flex flex-col gap-4 pt-1">
          <section aria-labelledby="ws-h" className="flex flex-col rounded-2xl bg-surface shadow-surface">
            <div className="px-4 pt-4">
              <h2 id="ws-h" className="text-[15px] leading-[22px] font-semibold">
                Your Workspaces
              </h2>
              <p className="text-[13px] text-muted">One sign-in. Data and permissions stay separate in each.</p>
            </div>
            {data.workspaces.map((w) => {
              const gone = w.id === "broker" && left;
              return (
                <div key={w.id} className="flex flex-wrap items-center gap-3 border-t border-separator px-4 py-3">
                  <Avatar size="sm" variant="soft" color={toneColor(w.tone)}>
                    <Avatar.Fallback>{w.initials}</Avatar.Fallback>
                  </Avatar>
                  <div className="flex min-w-[260px] flex-1 flex-col">
                    <span className="font-medium">{w.name}</span>
                    <span className="text-[13px] text-muted">{w.desc}</span>
                    {w.note ? <span className="text-xs leading-4 text-muted">{w.note}</span> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip size="sm" variant="soft" color={gone ? "default" : toneColor(w.chipTone)}>
                      {gone ? "You left · just now" : w.chip}
                    </Chip>
                    {gone ? null : (
                      <LinkButton href={screenHref(w.board)} size="sm" variant="secondary">
                        {w.open}
                      </LinkButton>
                    )}
                    {w.leavable && !gone ? (
                      <Button size="sm" variant="ghost" onPress={() => setLeaving(true)}>
                        Leave
                      </Button>
                    ) : null}
                    {w.owner ? (
                      <LinkButton href={screenHref("TeamRoles")} size="sm" variant="ghost">
                        Transfer ownership
                      </LinkButton>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </section>
          {leaving && !left ? (
            <Alert status="warning" role="alertdialog" aria-labelledby="lv-h">
              <Alert.Indicator>
                <ShieldExclamation />
              </Alert.Indicator>
              <Alert.Content className="gap-2.5">
                <Alert.Title id="lv-h">Leave Broker workspace?</Alert.Title>
                <Alert.Description>{data.workspaces.find((w) => w.id === "broker")?.leaveWarning}</Alert.Description>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    onPress={() => {
                      setLeft(true);
                      setLeaving(false);
                    }}
                  >
                    Leave workspace
                  </Button>
                  <Button size="sm" variant="ghost" onPress={() => setLeaving(false)}>
                    Cancel
                  </Button>
                </div>
              </Alert.Content>
            </Alert>
          ) : null}
          <div className="rounded-2xl bg-surface-secondary">
            <EmptyState size="sm">
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <Envelope />
                </EmptyState.Media>
                <EmptyState.Title>No pending invitations</EmptyState.Title>
                <EmptyState.Description>
                  When a business invites you, it appears here and by email. Access starts only when you accept.
                </EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="notifications" className="pt-1">
          <div className="flex flex-wrap items-start gap-4">
            <section
              aria-labelledby="np-h"
              className="flex min-w-0 flex-[2_1_560px] flex-col gap-3 rounded-2xl bg-surface p-5 shadow-surface"
            >
              <div>
                <CardHeading id="np-h">What Reaches You, and Where</CardHeading>
                <p className="text-[13px] text-muted">
                  Applies to all your workspaces. Each business can’t see your choices.
                </p>
              </div>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Notification preferences">
                    <Table.Header>
                      <Table.Column isRowHeader>Category</Table.Column>
                      <Table.Column>In-app</Table.Column>
                      <Table.Column>Email</Table.Column>
                      <Table.Column>SMS</Table.Column>
                      <Table.Column>
                        <span className="flex flex-col gap-0.5">
                          WhatsApp
                          <GateChip icon={<Lock className="size-3" />}>Not available yet</GateChip>
                        </span>
                      </Table.Column>
                      <Table.Column>
                        <span className="flex flex-col gap-0.5">
                          Push
                          <GateChip icon={<Lock className="size-3" />}>Not available yet</GateChip>
                        </span>
                      </Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {data.categories.map((cat) => (
                        <Table.Row key={cat.id} id={cat.id}>
                          <Table.Cell>
                            <span className="flex flex-col gap-0.5">
                              <span className="font-medium">{cat.label}</span>
                              <span className="text-xs text-muted">{cat.hint}</span>
                            </span>
                          </Table.Cell>
                          {CHANNELS.map((ch, i) => {
                            const on = cellOn(cat, i);
                            const locked = cat.locked || (cat.id === "news" && !news);
                            return (
                              <Table.Cell key={ch}>
                                <Checkbox
                                  isSelected={on}
                                  isDisabled={locked}
                                  aria-label={`${cat.label} by ${ch}`}
                                  onChange={() => setPrefs((p) => ({ ...p, [`${cat.id}:${i}`]: !cellOn(cat, i) }))}
                                >
                                  <Checkbox.Content>
                                    <Checkbox.Control>
                                      <Checkbox.Indicator />
                                    </Checkbox.Control>
                                  </Checkbox.Content>
                                </Checkbox>
                              </Table.Cell>
                            );
                          })}
                          <Table.Cell className="text-muted">—</Table.Cell>
                          <Table.Cell className="text-muted">—</Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
            </section>
            <aside
              aria-labelledby="cons-h"
              className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 rounded-2xl bg-surface-secondary p-5"
            >
              <h2 id="cons-h" className="text-[15px] leading-[22px] font-semibold">
                Consent and Opt-Out
              </h2>
              <Switch isSelected={news} onChange={setNews}>
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  Training and product news
                </Switch.Content>
              </Switch>
              <p className="-mt-1.5 text-xs leading-[17px] text-muted">
                {news
                  ? `Consent given ${idn.newsConsentOn} at sign-up. Withdraw any time; it takes effect immediately.`
                  : "Consent withdrawn just now. We’ll keep a record of when you withdrew."}
              </p>
              <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13px]">
                <dt className="text-muted">Quiet hours</dt>
                <dd className="font-medium">22:00 to 06:00 for SMS</dd>
                <dt className="text-muted">Always sent</dt>
                <dd className="font-medium">Security alerts and sign-in codes</dd>
                <dt className="text-muted">Opt out</dt>
                <dd className="font-medium">Every email and SMS has an opt-out link or keyword</dd>
              </dl>
              <p className="text-xs leading-[17px] text-muted">
                WhatsApp and push will ask for your consent when they become available.
              </p>
            </aside>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="privacy" className="flex flex-col gap-4 pt-1">
          <Alert>
            <Alert.Indicator>
              <ScalesBalanced />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Your rights over your personal data</Alert.Title>
              <Alert.Description>
                Access, correction and deletion, as set out in Law N° 058/2021 on the protection of personal data and
                privacy. Citation as configured by Injishi; this page is not legal advice.
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr))]">
            {data.rights.map((r) => {
              const sent = r.id === "correction" && corr;
              return (
                <section key={r.id} className="flex flex-col gap-2.5 rounded-2xl bg-surface p-[18px] shadow-surface">
                  <Icon name={r.icon} className="size-5" />
                  <h2 className="text-[15px] leading-[22px] font-semibold">{r.title}</h2>
                  <p className="flex-1 text-[13px] leading-[19px] text-muted">{r.body}</p>
                  <Button
                    size="sm"
                    variant={r.danger ? "danger-soft" : "secondary"}
                    className="self-start"
                    isDisabled={r.disabled || sent}
                    aria-describedby={`why-${r.id}`}
                    onPress={() => {
                      if (r.id === "correction") setCorr(true);
                    }}
                  >
                    {sent ? "Request sent" : r.cta}
                  </Button>
                  <span id={`why-${r.id}`} className="text-xs leading-4 text-muted">
                    {sent ? "Added below as DSR-26-0034." : r.why}
                  </span>
                </section>
              );
            })}
          </div>
          <section aria-labelledby="dsr-h" className="flex flex-col gap-3.5 rounded-2xl bg-surface p-5 shadow-surface">
            <h2 id="dsr-h" className="text-[15px] leading-[22px] font-semibold">
              Your Requests
            </h2>
            {requests.map((q) => (
              <div key={q.id} className="flex flex-wrap gap-x-6 gap-y-3 rounded-2xl bg-surface-secondary px-4 py-3.5">
                <div className="flex min-w-[240px] flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{q.title}</span>
                    <Chip size="sm" variant="soft" color={toneColor(q.chipTone)}>
                      {q.chip}
                    </Chip>
                  </span>
                  <span className="text-xs text-muted tabular">{q.ref}</span>
                  <span className="text-[13px] leading-[19px]">{q.summary}</span>
                </div>
                <ProcessTimeline
                  className="min-w-[320px] flex-1"
                  steps={q.steps.map((s, i) => ({
                    id: `${q.id}-${i}`,
                    status: s.status,
                    title: s.title,
                    detail: s.when,
                  }))}
                />
              </div>
            ))}
            <p className="flex flex-wrap items-center gap-2 text-xs">
              <GateChip icon={<ShieldExclamation className="size-3" />}>Configured · unverified</GateChip>
              <span className="text-muted">
                Response targets and retention periods follow Injishi’s configured policy. Fiscal receipts, ledger
                entries and audit records are kept for that period even after deletion.
              </span>
              <TextLink href={screenHref("PublicHelp")}>Who processes your data</TextLink>
            </p>
          </section>
        </Tabs.Panel>

        <Tabs.Panel id="files" className="flex flex-col gap-4 pt-1">
          <DropZone>
            <DropZone.Area className="flex-row flex-wrap px-6 py-[18px]">
              <DropZone.Icon>
                <FileArrowUp className="size-6" />
              </DropZone.Icon>
              <span className="flex min-w-[240px] flex-1 flex-col gap-0.5 text-left">
                <DropZone.Label>Drop personal files here</DropZone.Label>
                <DropZone.Description>
                  PDF, JPG or PNG up to 10 MB. Business documents belong in Settings, not here.
                </DropZone.Description>
              </span>
              <DropZone.Trigger className="m-0">Browse files</DropZone.Trigger>
            </DropZone.Area>
            <DropZone.Input accept="image/*,.pdf" />
          </DropZone>
          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label="Personal files">
                <Table.Header>
                  <Table.Column isRowHeader>File</Table.Column>
                  <Table.Column>Used for</Table.Column>
                  <Table.Column>Who can open it</Table.Column>
                  <Table.Column>Uploaded</Table.Column>
                  <Table.Column className="text-right">Size</Table.Column>
                  <Table.Column className="text-right">Actions</Table.Column>
                </Table.Header>
                <Table.Body>
                  {data.files.map((f) => (
                    <Table.Row key={f.id} id={f.id}>
                      <Table.Cell>
                        <span className="flex items-center gap-2.5">
                          <Icon name={f.icon} />
                          <span className="font-medium">{f.name}</span>
                        </span>
                      </Table.Cell>
                      <Table.Cell>{f.use}</Table.Cell>
                      <Table.Cell>
                        <span className="flex items-center gap-1.5">
                          <Icon name={f.whoIcon} className="size-3.5 text-muted" />
                          {f.who}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="tabular">{f.when}</Table.Cell>
                      <Table.Cell className="text-right tabular">{f.size}</Table.Cell>
                      <Table.Cell className="text-right">
                        <span className="inline-flex justify-end gap-1">
                          <Button size="sm" variant="ghost" isIconOnly aria-label={`Download ${f.name}`}>
                            <ArrowDownToLine className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            isDisabled={f.locked}
                            aria-label={
                              f.locked ? `Can’t delete ${f.name} while verification relies on it` : `Delete ${f.name}`
                            }
                          >
                            <TrashBin className="size-4" />
                          </Button>
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <p className="text-xs leading-[17px] text-muted">
            ID images can’t be deleted while your identity verification relies on them. Licences and RDB certificates
            belong to the business; find them in{" "}
            <TextLink href={screenHref("SettingsBusiness")}>Business settings</TextLink>.
          </p>
        </Tabs.Panel>
      </Tabs>
    </PageContent>
  );
}
