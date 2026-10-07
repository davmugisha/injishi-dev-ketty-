"use client";

/**
 * The client for time (ADR-058, 058-time): the week grid and publishing,
 * rotations, shift and attendance requests, overtime and validation, the
 * attendance settings and geofence, kiosks and PINs, a business's holidays and
 * weekly days off, and the insights.
 *
 * The same rules as `people.ts`: a read throws, every response is parsed
 * against its contract, and each read asks `useMayRead` with the permissions
 * its route declares (`OPS_READ`), so nobody fires a read they would be
 * refused. Keys follow `["ops", noun, workspaceId, …]`.
 */

import {
  AttendanceRecord,
  AttendanceRequest,
  AttendanceRequestPage,
  AttendanceSettings,
  Kiosk,
  KioskList,
  KioskPairingCode,
  KioskPinState,
  LateEarlyReport,
  MonthlySummary,
  OrgHoliday,
  OrgHolidayList,
  RosterPublication,
  RosterWeek,
  RotationAssignment,
  RotationAssignmentList,
  RotationPattern,
  RotationPatternList,
  ShiftRequest,
  ShiftRequestPage,
  WeeklyOff,
  WeeklyOffList,
  type CreateAttendanceRequestRequest,
  type CreateKioskRequest,
  type CreateOrgHolidayRequest,
  type CreateRotationAssignmentRequest,
  type CreateRotationPatternRequest,
  type CreateShiftRequestRequest,
  type CreateWeeklyOffRequest,
  type ListPage,
  type ListQuery,
  type PublishRosterRequest,
  type PutAttendancePolicyRequest,
  type PutBranchClockSettingsRequest,
  type UpdateOrgHolidayRequest,
  type UpdateRotationPatternRequest,
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
import { useListPage } from "./lists";
import { OPS_READ, read, useMayRead } from "./ops";

export const timeKeys = {
  week: (ws: string | null, propertyId: string, from: string) => ["ops", "roster", ws, "week", propertyId, from] as const,
  patterns: (ws: string | null, propertyId?: string) => ["ops", "rotation-patterns", ws, propertyId ?? "all"] as const,
  assignments: (ws: string | null, includeEnded: boolean) => ["ops", "rotation-assignments", ws, includeEnded] as const,
  settings: (ws: string | null) => ["ops", "attendance-settings", ws] as const,
  kiosks: (ws: string | null) => ["ops", "kiosks", ws] as const,
  pin: (ws: string | null, employeeId: string) => ["ops", "kiosk-pin", ws, employeeId] as const,
  holidays: (ws: string | null) => ["ops", "hr-holidays", ws] as const,
  weeklyOffs: (ws: string | null) => ["ops", "hr-weekly-offs", ws] as const,
  lateEarly: (ws: string | null, from: string, to: string, propertyId?: string) =>
    ["ops", "time-insights", ws, "late-early", from, to, propertyId ?? "all"] as const,
  monthly: (ws: string | null, month: string, propertyId?: string) =>
    ["ops", "time-insights", ws, "monthly", month, propertyId ?? "all"] as const,
};

function refresh(client: QueryClient, ...nouns: string[]): void {
  for (const noun of nouns) void client.invalidateQueries({ queryKey: ["ops", noun] });
}

const params = (entries: Record<string, string | undefined>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(entries)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

// --- The week grid and publishing (AC-TM1, AC-TM14) ------------------------------------------

/** One branch, Monday to Sunday from any day in it, drafts included for whoever manages the roster. */
export function useRosterWeek(ws: string | null, propertyId: string, from: string): UseQueryResult<RosterWeek> {
  const mayRead = useMayRead(OPS_READ.roster);
  return useQuery({
    queryKey: timeKeys.week(ws, propertyId, from),
    queryFn: () => read(`/ops/roster/week${params({ propertyId, from })}`, ws as string, RosterWeek),
    enabled: ws !== null && propertyId !== "" && mayRead,
  });
}

export function usePublishRoster(ws: string | null): UseMutationResult<RosterPublication, Error, PublishRosterRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      RosterPublication.parse(await command<unknown>("/ops/roster/publish", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "roster"),
  });
}

// --- Rotations (AC-TM3) --------------------------------------------------------------

export function useRotationPatterns(ws: string | null, propertyId?: string): UseQueryResult<RotationPatternList> {
  const mayRead = useMayRead(OPS_READ.rotationPatterns);
  return useQuery({
    queryKey: timeKeys.patterns(ws, propertyId),
    queryFn: () => read(`/ops/rotation-patterns${params({ propertyId })}`, ws as string, RotationPatternList),
    enabled: ws !== null && mayRead,
  });
}

export function useCreateRotationPattern(ws: string | null): UseMutationResult<RotationPattern, Error, CreateRotationPatternRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      RotationPattern.parse(await command<unknown>("/ops/rotation-patterns", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "rotation-patterns"),
  });
}

export function useUpdateRotationPattern(
  ws: string | null,
): UseMutationResult<RotationPattern, Error, { id: string; body: UpdateRotationPatternRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      RotationPattern.parse(
        await command<unknown>(`/ops/rotation-patterns/${id}`, { workspaceId: ws as string, body, method: "PATCH" }),
      ),
    onSuccess: () => refresh(client, "rotation-patterns"),
  });
}

export function useRotationAssignments(ws: string | null, includeEnded = false): UseQueryResult<RotationAssignmentList> {
  const mayRead = useMayRead(OPS_READ.rotationAssignments);
  return useQuery({
    queryKey: timeKeys.assignments(ws, includeEnded),
    queryFn: () =>
      read(`/ops/rotation-assignments${params({ includeEnded: includeEnded ? "true" : undefined })}`, ws as string, RotationAssignmentList),
    enabled: ws !== null && mayRead,
  });
}

/** Assigning writes 28 days of drafts at once, so the roster refetches. */
export function useAssignRotation(ws: string | null): UseMutationResult<RotationAssignment, Error, CreateRotationAssignmentRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      RotationAssignment.parse(await command<unknown>("/ops/rotation-assignments", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "rotation-assignments", "rotation-patterns", "roster"),
  });
}

export function useEndRotation(ws: string | null): UseMutationResult<RotationAssignment, Error, { id: string; endsOn: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, endsOn }) =>
      RotationAssignment.parse(
        await command<unknown>(`/ops/rotation-assignments/${id}/end`, { workspaceId: ws as string, body: { endsOn } }),
      ),
    onSuccess: () => refresh(client, "rotation-assignments", "rotation-patterns", "roster"),
  });
}

// --- Shift and swap requests (AC-TM5) ----------------------------------------------------

export function useShiftRequestPage(ws: string | null, query: ListQuery): UseQueryResult<ListPage<ShiftRequest>> {
  return useListPage(ws, "shift-requests", "/ops/shift-requests", query, ShiftRequestPage, OPS_READ.shiftRequests);
}

export function useCreateShiftRequest(ws: string | null): UseMutationResult<ShiftRequest, Error, CreateShiftRequestRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      ShiftRequest.parse(await command<unknown>("/ops/shift-requests", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "shift-requests"),
  });
}

export type ShiftRequestAction = "approve" | "reject" | "cancel" | "accept-for-colleague";

/** A decision replaces shifts, so the roster refetches too. */
export function useShiftRequestAction(
  ws: string | null,
): UseMutationResult<ShiftRequest, Error, { id: string; action: ShiftRequestAction; note?: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action, note }) =>
      ShiftRequest.parse(
        await command<unknown>(`/ops/shift-requests/${id}/${action}`, {
          workspaceId: ws as string,
          body: action === "approve" || action === "reject" ? { note: note?.trim() || null } : undefined,
        }),
      ),
    onSuccess: () => refresh(client, "shift-requests", "roster"),
  });
}

// --- Attendance requests, overtime and validation (AC-TM6, AC-TM8, AC-TM9) ------------------------------

export function useAttendanceRequestPage(ws: string | null, query: ListQuery): UseQueryResult<ListPage<AttendanceRequest>> {
  return useListPage(ws, "attendance-requests", "/ops/attendance-requests", query, AttendanceRequestPage, OPS_READ.attendanceRequests);
}

export function useCreateAttendanceRequest(
  ws: string | null,
): UseMutationResult<AttendanceRequest, Error, CreateAttendanceRequestRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      AttendanceRequest.parse(await command<unknown>("/ops/attendance-requests", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "attendance-requests"),
  });
}

/** Approving writes or corrects a record, so the attendance lists refetch. */
export function useDecideAttendanceRequest(
  ws: string | null,
): UseMutationResult<AttendanceRequest, Error, { id: string; decision: "approve" | "reject"; note?: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, note }) =>
      AttendanceRequest.parse(
        await command<unknown>(`/ops/attendance-requests/${id}/${decision}`, {
          workspaceId: ws as string,
          body: { note: note?.trim() || null },
        }),
      ),
    onSuccess: () => refresh(client, "attendance-requests", "attendance"),
  });
}

export function useDecideOvertime(
  ws: string | null,
): UseMutationResult<AttendanceRecord, Error, { id: string; approvedMinutes: number; note?: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approvedMinutes, note }) =>
      AttendanceRecord.parse(
        await command<unknown>(`/ops/attendance/${id}/overtime`, {
          workspaceId: ws as string,
          body: { approvedMinutes, note: note?.trim() || null },
        }),
      ),
    onSuccess: () => refresh(client, "attendance"),
  });
}

export function useValidateAttendance(ws: string | null): UseMutationResult<AttendanceRecord, Error, { id: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) =>
      AttendanceRecord.parse(await command<unknown>(`/ops/attendance/${id}/validate`, { workspaceId: ws as string })),
    onSuccess: () => refresh(client, "attendance"),
  });
}

// --- The attendance settings and the geofence (AC-TM4, AC-TM7 to AC-TM9) -----------------------------

export function useAttendanceSettings(ws: string | null): UseQueryResult<AttendanceSettings> {
  const mayRead = useMayRead(OPS_READ.attendanceSettings);
  return useQuery({
    queryKey: timeKeys.settings(ws),
    queryFn: () => read("/ops/attendance/policies", ws as string, AttendanceSettings),
    enabled: ws !== null && mayRead,
  });
}

export function usePutPolicy(ws: string | null): UseMutationResult<AttendanceSettings, Error, PutAttendancePolicyRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      AttendanceSettings.parse(
        await command<unknown>("/ops/attendance/policies", { workspaceId: ws as string, body, method: "PUT" }),
      ),
    onSuccess: (data) => client.setQueryData(timeKeys.settings(ws), data),
  });
}

export function usePutClockSettings(
  ws: string | null,
): UseMutationResult<AttendanceSettings, Error, { propertyId: string; body: PutBranchClockSettingsRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ propertyId, body }) =>
      AttendanceSettings.parse(
        await command<unknown>(`/ops/attendance/clock-settings/${propertyId}`, { workspaceId: ws as string, body, method: "PUT" }),
      ),
    onSuccess: (data) => client.setQueryData(timeKeys.settings(ws), data),
  });
}

// --- Kiosks and PINs (AC-TM10, AC-TM11) ----------------------------------------------------

export function useKiosks(ws: string | null): UseQueryResult<KioskList> {
  const mayRead = useMayRead(OPS_READ.kiosks);
  return useQuery({
    queryKey: timeKeys.kiosks(ws),
    queryFn: () => read("/ops/attendance/kiosks", ws as string, KioskList),
    enabled: ws !== null && mayRead,
    // A pairing kiosk turns active when the tablet pairs.
    refetchInterval: 15_000,
  });
}

export function useCreateKiosk(ws: string | null): UseMutationResult<KioskPairingCode, Error, CreateKioskRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      KioskPairingCode.parse(await command<unknown>("/ops/attendance/kiosks", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "kiosks"),
  });
}

export function useKioskPairingCode(ws: string | null): UseMutationResult<KioskPairingCode, Error, { id: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) =>
      KioskPairingCode.parse(await command<unknown>(`/ops/attendance/kiosks/${id}/pairing-code`, { workspaceId: ws as string })),
    onSuccess: () => refresh(client, "kiosks"),
  });
}

export function useRevokeKiosk(ws: string | null): UseMutationResult<Kiosk, Error, { id: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) =>
      Kiosk.parse(await command<unknown>(`/ops/attendance/kiosks/${id}/revoke`, { workspaceId: ws as string })),
    onSuccess: () => refresh(client, "kiosks"),
  });
}

export function useUnlockPin(ws: string | null): UseMutationResult<void, Error, { kioskId: string; employeeId: string }> {
  return useMutation({
    mutationFn: async ({ kioskId, employeeId }) => {
      await command<unknown>(`/ops/attendance/kiosks/${kioskId}/unlock-pin`, { workspaceId: ws as string, body: { employeeId } });
    },
  });
}

export function usePinState(ws: string | null, employeeId: string | null): UseQueryResult<KioskPinState> {
  const mayRead = useMayRead(OPS_READ.kioskPin);
  return useQuery({
    queryKey: timeKeys.pin(ws, employeeId ?? ""),
    queryFn: () => read(`/ops/employees/${employeeId}/kiosk-pin`, ws as string, KioskPinState),
    enabled: ws !== null && employeeId !== null && mayRead,
  });
}

export function useSetPin(ws: string | null): UseMutationResult<KioskPinState, Error, { employeeId: string; pin: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, pin }) =>
      KioskPinState.parse(
        await command<unknown>(`/ops/employees/${employeeId}/kiosk-pin`, { workspaceId: ws as string, body: { pin }, method: "PUT" }),
      ),
    onSuccess: (data, { employeeId }) => client.setQueryData(timeKeys.pin(ws, employeeId), data),
  });
}

// --- Holidays and weekly days off (AC-TM12) ---------------------------------------------------

export function useHolidays(ws: string | null): UseQueryResult<OrgHolidayList> {
  const mayRead = useMayRead(OPS_READ.hrHolidays);
  return useQuery({
    queryKey: timeKeys.holidays(ws),
    queryFn: () => read("/ops/hr/holidays", ws as string, OrgHolidayList),
    enabled: ws !== null && mayRead,
  });
}

export function useSaveHoliday(
  ws: string | null,
): UseMutationResult<OrgHoliday, Error, { id?: string; create?: CreateOrgHolidayRequest; update?: UpdateOrgHolidayRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, create, update }) =>
      OrgHoliday.parse(
        await command<unknown>(id ? `/ops/hr/holidays/${id}` : "/ops/hr/holidays", {
          workspaceId: ws as string,
          body: id ? update : create,
          method: id ? "PATCH" : "POST",
        }),
      ),
    onSuccess: () => refresh(client, "hr-holidays"),
  });
}

export function useDeleteHoliday(ws: string | null): UseMutationResult<void, Error, { id: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      await command<unknown>(`/ops/hr/holidays/${id}`, { workspaceId: ws as string, method: "DELETE" });
    },
    onSuccess: () => refresh(client, "hr-holidays"),
  });
}

export function useWeeklyOffs(ws: string | null): UseQueryResult<WeeklyOffList> {
  const mayRead = useMayRead(OPS_READ.hrHolidays);
  return useQuery({
    queryKey: timeKeys.weeklyOffs(ws),
    queryFn: () => read("/ops/hr/weekly-offs", ws as string, WeeklyOffList),
    enabled: ws !== null && mayRead,
  });
}

export function useSaveWeeklyOff(
  ws: string | null,
): UseMutationResult<WeeklyOff, Error, { id?: string; create?: CreateWeeklyOffRequest; weeks?: number[] }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, create, weeks }) =>
      WeeklyOff.parse(
        await command<unknown>(id ? `/ops/hr/weekly-offs/${id}` : "/ops/hr/weekly-offs", {
          workspaceId: ws as string,
          body: id ? { weeks: weeks ?? [] } : create,
          method: id ? "PATCH" : "POST",
        }),
      ),
    onSuccess: () => refresh(client, "hr-weekly-offs"),
  });
}

export function useDeleteWeeklyOff(ws: string | null): UseMutationResult<void, Error, { id: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => {
      await command<unknown>(`/ops/hr/weekly-offs/${id}`, { workspaceId: ws as string, method: "DELETE" });
    },
    onSuccess: () => refresh(client, "hr-weekly-offs"),
  });
}

// --- Insights (AC-TM13): people.manage, in name order ---------------------------------------------

export function useLateEarly(ws: string | null, from: string, to: string, propertyId?: string): UseQueryResult<LateEarlyReport> {
  const mayRead = useMayRead(OPS_READ.timeInsights);
  return useQuery({
    queryKey: timeKeys.lateEarly(ws, from, to, propertyId),
    queryFn: () => read(`/ops/attendance/insights/late-early${params({ from, to, propertyId })}`, ws as string, LateEarlyReport),
    enabled: ws !== null && mayRead && from !== "" && to !== "" && from <= to,
  });
}

export function useMonthlySummary(ws: string | null, month: string, propertyId?: string): UseQueryResult<MonthlySummary> {
  const mayRead = useMayRead(OPS_READ.timeInsights);
  return useQuery({
    queryKey: timeKeys.monthly(ws, month, propertyId),
    queryFn: () => read(`/ops/attendance/insights/monthly${params({ month, propertyId })}`, ws as string, MonthlySummary),
    enabled: ws !== null && mayRead && /^\d{4}-\d{2}$/.test(month),
  });
}
