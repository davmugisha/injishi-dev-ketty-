"use client";

/**
 * Staff · Employees (ADR-058, AC-P1 to AC-P3, AC-P5).
 *
 * Everyone on file at this business, with or without an account: the cook who
 * never signs in is here beside the receptionist who does. A file is not an
 * account and holds no role; the badge says which role an account holds, when
 * the file has one.
 *
 * **What a row shows depends on who is looking, and the SERVER decides it.**
 * `people.view` reads files without a date of birth, an ID, an RSSB number or
 * a wage; `people.manage` and `payroll.run` read them in full. The response
 * carries `view`, and this screen draws the wage column only for a full row,
 * so a manager's screen has no empty wage cell to wonder about.
 *
 * A file backfilled from a membership starts without its statutory details
 * (`detailsMissing`). The row says so, because a contract cannot start until
 * they are in.
 *
 * The list is the shared `DataView` over `EMPLOYEE_LIST` (058-list-framework):
 * search, filters, sort, grouping, the card view, saved views and the CSV
 * export, all in the URL. What a reader may filter or sort follows their file
 * view, and the server refuses the rest. Job position, employee type and tag
 * filter by the business's own catalogs (058-people-file AC-PF13).
 *
 * "Put someone on file" opens `NewStaffFile`: the file, and with it whatever
 * else the hire comes with (contract, pay account, emergency contact,
 * documents, a note), so nobody walks the file's tabs to finish a hire.
 */

import { EMPLOYEE_LIST, EMPLOYEE_MISSING_DETAIL_LABEL, EmployeePage, LIST_READ, type Employee } from "@injishi/contracts";
import { DataView, type DataColumn } from "@injishi/ui";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ActionButton, Badge } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { downloadListCsv, useListPage, useListUrl, useSavedViewsFor } from "../../data/lists";
import { useHrCatalog } from "../../data/people-file";
import { dshortIso, fmt } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { usePms } from "../../store";
import { currentGrant } from "../../store/helpers";
import { NewStaffFile } from "./new-staff-file";
import { Avatar } from "./staff-look";
import { toneIntent, useNarrowScreen } from "./staff-ui";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  receptionist: "Receptionist",
  finance: "Finance",
  hr: "HR",
  housekeeper: "Housekeeper",
};

export function Employees() {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const narrow = useNarrowScreen(1300);
  const { can } = useCapability();
  const [adding, setAdding] = useState(false);
  const branches = currentGrant(state)?.branches ?? [];
  const base = `${workspaceBase(workspaceId)}/staff`;
  const mayManage = can("people.manage");
  const positions = useHrCatalog(workspaceId, "job-positions");
  const types = useHrCatalog(workspaceId, "employee-types");
  const tags = useHrCatalog(workspaceId, "tags");
  // Every row of a catalog filters, archived ones too: a file may still carry one.
  const optionsOf = (items: { id: string; title: string; status: string }[] | undefined) =>
    (items ?? []).map((i) => ({ value: i.id, label: i.status === "archived" ? `${i.title} (archived)` : i.title }));

  // The file view decides what a reader may filter, sort and see; the server
  // decides what it sends, so this only keeps the screen from asking for more.
  const view = can("people.manage") || can("payroll.run") ? "full" : "basic";
  const { defaultView, savedViews } = useSavedViewsFor(workspaceId, EMPLOYEE_LIST.key);
  const list = useListUrl(EMPLOYEE_LIST, view, defaultView);
  const page = useListPage(
    workspaceId,
    "employees",
    "/ops/employees",
    list.state.query,
    EmployeePage,
    LIST_READ["staff.employees"],
  );
  const columns = useMemo(() => employeeColumns(base, view === "full"), [base, view]);

  return (
    <div className="pms-enter @container flex max-w-page flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          Everyone who works here, whether or not they ever sign in. A role comes with an account;
          pay comes with a contract.
        </span>
        {mayManage && !adding && (
          <ActionButton variant="primary" onClick={() => setAdding(true)}>
            Put someone on file
          </ActionButton>
        )}
      </div>

      {adding && <NewStaffFile onDone={() => setAdding(false)} />}

      <DataView
        spec={EMPLOYEE_LIST}
        reader={view}
        state={list.state}
        onStateChange={list.setState}
        dropped={list.dropped}
        onDismissDropped={list.dismissDropped}
        page={page.data}
        status={page.isError ? "error" : page.isPending ? "loading" : "ready"}
        onRetry={() => void page.refetch()}
        columns={columns}
        // Eight columns need a wide window. A small laptop starts with six; Hired
        // and Details are one press away under Columns.
        defaultColumns={
          narrow
            ? ["employeeNumber", "name", "branch", "status", "account", "wage"]
            : ["employeeNumber", "name", "branch", "hiredOn", "status", "account", "details", "wage"]
        }
        getRowId={(e) => e.id}
        labelOf={(e) => e.displayName}
        groupKeyOf={employeeGroupKey}
        caption="Staff files"
        searchPlaceholder="Search name, number or phone"
        refOptions={{
          branch: branches.map((b) => ({ value: b.id, label: b.name })),
          jobPosition: optionsOf(positions.data?.items),
          employeeType: optionsOf(types.data?.items),
          tag: optionsOf(tags.data?.items),
        }}
        card={(e) => (
          <Link href={`${base}/${e.id}`} className="flex flex-col gap-1 no-underline">
            <span className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
              <Avatar name={e.displayName} size={36} />
              {e.displayName}
            </span>
            <span className="text-2xs text-muted-foreground">
              {[e.employeeNumber, e.jobPositionTitle, e.workPropertyName ?? "No branch yet"].filter(Boolean).join(" · ")}
            </span>
            <span className="flex flex-wrap gap-1.5 pt-1">
              <Badge intent={e.hasAccount ? "info" : "neutral"}>
                {e.hasAccount && e.orgRole ? ROLE_LABEL[e.orgRole] : "No account"}
              </Badge>
              {e.detailsMissing.length > 0 && <Badge intent="warn">Details missing</Badge>}
              {e.tags.map((t) => (
                <Badge key={t.id} intent={toneIntent(t.tone)}>
                  {t.title}
                </Badge>
              ))}
            </span>
          </Link>
        )}
        savedViews={savedViews}
        onExport={(shown) => void downloadListCsv(workspaceId as string, "/ops/employees", list.state.query, shown)}
        empty={{
          title: "Nobody is on file yet",
          body: mayManage
            ? "Put your first person on file to roster and pay them."
            : "The owner puts people on file.",
          action:
            mayManage && !adding ? (
              <ActionButton variant="primary" onClick={() => setAdding(true)}>
                Put someone on file
              </ActionButton>
            ) : undefined,
        }}
      />

      {view === "basic" && (
        <p className="text-2xs text-muted-foreground">
          Dates of birth, ID and RSSB numbers and wages are shown only to people who manage staff files
          or run payroll.
        </p>
      )}
    </div>
  );
}

/** How the server keys each groupable field of a file, so a grouped page heads its groups. */
function employeeGroupKey(e: Employee, field: string): string | null {
  switch (field) {
    case "status":
      return e.status;
    case "branch":
      return e.workPropertyId;
    case "jobPosition":
      return e.jobPositionId;
    case "employeeType":
      return e.employeeType?.id ?? null;
    case "hasAccount":
      return String(e.hasAccount);
    default:
      return null;
  }
}

/**
 * The Employees columns. Keys that name an `EMPLOYEE_LIST` field sort by it when
 * the spec allows; the wage column exists only for a full reader, because a
 * `people.view` row carries no wage to show.
 */
function employeeColumns(base: string, full: boolean): DataColumn<Employee>[] {
  return [
    {
      key: "employeeNumber",
      header: "Number",
      cell: (e) => <span className="pms-num text-2xs text-muted-foreground">{e.employeeNumber}</span>,
    },
    {
      key: "name",
      header: "Name",
      cell: (e) => (
        <Link href={`${base}/${e.id}`} data-employee={e.employeeNumber} className="flex items-center gap-2.5 font-semibold whitespace-nowrap text-foreground no-underline hover:underline">
          {/* On a small laptop the six columns need the room more than the name needs a face. */}
          <Avatar name={e.displayName} size={28} className="@max-3xl:hidden" />
          {e.displayName}
        </Link>
      ),
    },
    { key: "jobPosition", header: "Position", wrap: true, cell: (e) => e.jobPositionTitle ?? "None yet" },
    { key: "employeeType", header: "Type", cell: (e) => e.employeeType?.title ?? "—" },
    {
      key: "tags",
      header: "Tags",
      wrap: true,
      cell: (e) =>
        e.tags.length === 0 ? (
          "—"
        ) : (
          <span className="flex flex-wrap gap-1">
            {e.tags.map((t) => (
              <Badge key={t.id} intent={toneIntent(t.tone)}>
                {t.title}
              </Badge>
            ))}
          </span>
        ),
    },
    {
      key: "branch",
      header: "Branch",
      // A long branch name takes a second line, never a third.
      wrap: true,
      cell: (e) => <span className="block min-w-32">{e.workPropertyName ?? "No branch yet"}</span>,
    },
    { key: "hiredOn", header: "Hired", cell: (e) => <span className="pms-num">{dshortIso(e.hiredOn)}</span> },
    {
      key: "status",
      header: "Status",
      cell: (e) => <Badge intent={e.status === "active" ? "ok" : "neutral"}>{e.status === "active" ? "Working" : "Left"}</Badge>,
    },
    {
      key: "account",
      header: "Account",
      cell: (e) => (
        <Badge intent={e.hasAccount ? "info" : "neutral"}>
          {e.hasAccount && e.orgRole ? ROLE_LABEL[e.orgRole] : "No account"}
        </Badge>
      ),
    },
    {
      key: "details",
      header: "Details",
      cell: (e) =>
        e.detailsMissing.length > 0 ? (
          <span title={`Missing ${e.detailsMissing.map((d) => EMPLOYEE_MISSING_DETAIL_LABEL[d]).join(", ")}`}>
            <Badge intent="warn">{e.detailsMissing.length} missing</Badge>
          </span>
        ) : (
          <span className="text-2xs text-muted-foreground">Complete</span>
        ),
    },
    ...(full
      ? [
          {
            key: "wage",
            header: "Wage",
            align: "end" as const,
            cell: (e: Employee) =>
              e.view === "full" && e.currentContract ? fmt(e.currentContract.wageRwf) : "No contract",
          },
        ]
      : []),
  ];
}
