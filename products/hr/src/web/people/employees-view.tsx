"use client";

import { ChevronRight, Hierarchy, LayoutList, Lock, PersonMagnifier, PersonPlus } from "@gravity-ui/icons";
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  Chip,
  Drawer,
  Pagination,
  SearchField,
  Table,
  Tabs,
  Toast,
  toast,
} from "@heroui/react";
import { EmptyState, ItemCard, NativeSelect, Segment } from "@heroui-pro/react";
import { LinkButton, PageContent, PageHeader, toneColor } from "@injishi/ui";
import { useState, useTransition } from "react";
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
} from "../../model/people.ts";
import { useBoardHref, useHrActions } from "../mount.tsx";
import { EmployeeFileCard } from "./employee-file-card";
import { LoginChip, STATUS } from "./employee-status";
import { avatarColor, Hint, initials, PanelCard, Person, Ring, TAB_CLASS, Tip } from "./parts";

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

/** Rows per page: the list fits a screen, the file opens beside it. */
const PAGE = 12;

export function EmployeesView({
  data,
  initial,
}: {
  data: EmployeesData;
  /** `open`: the address named a person (`?employee=`), so their file opens at once. */
  initial: { view: "dir" | "org"; employee: string; tab: string; open: boolean };
}) {
  const { setOffboardingStep } = useHrActions();
  const screenHref = useBoardHref();
  const [view, setView] = useState<"dir" | "org">(initial.view);
  const [query, setQuery] = useState("");
  const [property, setProperty] = useState<"all" | PropertyId>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(initial.employee);
  const [fileOpen, setFileOpen] = useState(initial.open);
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
      (!q || `${e.name} ${e.position} ${e.no} ${e.dept}`.toLowerCase().includes(q)),
  );
  const rows = base.filter((e) => status === "all" || e.status === status);
  const count = (f: StatusFilter) => (f === "all" ? base.length : base.filter((e) => e.status === f).length);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const at = Math.min(page, pages);
  const shown = rows.slice((at - 1) * PAGE, at * PAGE);
  const current = data.employees.find((e) => e.id === selected) ?? data.employees[0];

  const stepsOf = (id: string) => data.offboarding.filter((t) => t.employeeId === id);
  // Everyone who has left with a step still open: three on the page, the rest under the Leaving filter.
  const leavers = data.employees.filter((e) => e.status === "leaving" && stepsOf(e.id).some((t) => !ob[t.id]));

  /** Any filter change starts the list again from its first page. */
  const filtered =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  const openFile = (id: string, withTab = "overview") => {
    setSelected(id);
    setTab(withTab);
    setFileOpen(true);
  };

  const checklist = (id: string) => (
    <ul className="flex flex-col gap-2.5" aria-label="Offboarding steps">
      {stepsOf(id).map((t) => (
        <li key={t.id} className="flex items-center gap-2.5">
          {t.ownerOnly && !t.canTickOwnerOnly ? (
            <Tip tip="The owner does this">
              <Lock className="size-4 shrink-0 text-muted" aria-label="Owner action" />
            </Tip>
          ) : (
            <Checkbox aria-label={t.title} isSelected={!!ob[t.id]} onChange={(v) => tick(t.id, v)}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
              </Checkbox.Content>
            </Checkbox>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
            <span className={ob[t.id] ? "text-muted" : "font-medium"}>{t.title}</span>
            {t.detail ? <Hint label={`About ${t.title}`}>{t.detail}</Hint> : null}
          </div>
          {t.board && t.linkLabel ? (
            <LinkButton href={screenHref(t.board)} size="sm" variant="tertiary">
              {t.linkLabel}
            </LinkButton>
          ) : null}
        </li>
      ))}
    </ul>
  );

  return (
    <PageContent>
      <PageHeader
        eyebrow={`${data.employees.length} people · ${data.properties.length} properties`}
        title="Employees"
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
            <LinkButton href={`${screenHref("Employees")}/new`}>
              <PersonPlus className="size-4" />
              Add employee
            </LinkButton>
          </>
        }
      />

      {leavers.length ? (
        <Card variant="secondary" className="gap-3 px-4 py-3">
          {leavers.slice(0, 3).map((leaver) => {
            const steps = stepsOf(leaver.id);
            const done = steps.filter((t) => ob[t.id]).length;
            return (
              <div key={leaver.id} className="flex flex-wrap items-center gap-3">
                <Avatar size="sm" variant="soft" color={avatarColor(leaver.name)}>
                  <Avatar.Fallback>{initials(leaver.name)}</Avatar.Fallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{leaver.name} is leaving</span>
                  <span className="text-xs text-muted">{leaver.contractShort}</span>
                </span>
                <Ring
                  value={done}
                  max={steps.length}
                  label={`${done} of ${steps.length} offboarding steps done`}
                  color={done === steps.length ? "success" : "warning"}
                  size="size-10"
                >
                  <span className="text-xs">
                    {done}/{steps.length}
                  </span>
                </Ring>
                <Button size="sm" variant="secondary" onPress={() => openFile(leaver.id, "offboarding")}>
                  Offboarding
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            );
          })}
          {leavers.length > 3 ? (
            <Button size="sm" variant="ghost" className="self-start" onPress={() => filtered(setStatus)("leaving")}>
              {leavers.length - 3} more leaving
            </Button>
          ) : null}
        </Card>
      ) : null}

      {view === "dir" ? (
        <section aria-label="Directory" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs
              variant="secondary"
              selectedKey={status}
              onSelectionChange={(k) => filtered(setStatus)(String(k) as StatusFilter)}
              className="min-w-0"
            >
              <Tabs.ListContainer>
                <Tabs.List aria-label="Status" className="justify-start gap-1">
                  {STATUS_FILTERS.map((f) => (
                    <Tabs.Tab key={f.id} id={f.id} className={TAB_CLASS}>
                      {f.label}
                      <Chip size="sm" variant="soft">
                        {count(f.id)}
                      </Chip>
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
            <div className="flex min-w-0 flex-[1_1_360px] items-center justify-end gap-2">
              <SearchField
                aria-label="Search employees"
                value={query}
                onChange={filtered(setQuery)}
                className="min-w-0 flex-[1_1_200px] sm:max-w-[300px]"
              >
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Name, role, number" />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
              <NativeSelect>
                <NativeSelect.Trigger
                  aria-label="Property"
                  value={property}
                  onChange={(e) => filtered(setProperty)(e.target.value as "all" | PropertyId)}
                >
                  <NativeSelect.Option value="all">All properties</NativeSelect.Option>
                  {data.properties.map((p) => (
                    <NativeSelect.Option key={p.id} value={p.id}>
                      {p.short}
                    </NativeSelect.Option>
                  ))}
                  <NativeSelect.Indicator />
                </NativeSelect.Trigger>
              </NativeSelect>
            </div>
          </div>

          {rows.length ? (
            <>
              <Table>
                <Table.ScrollContainer>
                  <Table.Content
                    aria-label="Employees"
                    className="min-w-[640px]"
                    onRowAction={(key) => openFile(String(key))}
                  >
                    <Table.Header>
                      <Table.Column isRowHeader className="px-3">
                        Employee
                      </Table.Column>
                      <Table.Column className="px-3">Team</Table.Column>
                      <Table.Column className="px-3">Contract</Table.Column>
                      <Table.Column className="px-3">Status</Table.Column>
                      <Table.Column className="w-[60px] px-3">Login</Table.Column>
                      <Table.Column className="w-[44px] px-2">
                        <span className="sr-only">Open</span>
                      </Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {shown.map((e) => (
                        <Table.Row
                          key={e.id}
                          id={e.id}
                          className={`cursor-pointer ${fileOpen && e.id === selected ? "bg-accent-soft" : ""}`}
                        >
                          <Table.Cell className="px-3 py-2">
                            <Person name={e.name} sub={`${e.position} · ${e.no}`} />
                          </Table.Cell>
                          <Table.Cell className="px-3 py-2 text-[13px]">
                            <span className="whitespace-nowrap">{e.dept}</span>
                            <span className="text-muted"> · {short(e.property)}</span>
                          </Table.Cell>
                          <Table.Cell className="px-3 py-2 text-[13px]">
                            <Tip tip={e.contractShort}>
                              <span className="whitespace-nowrap">{e.contract}</span>
                            </Tip>
                          </Table.Cell>
                          <Table.Cell className="px-3 py-2">
                            <Chip
                              size="sm"
                              variant="soft"
                              color={toneColor(STATUS[e.status].tone)}
                              className="whitespace-nowrap"
                            >
                              {STATUS[e.status].label}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell className="px-3 py-2">
                            <LoginChip employee={e} iconOnly />
                          </Table.Cell>
                          <Table.Cell className="px-2 py-2 text-muted">
                            <ChevronRight className="size-4" aria-hidden="true" />
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
              {pages > 1 ? (
                <Pagination size="sm" className="flex flex-wrap items-center justify-between gap-2">
                  <Pagination.Summary className="text-xs text-muted tabular">
                    {(at - 1) * PAGE + 1}–{Math.min(at * PAGE, rows.length)} of {rows.length}
                  </Pagination.Summary>
                  <Pagination.Content>
                    <Pagination.Item>
                      <Pagination.Previous
                        aria-label="Previous page"
                        isDisabled={at === 1}
                        onPress={() => setPage(at - 1)}
                      >
                        <Pagination.PreviousIcon />
                      </Pagination.Previous>
                    </Pagination.Item>
                    {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                      <Pagination.Item key={n}>
                        <Pagination.Link
                          isActive={n === at}
                          aria-label={`Page ${n}`}
                          aria-current={n === at ? "page" : undefined}
                          onPress={() => setPage(n)}
                        >
                          {n}
                        </Pagination.Link>
                      </Pagination.Item>
                    ))}
                    <Pagination.Item>
                      <Pagination.Next aria-label="Next page" isDisabled={at === pages} onPress={() => setPage(at + 1)}>
                        <Pagination.NextIcon />
                      </Pagination.Next>
                    </Pagination.Item>
                  </Pagination.Content>
                </Pagination>
              ) : null}
            </>
          ) : (
            <EmptyState size="sm">
              <EmptyState.Header>
                <EmptyState.Media variant="icon">
                  <PersonMagnifier />
                </EmptyState.Media>
                <EmptyState.Title>No one matches</EmptyState.Title>
              </EmptyState.Header>
            </EmptyState>
          )}
        </section>
      ) : (
        <PanelCard id="org-h" title="Organisation chart" className="gap-2">
          <ul aria-label="Reporting lines" className="flex flex-col gap-1.5">
            {data.org.map((o) => (
              <li key={o.id} className="border-l-2 border-separator pl-3" style={{ marginLeft: `${o.level * 28}px` }}>
                <ItemCard variant="secondary" className="px-3 py-2">
                  <Avatar size="sm" variant="soft" color={avatarColor(o.name)}>
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

      <Drawer.Backdrop isOpen={fileOpen && !!current} onOpenChange={setFileOpen}>
        <Drawer.Content placement="right">
          <Drawer.Dialog
            aria-label={current ? `File of ${current.name}` : "Employee file"}
            className="w-full max-w-[640px] p-0"
          >
            {current ? (
              <EmployeeFileCard
                key={current.id}
                employee={current}
                propertyName={data.properties.find((p) => p.id === current.property)?.name ?? current.property}
                compensation={data.compensation.filter((c) => c.employeeId === current.id)}
                family={data.family.filter((f) => f.employeeId === current.id)}
                policies={data.policies}
                tab={tab}
                onTabChange={setTab}
                offboarding={stepsOf(current.id).length ? checklist(current.id) : undefined}
                onClose={() => setFileOpen(false)}
                className="h-full overflow-y-auto rounded-none border-0 bg-transparent shadow-none"
              />
            ) : null}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
      <Toast.Provider placement="bottom" />
    </PageContent>
  );
}
