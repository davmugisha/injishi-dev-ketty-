"use client";

import { BookOpen, Calculator, Comment, Lock, Pencil, Persons, Xmark } from "@gravity-ui/icons";
import { Alert, Avatar, Button, Card, Chip, Input, Label, Table, Tabs, TextField } from "@heroui/react";
import { EmptyState, ListView, NativeSelect } from "@heroui-pro/react";
import { formatRwf, KeyValueList, LinkButton, toneColor } from "@injishi/ui";
import { type ReactNode, useState } from "react";
import type { CompensationChange, Employee, FamilyMember, PolicyAck } from "../../model/people.ts";
import { useBoardHref } from "../mount.tsx";
import { EmployeeAccessPanel } from "./employee-access-panel";
import { EmployeeDocumentsPanel } from "./employee-documents-panel";
import { EmployeePersonalPanel } from "./employee-personal-panel";
import { LoginChip, STATUS } from "./employee-status";
import { avatarColor, firstName, Hint, initials, Person, TAB_CLASS, Tip } from "./parts";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "personal", label: "Personal" },
  { id: "pay", label: "Pay" },
  { id: "docs", label: "Documents" },
  { id: "family", label: "Family" },
  { id: "policies", label: "Policies" },
  { id: "access", label: "Access" },
];

/** "+RWF 15,000" for raises, "-RWF 15,000" for cuts. */
const signed = (n: number) => `${n > 0 ? "+" : ""}${formatRwf(Math.round(n))}`;

const onDate = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(new Date(`${iso}T12:00:00Z`));
const longDate = (iso: string) => onDate(iso, { day: "numeric", month: "short", year: "numeric" });
const monthOf = (iso: string) => onDate(iso, { month: "long" });

/** The month a pay change falls in, counted from today in Kigali. */
function payPeriod() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const nextFirst = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return { today, nextFirst, daysInMonth, daysLeft: daysInMonth - day + 1 };
}

/**
 * Right-hand employee file: overview, pay with what a change would come to, documents, family,
 * policies, and Access: the person's Injishi login, which HR gives here.
 */
export function EmployeeFileCard({
  employee: e,
  propertyName,
  compensation,
  family,
  policies,
  tab,
  onTabChange,
  offboarding,
  onClose,
  className,
}: {
  employee: Employee;
  propertyName: string;
  compensation: CompensationChange[];
  family: FamilyMember[];
  policies: PolicyAck[];
  tab: string;
  onTabChange: (tab: string) => void;
  /** A leaver's checklist: shown as its own tab, first. */
  offboarding?: ReactNode;
  /** Shown in a drawer: a close button beside Message. */
  onClose?: () => void;
  className?: string;
}) {
  const screenHref = useBoardHref();
  const first = firstName(e.name);
  const [proposal, setProposal] = useState<"closed" | "open">("closed");
  const [newBase, setNewBase] = useState(String(e.base + 15000));
  const [effective, setEffective] = useState<"next" | "mid">("next");

  const parsed = Number.parseInt(newBase.replace(/[^0-9]/g, ""), 10);
  const diff = (Number.isNaN(parsed) ? e.base : parsed) - e.base;
  const mid = effective === "mid";
  const period = payPeriod();
  const thisMonth = monthOf(period.today);
  const nextMonth = monthOf(period.nextFirst);
  const impact =
    diff === 0
      ? "none yet"
      : mid
        ? `${signed((diff * period.daysLeft) / period.daysInMonth)} in ${thisMonth}, then ${signed(diff)} a month`
        : `${signed(diff)} a month from ${nextMonth}`;
  const impactNote = mid
    ? `${period.daysLeft} of ${period.daysInMonth} ${thisMonth} days at the new rate, paid as a back-pay line in ${nextMonth}.`
    : `Starts with the ${nextMonth} run.`;

  return (
    <Card
      aria-labelledby="file-h"
      className={`min-w-0 gap-0 overflow-hidden p-0 ${className ?? ""}`}
      render={(props) => <section {...(props as object)} />}
    >
      <div className="flex items-start gap-3 px-[18px] pt-[18px]">
        <Avatar size="lg" variant="soft" color={avatarColor(e.name)}>
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
            <Tip tip={`HR, the owner and ${first} only`}>
              <Chip size="sm" variant="soft">
                <Lock className="size-3" />
                <Chip.Label>Restricted</Chip.Label>
              </Chip>
            </Tip>
          </span>
        </div>
        <LinkButton href={screenHref("Messages")} size="sm" variant="secondary">
          <Comment className="size-4" />
          Message
        </LinkButton>
        {onClose ? (
          <Button size="sm" variant="ghost" isIconOnly aria-label="Close the file" onPress={onClose}>
            <Xmark className="size-4" />
          </Button>
        ) : null}
      </div>
      <Tabs
        variant="secondary"
        selectedKey={tab}
        onSelectionChange={(k) => onTabChange(String(k))}
        className="gap-0 pt-3"
      >
        <Tabs.ListContainer className="mx-[18px]">
          <Tabs.List aria-label="Employee file" className="justify-start gap-1">
            {(offboarding ? [{ id: "offboarding", label: "Offboarding" }, ...TABS] : TABS).map((t) => (
              <Tabs.Tab key={t.id} id={t.id} className={TAB_CLASS}>
                {t.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        {offboarding ? (
          <Tabs.Panel id="offboarding" className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
            {offboarding}
          </Tabs.Panel>
        ) : null}

        <Tabs.Panel id="overview" className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
          <KeyValueList
            items={[
              { label: "Position", value: `${e.position} · grade ${e.grade}` },
              {
                label: "Reports to",
                value: e.manager.startsWith("None") ? (
                  e.manager
                ) : (
                  <Person name={e.manager.split(", ")[0]} sub={e.manager.split(", ")[1]} />
                ),
              },
              { label: "Department", value: e.dept },
              { label: "Property", value: propertyName },
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
          </Card>
          <Card variant="secondary" className="gap-2 p-[14px] text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">Injishi login</span>
              <LoginChip employee={e} />
            </div>
            <span className="text-[13px]">{e.login ? e.login : "No login · kiosk PIN, payslips by SMS"}</span>
            <Button size="sm" variant="secondary" className="self-start" onPress={() => onTabChange("access")}>
              {e.login ? "View access" : "Give login access"}
            </Button>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel id="personal" className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
          {tab === "personal" ? <EmployeePersonalPanel employeeId={e.id} /> : null}
        </Tabs.Panel>

        <Tabs.Panel id="pay" className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
          <h3 className="text-[15px] leading-[22px] font-semibold">Pay history</h3>
          <Table variant="secondary">
            <Table.ScrollContainer>
              <Table.Content aria-label="Compensation history">
                <Table.Header>
                  <Table.Column isRowHeader>Effective</Table.Column>
                  <Table.Column className="text-right">Base</Table.Column>
                  <Table.Column className="text-right">Allowances</Table.Column>
                  <Table.Column>Reason</Table.Column>
                </Table.Header>
                <Table.Body>
                  {compensation.map((c) => (
                    <Table.Row key={c.id} id={c.id}>
                      <Table.Cell className="tabular">{c.effective}</Table.Cell>
                      <Table.Cell className="text-right tabular">{formatRwf(c.base)}</Table.Cell>
                      <Table.Cell className="text-right tabular">{formatRwf(c.allowance)}</Table.Cell>
                      <Table.Cell>
                        <span className="flex items-center gap-1">
                          {c.reason}
                          <Hint label="Approval">{c.approvedBy}</Hint>
                        </span>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
          <KeyValueList items={[{ label: "Paid by", value: e.payMethod }]} />
          {proposal === "closed" ? (
            <Button variant="secondary" className="self-start" onPress={() => setProposal("open")}>
              <Pencil className="size-4" />
              Work out a pay change
            </Button>
          ) : null}
          {proposal === "open" ? (
            <Card variant="secondary" className="gap-3 p-[14px] text-sm">
              <span className="font-semibold">Work out a pay change</span>
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
                    <NativeSelect.Option value="next">{longDate(period.nextFirst)} · next period</NativeSelect.Option>
                    <NativeSelect.Option value="mid">{longDate(period.today)} · this month</NativeSelect.Option>
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>
              <Alert>
                <Alert.Indicator>
                  <Calculator />
                </Alert.Indicator>
                <Alert.Content>
                  <Alert.Title className="flex items-center gap-1">
                    Pay impact: {impact}
                    <Hint label="How it is paid">{impactNote}</Hint>
                  </Alert.Title>
                </Alert.Content>
              </Alert>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onPress={() => setProposal("closed")}>
                  Close
                </Button>
              </div>
            </Card>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel id="docs" className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
          {tab === "docs" ? <EmployeeDocumentsPanel employeeId={e.id} /> : null}
        </Tabs.Panel>

        <Tabs.Panel id="family" className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
          {family.length ? (
            <ListView aria-label="Beneficiaries and dependants" variant="secondary" items={family}>
              {(f) => (
                <ListView.Item id={f.id} textValue={f.name}>
                  <ListView.ItemContent>
                    <Avatar size="sm" variant="soft" color={avatarColor(f.name)}>
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
                <EmptyState.Title>No family on file</EmptyState.Title>
              </EmptyState.Header>
            </EmptyState>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="access" className="flex flex-col gap-4 px-[18px] pt-4 pb-5">
          {tab === "access" ? <EmployeeAccessPanel employeeId={e.id} name={e.name} email={null} /> : null}
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
