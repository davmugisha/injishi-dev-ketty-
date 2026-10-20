"use client";

import { Hierarchy, LayoutList, Lock, PersonMagnifier, PersonPlus } from "@gravity-ui/icons";
import {
  Avatar,
  Card,
  Checkbox,
  Chip,
  ProgressBar,
  SearchField,
  Table,
  Tag,
  TagGroup,
  Toast,
  toast,
} from "@heroui/react";
import { EmptyState, ItemCard, NativeSelect, Segment } from "@heroui-pro/react";
import { screenHref } from "@injishi/data";
import type {
  CompensationChange,
  Employee,
  EmployeeStatus,
  FamilyMember,
  FileDocument,
  OffboardingTask,
  OrgNode,
  PeopleProperty,
  PolicyAck,
  PropertyId,
} from "@injishi/data/fixtures/people";
import { LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { useState, useTransition } from "react";
import { setOffboardingStep } from "./actions";
import { EmployeeFileCard } from "./EmployeeFileCard";
import { LoginChip, STATUS } from "./employee-status";
import { initials, PanelCard } from "./parts";

export interface EmployeesData {
  properties: PeopleProperty[];
  employees: Employee[];
  compensation: CompensationChange[];
  documents: FileDocument[];
  family: FamilyMember[];
  policies: PolicyAck[];
  org: OrgNode[];
  offboarding: OffboardingTask[];
}

type StatusFilter = "all" | EmployeeStatus;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "probation", label: "Probation" },
  { id: "leave", label: "On leave" },
  { id: "leaving", label: "Leaving" },
];

export function EmployeesView({
  data,
  initial,
  today,
}: {
  data: EmployeesData;
  initial: { view: "dir" | "org"; employee: string; tab: string };
  /** Today in Kigali ("2026-10-20"), for the pay proposal's dates. */
  today: string;
}) {
  const [view, setView] = useState<"dir" | "org">(initial.view);
  const [query, setQuery] = useState("");
  const [property, setProperty] = useState<"all" | PropertyId>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState(initial.employee);
  const [tab, setTab] = useState(initial.tab);
  const [ob, setOb] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(data.offboarding.map((t) => [t.id, t.done])),
  );
  const [, startTransition] = useTransition();
  // Ticking a step is recorded on the API at once; a refusal takes the tick back and says why.
  const tick = (id: string, done: boolean) => {
    setOb((o) => ({ ...o, [id]: done }));
    startTransition(async () => {
      const result = await setOffboardingStep(id, done);
      if (!result.ok) {
        setOb((o) => ({ ...o, [id]: !done }));
        toast.danger(result.error);
      }
    });
  };

  const short = (id: PropertyId) => data.properties.find((p) => p.id === id)?.short ?? id;
  const q = query.trim().toLowerCase();
  const base = data.employees.filter(
    (e) =>
      (property === "all" || e.property === property) &&
      (!q || `${e.name} ${e.position} ${e.no}`.toLowerCase().includes(q)),
  );
  const rows = base.filter((e) => status === "all" || e.status === status);
  const count = (f: StatusFilter) => (f === "all" ? base.length : base.filter((e) => e.status === f).length);
  const current = data.employees.find((e) => e.id === selected) ?? data.employees[0];

  const obDone = data.offboarding.filter((t) => ob[t.id]).length;
  const obTotal = data.offboarding.length;
  const leaver = data.employees.find((e) => e.status === "leaving");

  return (
    <PageContent>
      <PageHeader
        eyebrow={`People › Employees · ${data.employees.length} records across ${data.properties.length} properties`}
        title="Employees"
        description="An employee file is not an Injishi login. Access is granted and revoked separately by the owner."
        actions={
          <>
            <Segment
              aria-label="View"
              selectedKey={view}
              onSelectionChange={(k) => setView(k === "org" ? "org" : "dir")}
            >
              <Segment.Item id="dir">
                <LayoutList className="size-4" />
                Directory
              </Segment.Item>
              <Segment.Item id="org">
                <Hierarchy className="size-4" />
                Org chart
              </Segment.Item>
            </Segment>
            <LinkButton href={screenHref("Talent")}>
              <PersonPlus className="size-4" />
              Add employee
            </LinkButton>
          </>
        }
      />

      <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(520px,100%),1fr))]">
        <div className="flex min-w-0 flex-col gap-4">
          {view === "dir" ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <SearchField
                  aria-label="Search employees"
                  value={query}
                  onChange={setQuery}
                  className="min-w-0 flex-[1_1_220px]"
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder="Name, position or employee number" />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
                <NativeSelect>
                  <NativeSelect.Trigger
                    aria-label="Property"
                    value={property}
                    onChange={(e) => setProperty(e.target.value as "all" | PropertyId)}
                  >
                    <NativeSelect.Option value="all">All properties</NativeSelect.Option>
                    {data.properties.map((p) => (
                      <NativeSelect.Option key={p.id} value={p.id}>
                        {p.name}
                      </NativeSelect.Option>
                    ))}
                    <NativeSelect.Indicator />
                  </NativeSelect.Trigger>
                </NativeSelect>
              </div>

              <TagGroup
                aria-label="Status"
                size="sm"
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={new Set([status])}
                onSelectionChange={(keys) => {
                  const [k] = [...keys];
                  if (k) setStatus(String(k) as StatusFilter);
                }}
              >
                <TagGroup.List>
                  {STATUS_FILTERS.map((f) => (
                    <Tag
                      key={f.id}
                      id={f.id}
                      textValue={`${f.label} · ${count(f.id)}`}
                      className="data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                    >
                      {f.label} · {count(f.id)}
                    </Tag>
                  ))}
                </TagGroup.List>
              </TagGroup>

              {rows.length ? (
                <Table>
                  <Table.ScrollContainer>
                    <Table.Content
                      aria-label="Employees"
                      selectionMode="single"
                      selectionBehavior="replace"
                      disallowEmptySelection
                      selectedKeys={new Set([selected])}
                      onSelectionChange={(keys) => {
                        if (keys === "all") return;
                        const [k] = [...keys];
                        if (k) setSelected(String(k));
                      }}
                    >
                      <Table.Header>
                        <Table.Column isRowHeader className="px-3">
                          Employee
                        </Table.Column>
                        <Table.Column className="px-3">Department · property</Table.Column>
                        <Table.Column className="px-3">Contract</Table.Column>
                        <Table.Column className="px-3">Status</Table.Column>
                        <Table.Column className="px-3">Injishi login</Table.Column>
                      </Table.Header>
                      <Table.Body>
                        {rows.map((e) => (
                          <Table.Row key={e.id} id={e.id} className="cursor-pointer">
                            <Table.Cell className="px-3">
                              <span className="flex items-center gap-2.5">
                                <Avatar size="sm" variant="soft" color="accent">
                                  <Avatar.Fallback>{initials(e.name)}</Avatar.Fallback>
                                </Avatar>
                                <span className="flex min-w-0 flex-col">
                                  <span className="font-medium">{e.name}</span>
                                  <span className="text-xs text-muted">
                                    {e.position} · {e.no}
                                  </span>
                                </span>
                              </span>
                            </Table.Cell>
                            <Table.Cell className="px-3">
                              <span className="flex flex-col">
                                <span>{e.dept}</span>
                                <span className="text-xs text-muted">{short(e.property)}</span>
                              </span>
                            </Table.Cell>
                            <Table.Cell className="px-3">
                              <span className="flex flex-col">
                                <span>{e.contract}</span>
                                <span className="text-xs text-muted">{e.contractShort}</span>
                              </span>
                            </Table.Cell>
                            <Table.Cell className="px-3">
                              <Chip
                                size="sm"
                                variant="soft"
                                color={toneColor(STATUS[e.status].tone)}
                                className="whitespace-nowrap"
                              >
                                {STATUS[e.status].label}
                              </Chip>
                            </Table.Cell>
                            <Table.Cell className="px-3">
                              <LoginChip employee={e} />
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Content>
                  </Table.ScrollContainer>
                </Table>
              ) : (
                <EmptyState size="sm">
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <PersonMagnifier />
                    </EmptyState.Media>
                    <EmptyState.Title>No one matches</EmptyState.Title>
                    <EmptyState.Description>
                      Clear the search or pick another property or status.
                    </EmptyState.Description>
                  </EmptyState.Header>
                </EmptyState>
              )}
              <p className="text-xs text-muted">
                Showing {rows.length} of {data.employees.length} · sorted by department
              </p>
            </>
          ) : (
            <PanelCard
              id="org-h"
              title="Organisation Chart"
              description="Reporting lines from employee files · headcount includes the lead"
              className="gap-2"
            >
              <ul aria-label="Reporting lines" className="flex flex-col gap-1.5">
                {data.org.map((o) => (
                  <li
                    key={o.id}
                    className="border-l-2 border-separator pl-3"
                    style={{ marginLeft: `${o.level * 28}px` }}
                  >
                    <ItemCard variant="secondary" className="px-3 py-2">
                      <Avatar size="sm" variant="soft" color="accent">
                        <Avatar.Fallback>{initials(o.name)}</Avatar.Fallback>
                      </Avatar>
                      <ItemCard.Content>
                        <ItemCard.Title>{o.name}</ItemCard.Title>
                        <ItemCard.Description>{o.role}</ItemCard.Description>
                      </ItemCard.Content>
                      <ItemCard.Action>
                        <Chip size="sm" variant="soft">
                          {o.count}
                        </Chip>
                      </ItemCard.Action>
                    </ItemCard>
                  </li>
                ))}
              </ul>
            </PanelCard>
          )}

          {leaver ? (
            <PanelCard
              id="off-h"
              title={`Offboarding · ${leaver.name}`}
              description={`${leaver.position} · ${leaver.contractShort.charAt(0).toLowerCase()}${leaver.contractShort.slice(1)} · the employee record stays for retention`}
              leading={
                <Avatar variant="soft" color="warning">
                  <Avatar.Fallback>{initials(leaver.name)}</Avatar.Fallback>
                </Avatar>
              }
              action={
                <Chip variant="soft" color="warning" className="shrink-0">
                  {obDone} of {obTotal} done
                </Chip>
              }
            >
              <ProgressBar value={Math.round((obDone / obTotal) * 100)} aria-label="Offboarding progress" size="sm">
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
              <ul className="flex flex-col gap-2.5">
                {data.offboarding.map((t) => (
                  <li key={t.id} className="flex items-start gap-2.5">
                    {t.ownerOnly ? (
                      <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-label="Owner action" />
                    ) : (
                      <Checkbox
                        aria-label={t.title}
                        isSelected={!!ob[t.id]}
                        onChange={(v) => tick(t.id, v)}
                        className="mt-0.5"
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                        </Checkbox.Content>
                      </Checkbox>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col text-sm">
                      <span className="font-medium">{t.title}</span>
                      <span className="text-xs leading-4 text-muted">{t.detail}</span>
                    </div>
                    {t.board && t.linkLabel ? (
                      <LinkButton href={screenHref(t.board)} size="sm" variant="tertiary">
                        {t.linkLabel}
                      </LinkButton>
                    ) : null}
                  </li>
                ))}
              </ul>
            </PanelCard>
          ) : null}
        </div>

        {current ? (
          <EmployeeFileCard
            key={current.id}
            employee={current}
            propertyName={data.properties.find((p) => p.id === current.property)?.name ?? current.property}
            compensation={data.compensation.filter((c) => c.employeeId === current.id)}
            documents={data.documents}
            family={data.family.filter((f) => f.employeeId === current.id)}
            policies={data.policies}
            tab={tab}
            onTabChange={setTab}
            today={today}
            loginRequested={false}
            onRequestLogin={() =>
              toast.warning(
                "Login access requests are not available yet. Ask the owner to invite this person from Team and roles.",
              )
            }
          />
        ) : (
          <Card className="p-[18px]">
            <p className="text-sm text-muted">Pick an employee to open their file.</p>
          </Card>
        )}
      </div>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
