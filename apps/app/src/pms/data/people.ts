"use client";

/**
 * The client for the HR module's operator routes (ADR-058, first thread):
 * `/api/v1/ops/employees`, `shift-templates`, `roster`, `attendance`,
 * `leave/requests` and `pay-runs`.
 *
 * The same rules as `ops.ts` and `outlets.ts`: a read throws so a screen can
 * tell "nobody on file" from "no answer", every response is parsed against its
 * contract, and nothing here decides a permission. Each read asks
 * `useMayRead` with the permissions its route declares, so a receptionist never
 * fires the refused read that would invalidate `me.workspaces` for nothing.
 *
 * Keys follow `["ops", noun, workspaceId, …]`, so a command invalidates a noun
 * by prefix and a 403 anywhere still reaches them through the query client.
 */

import {
  AttendanceList,
  AttendanceRecord,
  CreateContractResponse,
  Employee,
  EmployeeFile,
  EmployeePage,
  LeaveBalances,
  LeaveRequest,
  LeaveRequestList,
  PayRunDetail,
  PayRunList,
  RosterEntry,
  RosterList,
  ShiftTemplate,
  ShiftTemplateList,
  encodeListQuery,
  type CorrectAttendanceRequest,
  type CreateContractRequest,
  type CreateEmployeeRequest,
  type CreateLeaveRequestRequest,
  type CreateRosterEntryRequest,
  type CreateShiftTemplateRequest,
  type EmployeeStatus,
  type LeaveRequestStatus,
  type OffboardEmployeeRequest,
  type UpdateEmployeeRequest,
} from "@injishi/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { command } from "./api";
import { OPS_READ, read, useMayRead } from "./ops";

export const peopleKeys = {
  all: ["ops"] as const,
  employees: (ws: string | null, status?: EmployeeStatus) => ["ops", "employees", ws, status ?? "all"] as const,
  employee: (ws: string | null, id: string) => ["ops", "employee", ws, id] as const,
  balances: (ws: string | null, id: string) => ["ops", "leave-balances", ws, id] as const,
  templates: (ws: string | null) => ["ops", "shift-templates", ws] as const,
  roster: (ws: string | null, from: string, to: string) => ["ops", "roster", ws, from, to] as const,
  attendance: (ws: string | null, date: string) => ["ops", "attendance", ws, date] as const,
  leave: (ws: string | null, status?: LeaveRequestStatus) => ["ops", "leave-requests", ws, status ?? "all"] as const,
  payRuns: (ws: string | null) => ["ops", "pay-runs", ws] as const,
  payRun: (ws: string | null, id: string) => ["ops", "pay-run", ws, id] as const,
};

/** Refetch every HR read of these nouns. HR screens show each other's rows. */
function refresh(client: QueryClient, ...nouns: string[]): void {
  for (const noun of nouns) void client.invalidateQueries({ queryKey: ["ops", noun] });
}

// --- Reads ---------------------------------------------------------------------

/** The most files one read gathers, a page of 100 at a time. Past it a picker needs search, not a longer list. */
const MAX_FILES_READ = 1000;

/** Every file of a status in the caller's branches, page after page of the list route (058-list-framework). */
async function readEmployees(ws: string, status?: EmployeeStatus): Promise<Employee[]> {
  const items: Employee[] = [];
  for (let page = 1; items.length < MAX_FILES_READ; page += 1) {
    const params = new URLSearchParams(
      encodeListQuery({ filters: status ? [{ field: "status", op: "eq", value: status }] : [], page, pageSize: 100 }),
    );
    const chunk = await read(`/ops/employees?${params.toString()}`, ws, EmployeePage);
    items.push(...chunk.items);
    if (chunk.items.length < 100 || items.length >= chunk.total) break;
  }
  return items;
}

/** Every file in the caller's branches, in the shape their grant reads (AC-P2). */
export function useEmployees(ws: string | null, status?: EmployeeStatus): UseQueryResult<Employee[]> {
  const mayRead = useMayRead(OPS_READ.employees);
  return useQuery({
    queryKey: peopleKeys.employees(ws, status),
    queryFn: () => readEmployees(ws as string, status),
    enabled: ws !== null && mayRead,
  });
}

export function useEmployeeFile(ws: string | null, id: string): UseQueryResult<EmployeeFile> {
  const mayRead = useMayRead(OPS_READ.employees);
  return useQuery({
    queryKey: peopleKeys.employee(ws, id),
    queryFn: () => read(`/ops/employees/${id}`, ws as string, EmployeeFile),
    enabled: ws !== null && mayRead,
  });
}

export function useLeaveBalances(ws: string | null, id: string | null): UseQueryResult<LeaveBalances> {
  const mayRead = useMayRead(OPS_READ.leaveBalances);
  return useQuery({
    queryKey: peopleKeys.balances(ws, id ?? ""),
    queryFn: () => read(`/ops/employees/${id}/leave-balances`, ws as string, LeaveBalances),
    enabled: ws !== null && id !== null && mayRead,
  });
}

export function useShiftTemplates(ws: string | null): UseQueryResult<ShiftTemplateList> {
  const mayRead = useMayRead(OPS_READ.shiftTemplates);
  return useQuery({
    queryKey: peopleKeys.templates(ws),
    queryFn: () => read("/ops/shift-templates", ws as string, ShiftTemplateList),
    enabled: ws !== null && mayRead,
  });
}

export function useRoster(ws: string | null, from: string, to: string): UseQueryResult<RosterList> {
  const mayRead = useMayRead(OPS_READ.roster);
  return useQuery({
    queryKey: peopleKeys.roster(ws, from, to),
    queryFn: () => read(`/ops/roster?from=${from}&to=${to}`, ws as string, RosterList),
    enabled: ws !== null && mayRead,
  });
}

export function useAttendance(ws: string | null, date: string): UseQueryResult<AttendanceList> {
  const mayRead = useMayRead(OPS_READ.attendance);
  return useQuery({
    queryKey: peopleKeys.attendance(ws, date),
    queryFn: () => read(`/ops/attendance?date=${date}`, ws as string, AttendanceList),
    enabled: ws !== null && mayRead,
    // The desk works the sheet live, and a colleague may clock someone in
    // from another screen.
    refetchInterval: 30_000,
  });
}

export function useLeaveRequests(ws: string | null, status?: LeaveRequestStatus): UseQueryResult<LeaveRequestList> {
  const mayRead = useMayRead(OPS_READ.leaveRequests);
  return useQuery({
    queryKey: peopleKeys.leave(ws, status),
    queryFn: () =>
      read(`/ops/leave/requests${status ? `?status=${status}` : ""}`, ws as string, LeaveRequestList),
    enabled: ws !== null && mayRead,
  });
}

export function usePayRuns(ws: string | null): UseQueryResult<PayRunList> {
  const mayRead = useMayRead(OPS_READ.payRuns);
  return useQuery({
    queryKey: peopleKeys.payRuns(ws),
    queryFn: () => read("/ops/pay-runs", ws as string, PayRunList),
    enabled: ws !== null && mayRead,
  });
}

export function usePayRun(ws: string | null, id: string): UseQueryResult<PayRunDetail> {
  const mayRead = useMayRead(OPS_READ.payRuns);
  return useQuery({
    queryKey: peopleKeys.payRun(ws, id),
    queryFn: () => read(`/ops/pay-runs/${id}`, ws as string, PayRunDetail),
    enabled: ws !== null && mayRead,
  });
}

// --- Files and contracts -----------------------------------------------------------

export function useCreateEmployee(ws: string | null): UseMutationResult<Employee, Error, CreateEmployeeRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      Employee.parse(await command<unknown>("/ops/employees", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "employees"),
  });
}

export function useUpdateEmployee(
  ws: string | null,
): UseMutationResult<Employee, Error, { id: string; patch: UpdateEmployeeRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }) =>
      Employee.parse(
        await command<unknown>(`/ops/employees/${id}`, { workspaceId: ws as string, body: patch, method: "PATCH" }),
      ),
    onSuccess: () => refresh(client, "employees", "employee"),
  });
}

export function useCreateContract(
  ws: string | null,
): UseMutationResult<CreateContractResponse, Error, { id: string; body: CreateContractRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      CreateContractResponse.parse(
        await command<unknown>(`/ops/employees/${id}/contracts`, { workspaceId: ws as string, body }),
      ),
    onSuccess: () => refresh(client, "employees", "employee"),
  });
}

/** Offboarding touches the roster, leave and the team too, so all of them refetch. */
export function useOffboard(
  ws: string | null,
): UseMutationResult<Employee, Error, { id: string; body: OffboardEmployeeRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      Employee.parse(
        await command<unknown>(`/ops/employees/${id}/offboard`, { workspaceId: ws as string, body }),
      ),
    onSuccess: () => refresh(client, "employees", "employee", "roster", "leave-requests", "leave-balances", "team"),
  });
}

// --- Time ------------------------------------------------------------------------

export function useCreateShiftTemplate(
  ws: string | null,
): UseMutationResult<ShiftTemplate, Error, CreateShiftTemplateRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      ShiftTemplate.parse(await command<unknown>("/ops/shift-templates", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "shift-templates"),
  });
}

export function useRosterEntry(ws: string | null): UseMutationResult<RosterEntry, Error, CreateRosterEntryRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      RosterEntry.parse(await command<unknown>("/ops/roster", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "roster"),
  });
}

export function useCancelRosterEntry(
  ws: string | null,
): UseMutationResult<RosterEntry, Error, { id: string; reason: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }) =>
      RosterEntry.parse(
        await command<unknown>(`/ops/roster/${id}/cancel`, { workspaceId: ws as string, body: { reason } }),
      ),
    onSuccess: () => refresh(client, "roster"),
  });
}

export function useClockIn(
  ws: string | null,
): UseMutationResult<AttendanceRecord, Error, { employeeId: string; rosterEntryId?: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      AttendanceRecord.parse(await command<unknown>("/ops/attendance/clock-in", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "attendance"),
  });
}

export function useClockOut(ws: string | null): UseMutationResult<AttendanceRecord, Error, { id: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) =>
      AttendanceRecord.parse(
        await command<unknown>(`/ops/attendance/${id}/clock-out`, { workspaceId: ws as string, body: {} }),
      ),
    onSuccess: () => refresh(client, "attendance"),
  });
}

export function useCorrectAttendance(
  ws: string | null,
): UseMutationResult<AttendanceRecord, Error, { id: string; body: CorrectAttendanceRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      AttendanceRecord.parse(
        await command<unknown>(`/ops/attendance/${id}/correct`, { workspaceId: ws as string, body }),
      ),
    onSuccess: () => refresh(client, "attendance"),
  });
}

// --- Leave -------------------------------------------------------------------------

export function useRequestLeave(ws: string | null): UseMutationResult<LeaveRequest, Error, CreateLeaveRequestRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      LeaveRequest.parse(await command<unknown>("/ops/leave/requests", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "leave-requests", "leave-balances"),
  });
}

export type LeaveDecision = "approve" | "reject" | "cancel";

/** Approving also clears the person's shifts in the range, so the roster refetches. */
export function useDecideLeave(
  ws: string | null,
): UseMutationResult<LeaveRequest, Error, { id: string; decision: LeaveDecision; note?: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, note }) =>
      LeaveRequest.parse(
        await command<unknown>(`/ops/leave/requests/${id}/${decision}`, {
          workspaceId: ws as string,
          body: { note: note?.trim() || null },
        }),
      ),
    onSuccess: () => refresh(client, "leave-requests", "leave-balances", "roster"),
  });
}

// --- Pay ---------------------------------------------------------------------------

export function useCreatePayRun(ws: string | null): UseMutationResult<PayRunDetail, Error, { period: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      PayRunDetail.parse(await command<unknown>("/ops/pay-runs", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "pay-runs"),
  });
}

export function usePayRunCommand(
  ws: string | null,
): UseMutationResult<PayRunDetail, Error, { id: string; action: "recompute" | "confirm" }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }) =>
      PayRunDetail.parse(await command<unknown>(`/ops/pay-runs/${id}/${action}`, { workspaceId: ws as string })),
    onSuccess: (detail) => {
      client.setQueryData(peopleKeys.payRun(ws, detail.run.id), detail);
      refresh(client, "pay-runs", "pay-run");
    },
  });
}
