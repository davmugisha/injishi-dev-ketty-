"use client";

import {
  BookOpen,
  Calculator,
  Comment,
  Eye,
  Lock,
  PaperPlane,
  Pencil,
  Persons,
  ShieldKeyhole,
} from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Chip, Input, Label, Table, Tabs, TextField } from "@heroui/react";
import { EmptyState, ListView, NativeSelect, Timeline } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  CompensationChange,
  Employee,
  FamilyMember,
  FileAccess,
  FileDocument,
  PolicyAck,
} from "@injishi/data/fixtures/people";
import { formatRwf, Icon, KeyValueList, LinkButton, toneColor } from "@injishi/ui";
import { useState } from "react";
import { LoginChip, STATUS } from "./employee-status";
import { firstName, initials } from "./parts";

export interface FileLogEntry {
  id: string;
  what: string;
  when: string;
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "pay", label: "Pay" },
  { id: "docs", label: "Documents" },
  { id: "family", label: "Family" },
  { id: "policies", label: "Policies" },
];

/** "+RWF 15,000" for raises, "-RWF 15,000" for cuts. */
const signed = (n: number) => `${n > 0 ? "+" : ""}${formatRwf(Math.round(n))}`;

/** Right-hand employee file: overview, pay with a proposed change, documents and access log, family, policies. */
export function EmployeeFileCard({
  employee: e,
  propertyName,
  compensation,
  documents,
  access,
  family,
  policies,
  tab,
  onTabChange,
  log,
  onView,
  loginRequested,
  onRequestLogin,
}: {
  employee: Employee;
  propertyName: string;
  compensation: CompensationChange[];
  documents: FileDocument[];
  access: FileAccess[];
  family: FamilyMember[];
  policies: PolicyAck[];
  tab: string;
  onTabChange: (tab: string) => void;
  log: FileLogEntry[];
  onView: (entry: FileLogEntry) => void;
  loginRequested: boolean;
  onRequestLogin: () => void;
}) {
  const first = firstName(e.name);
  const [proposal, setProposal] = useState<"closed" | "open" | "sent">("closed");
  const [newBase, setNewBase] = useState(String(e.base + 15000));
  const [effective, setEffective] = useState<"next" | "mid">("next");
  const [reminded, setReminded] = useState(false);

  const parsed = Number.parseInt(newBase.replace(/[^0-9]/g, ""), 10);
  const diff = (Number.isNaN(parsed) ? e.base : parsed) - e.base;
  const mid = effective === "mid";
  const impact =
    diff === 0
      ? "none yet"
      : mid
        ? `${signed((diff * 17) / 31)} in October, then ${signed(diff)} a month`
        : `${signed(diff)} a month from November`;
  const impactNote = mid
    ? "Mid-period: 17 of 31 October days at the new rate. The October run is with the owner, so this becomes a retroactive line in November with this reason attached."
    : "Starts with the November run. Nothing changes in the October run already submitted.";

  const accessLog = [
    ...log.map((a) => ({ ...a, status: "current" as const })),
    ...access.map((a) => ({ ...a, what: a.what.replace("{first}", first), status: "default" as const })),
  ];

  return (
    <Card
      aria-labelledby="file-h"
      className="min-w-0 gap-0 overflow-hidden p-0"
      render={(props) => <section {...(props as object)} />}
    >
      <div className="flex items-start gap-3 px-[18px] pt-[18px]">
        <Avatar size="lg" variant="soft" color="accent">
          <Avatar.Fallback>{initials(e.name)}</Avatar.Fallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="file-h" className="text-lg leading-6 font-semibold">
            {e.name}
          </h2>
          <span className="text-[13px] text-muted">
            {e.position} · {e.no}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <Chip size="sm" variant="soft" color={toneColor(STATUS[e.status].tone)}>
              {STATUS[e.status].label}
            </Chip>
            <Chip size="sm" variant="soft">
              <Lock className="size-3" />
              <Chip.Label>Restricted file</Chip.Label>
            </Chip>
          </span>
        </div>
        <LinkButton href={screenHref("Messages")} size="sm" variant="secondary">
          <Comment className="size-4" />
          Message
        </LinkButton>
      </div>
      <Tabs
        variant="secondary"
        selectedKey={tab}
        onSelectionChange={(k) => onTabChange(String(k))}
        className="gap-0 pt-3"
      >
        <Tabs.ListContainer className="mx-[18px]">
          <Tabs.List aria-label="Employee file" className="justify-start gap-1">
            {TABS.map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className="w-auto flex-none px-3">
                {t.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="overview" className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
          <KeyValueList
            items={[
              { label: "Position", value: `${e.position} · grade ${e.grade}` },
              { label: "Reports to", value: e.manager },
              { label: "Department", value: e.dept },
              { label: "Property", value: `${propertyName} (home)` },
              { label: "Also rostered at", value: e.alsoRostered },
              { label: "Employer", value: e.employer },
            ]}
          />
          <Card variant="secondary" className="gap-1.5 p-[14px] text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">Contract</span>
              <Chip size="sm" variant="soft">
                {e.contract}
              </Chip>
            </div>
            <span className="text-[13px]">{e.contractDates}</span>
            <span className="text-xs text-muted">Notice period 30 days · signed copy in Documents</span>
          </Card>
          <Card variant="secondary" className="gap-2 p-[14px] text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">Injishi login</span>
              <LoginChip employee={e} />
            </div>
            {e.login ? (
              <>
                <span className="text-[13px]">Linked user account: {e.login}</span>
                <span className="text-xs leading-4 text-muted">
                  A separate record. Ending employment does not end the login by itself; the owner revokes access in
                  Team &amp; roles.
                </span>
              </>
            ) : (
              <>
                <span className="text-[13px]">
                  None. Clocks in at the kiosk with a PIN and receives payslips by SMS link.
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {loginRequested ? (
                    <Chip size="sm" variant="soft" color="accent">
                      Request sent to Didier Mugenzi
                    </Chip>
                  ) : (
                    <Button size="sm" variant="secondary" onPress={onRequestLogin}>
                      Ask the owner for a login
                    </Button>
                  )}
                  <span className="text-xs text-muted">HR cannot grant logins.</span>
                </div>
              </>
            )}
          </Card>
        </Tabs.Panel>

        <Tabs.Panel id="pay" className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[15px] leading-[22px] font-semibold">Compensation History</h3>
            <span className="text-xs text-muted">Effective-dated · owner-approved</span>
          </div>
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Compensation history">
                <Table.Header>
                  <Table.Column isRowHeader>Effective</Table.Column>
                  <Table.Column className="text-right">Base</Table.Column>
                  <Table.Column className="text-right">Allowances</Table.Column>
                  <Table.Column>Reason · approved by</Table.Column>
                </Table.Header>
                <Table.Body>
                  {compensation.map((c) => (
                    <Table.Row key={c.id} id={c.id}>
                      <Table.Cell className="tabular">{c.effective}</Table.Cell>
                      <Table.Cell className="text-right tabular">{formatRwf(c.base)}</Table.Cell>
                      <Table.Cell className="text-right tabular">{formatRwf(c.allowance)}</Table.Cell>
                      <Table.Cell>
                        <span className="flex flex-col">
                          <span>{c.reason}</span>
                          <span className="text-xs text-muted">{c.approvedBy}</span>
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <KeyValueList
            items={[
              { label: "Paid by", value: e.payMethod },
              { label: "Payment details", value: "Confirmed by the employee in the staff app" },
            ]}
          />
          {proposal === "closed" ? (
            <Button variant="secondary" className="self-start" onPress={() => setProposal("open")}>
              <Pencil className="size-4" />
              Propose a pay change
            </Button>
          ) : null}
          {proposal === "open" ? (
            <Card variant="secondary" className="gap-3 p-[14px] text-sm">
              <span className="font-semibold">Propose a pay change</span>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <TextField value={newBase} onChange={setNewBase} className="flex flex-col gap-1">
                  <Label>New base (RWF)</Label>
                  <Input className="tabular" inputMode="numeric" />
                </TextField>
                <NativeSelect fullWidth className="flex flex-col gap-1">
                  <Label htmlFor="cmp-when">Effective from</Label>
                  <NativeSelect.Trigger
                    id="cmp-when"
                    value={effective}
                    onChange={(ev) => setEffective(ev.target.value === "mid" ? "mid" : "next")}
                  >
                    <NativeSelect.Option value="next">1 Nov 2026 · next period</NativeSelect.Option>
                    <NativeSelect.Option value="mid">15 Oct 2026 · mid-period</NativeSelect.Option>
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <Alert>
                <Alert.Indicator>
                  <Calculator />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title>Pay impact: {impact}</Alert.Title>
                  <Alert.Description>{impactNote}</Alert.Description>
                </Alert.Content>
              </Alert>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onPress={() => setProposal("closed")}>
                  Cancel
                </Button>
                <Button onPress={() => setProposal("sent")}>Send to owner for approval</Button>
              </div>
            </Card>
          ) : null}
          {proposal === "sent" ? (
            <Alert status="accent">
              <Alert.Indicator>
                <PaperPlane />
              </Alert.Indicator>
              <Alert.Content>
                <Alert.Title>Waiting for Didier Mugenzi</Alert.Title>
                <Alert.Description>
                  The change is recorded with its effective date. It reaches payroll only after he approves.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel id="docs" className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
          <Alert>
            <Alert.Indicator>
              <ShieldKeyhole />
            </Alert.Indicator>
            <Alert.Content>
              <Alert.Title>Restricted to HR, the owner and {first}</Alert.Title>
              <Alert.Description>
                Every view and download is logged. Retention follows your records policy (configured, not yet legally
                reviewed).
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <ListView aria-label="Documents on file" variant="secondary" items={documents}>
            {(d) => (
              <ListView.Item id={d.id} textValue={d.title}>
                <ListView.ItemContent>
                  <Icon name={d.icon} className="size-4 shrink-0 text-muted" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title className="whitespace-normal">{d.title}</ListView.Title>
                    <ListView.Description className="whitespace-normal">
                      {d.meta.replace("{since}", e.since)}
                    </ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`View ${d.title.toLowerCase()}`}
                    onPress={() =>
                      onView({
                        id: `${Date.now()}-${d.id}`,
                        what: `You viewed ${d.title.toLowerCase()} · ${e.name}`,
                        when: "Just now · reason: HR file review",
                      })
                    }
                  >
                    <Eye className="size-4" />
                    View
                  </Button>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
          <h3 className="text-[15px] leading-[22px] font-semibold">Access Log</h3>
          <Timeline size="sm" density="compact" aria-label={`Access log for ${e.name}`}>
            {accessLog.map((a) => (
              <Timeline.Item key={a.id} status={a.status}>
                <Timeline.Rail>
                  <Timeline.Marker>
                    <Eye className="size-3" />
                  </Timeline.Marker>
                  <Timeline.Connector />
                </Timeline.Rail>
                <Timeline.Content className="flex flex-col text-sm">
                  <span className="font-medium">{a.what}</span>
                  <span className="text-xs text-muted">{a.when}</span>
                </Timeline.Content>
              </Timeline.Item>
            ))}
          </Timeline>
        </Tabs.Panel>

        <Tabs.Panel id="family" className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
          <p className="text-[13px] text-muted">
            Used only for insurance, death benefit and emergencies. Never shown to line managers.
          </p>
          {family.length ? (
            <ListView aria-label="Beneficiaries and dependants" variant="secondary" items={family}>
              {(f) => (
                <ListView.Item id={f.id} textValue={f.name}>
                  <ListView.ItemContent>
                    <Avatar size="sm" variant="soft">
                      <Avatar.Fallback>{initials(f.name)}</Avatar.Fallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                      <ListView.Title>{f.name}</ListView.Title>
                      <ListView.Description className="whitespace-normal">{f.relation}</ListView.Description>
                    </div>
                  </ListView.ItemContent>
                  <ListView.ItemAction>
                    <Chip size="sm" variant="soft">
                      {f.role}
                    </Chip>
                  </ListView.ItemAction>
                </ListView.Item>
              )}
            </ListView>
          ) : (
            <EmptyState size="sm">
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <Persons />
                </EmptyState.Media>
                <EmptyState.Title>No beneficiaries or dependants</EmptyState.Title>
                <EmptyState.Description>
                  {first} can add them from the staff app. HR confirms them against documents.
                </EmptyState.Description>
              </EmptyState.Header>
              <EmptyState.Content>
                <Button size="sm" variant="secondary" isDisabled={reminded} onPress={() => setReminded(true)}>
                  {reminded ? `Reminder sent to ${first}` : "Send a reminder"}
                </Button>
              </EmptyState.Content>
            </EmptyState>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="policies" className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
          <ListView aria-label="Policy acknowledgements" variant="secondary" items={policies}>
            {(p) => (
              <ListView.Item id={p.id} textValue={p.title}>
                <ListView.ItemContent>
                  <BookOpen className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  <div className="flex min-w-0 flex-col">
                    <ListView.Title className="whitespace-normal">{p.title}</ListView.Title>
                    <ListView.Description className="whitespace-normal">{p.meta}</ListView.Description>
                  </div>
                </ListView.ItemContent>
                <ListView.ItemAction>
                  <Chip size="sm" variant="soft" color={toneColor(p.tone)}>
                    {p.state}
                  </Chip>
                </ListView.ItemAction>
              </ListView.Item>
            )}
          </ListView>
        </Tabs.Panel>
      </Tabs>
    </Card>
  );
}
