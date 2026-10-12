"use client";

/**
 * The client for a person's own work: `/api/v1/me/work` (ADR-058,
 * 058-self-service).
 *
 * These routes were built for the staff phone app and nothing on the web read
 * them, so somebody who signs in to this app to work a desk could clock a
 * colleague in and not themselves, and saw nobody's payslip, their own
 * included. My work is the same routes on a desk machine.
 *
 * THEY ARE NOT `/ops` ROUTES and are not called like them. The guard is the
 * session alone: the file's id is in the path and the server answers 404 for
 * any file that is not the caller's (index contract 10), so no workspace is
 * named and no branch narrows them. `mine` below is `read` in `ops.ts` without
 * the two headers, and `ask` is `command` without them.
 *
 * Keys are `["me-work", noun, employeeId, …]`, apart from the `["ops", …]`
 * keys: an office command refetches by that prefix, and a person's own page is
 * not the office's.
 */

import {
  KioskPinState,
  LeaveRequest,
  MyAttendance,
  MyLeaveAllocationList,
  MyPayClaimList,
  MyChecklists,
  MyLeaveBalances,
  MyLeaveRequestList,
  MyLeaveTypeList,
  MyLoanList,
  MyMonthlySummary,
  MyPayslipList,
  MyRoster,
  MyWorkFileList,
  PhoneClockResult,
  type AttendanceRequest,
  type CreateMyAttendanceRequestRequest,
  type CreateMyLeaveAllocationRequest,
  type CreateMyLeaveRequestRequest,
  type CreateMyPayClaimRequest,
  type LeaveAllocationRequest,
  type MyUpload,
  type MyWorkFile,
  type PayClaim,
  type PhoneClockRequest,
} from "@injishi/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { API_BASE, ApiError, REQUEST_TIMEOUT_MS, humanMessage, readRefusal, upload } from "./api";
import { newIdempotencyKey } from "./ops";

interface Parser<T> {
  parse: (value: unknown) => T;
}

/** A read of the caller's own file, checked against its contract. Throws, as every operator read does. */
async function mine<T>(path: string, schema: Parser<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, { credentials: "include", signal: controller.signal });
    if (!res.ok) throw new ApiError(res.status, "We couldn't load that.");
    return schema.parse(await res.json());
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "We couldn't reach the server. Try again.");
  } finally {
    clearTimeout(timer);
  }
}

/** Something the person asks or does on their own file. A refusal arrives in the server's words. */
async function ask<T>(path: string, body?: unknown, method: "POST" | "PUT" = "POST", idempotencyKey?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      method,
      credentials: "include",
      // Only with a body: Fastify refuses an empty JSON body before any route runs.
      headers:
        body === undefined
          ? undefined
          : { "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw await readRefusal(res);
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, humanMessage(0, null));
  } finally {
    clearTimeout(timer);
  }
}

export const myWorkKeys = {
  all: ["me-work"] as const,
  file: (id: string | null) => ["me-work", "file", id] as const,
  roster: (id: string | null, from: string, to: string) => ["me-work", "roster", id, from, to] as const,
  attendance: (id: string | null, from: string, to: string) => ["me-work", "attendance", id, from, to] as const,
  month: (id: string | null, month: string) => ["me-work", "month", id, month] as const,
  leaveTypes: (id: string | null) => ["me-work", "leave-types", id] as const,
  balances: (id: string | null) => ["me-work", "leave-balances", id] as const,
  leave: (id: string | null) => ["me-work", "leave", id] as const,
  payslips: (id: string | null) => ["me-work", "payslips", id] as const,
  checklists: (id: string | null) => ["me-work", "checklists", id] as const,
  pin: (id: string | null) => ["me-work", "kiosk-pin", id] as const,
  loans: (id: string | null) => ["me-work", "loans", id] as const,
  claims: (id: string | null) => ["me-work", "claims", id] as const,
  allocations: (id: string | null) => ["me-work", "leave-allocations", id] as const,
};

// --- Reads ---------------------------------------------------------------------

/**
 * The caller's file at this business as `/me/work` lists it: who they are
 * here, and the clock in they have open, if any. Read again every minute, so a
 * clock in made at the kiosk or by the desk shows without a reload.
 */
export function useMyWorkFile(employeeId: string | null): UseQueryResult<MyWorkFile | null> {
  return useQuery({
    queryKey: myWorkKeys.file(employeeId),
    queryFn: async () => (await mine("/me/work", MyWorkFileList)).files.find((f) => f.employeeId === employeeId) ?? null,
    enabled: employeeId !== null,
    refetchInterval: 60_000,
  });
}

/** Published shifts only: a draft is the roster's business until it is published (AC-TM2). */
export function useMyRoster(employeeId: string | null, from: string, to: string): UseQueryResult<MyRoster> {
  return useQuery({
    queryKey: myWorkKeys.roster(employeeId, from, to),
    queryFn: () => mine(`/me/work/${employeeId}/roster?from=${from}&to=${to}`, MyRoster),
    enabled: employeeId !== null,
  });
}

/** The person's own records and the corrections they asked for, at most 31 days. */
export function useMyAttendance(employeeId: string | null, from: string, to: string): UseQueryResult<MyAttendance> {
  return useQuery({
    queryKey: myWorkKeys.attendance(employeeId, from, to),
    queryFn: () => mine(`/me/work/${employeeId}/attendance?from=${from}&to=${to}`, MyAttendance),
    enabled: employeeId !== null,
  });
}

/** One month in figures: the person's own, never a colleague's (AC-TM13). */
export function useMyMonth(employeeId: string | null, month: string): UseQueryResult<MyMonthlySummary> {
  return useQuery({
    queryKey: myWorkKeys.month(employeeId, month),
    queryFn: () => mine(`/me/work/${employeeId}/attendance/summary?month=${month}`, MyMonthlySummary),
    enabled: employeeId !== null,
  });
}

/** The kinds of leave this person may ask for today: the server has left out the ones they may not. */
export function useMyLeaveTypes(employeeId: string | null): UseQueryResult<MyLeaveTypeList> {
  return useQuery({
    queryKey: myWorkKeys.leaveTypes(employeeId),
    queryFn: () => mine(`/me/work/${employeeId}/leave/types`, MyLeaveTypeList),
    enabled: employeeId !== null,
  });
}

export function useMyLeaveBalances(employeeId: string | null): UseQueryResult<MyLeaveBalances> {
  return useQuery({
    queryKey: myWorkKeys.balances(employeeId),
    queryFn: () => mine(`/me/work/${employeeId}/leave/balances`, MyLeaveBalances),
    enabled: employeeId !== null,
  });
}

export function useMyLeaveRequests(employeeId: string | null): UseQueryResult<MyLeaveRequestList> {
  return useQuery({
    queryKey: myWorkKeys.leave(employeeId),
    queryFn: () => mine(`/me/work/${employeeId}/leave/requests`, MyLeaveRequestList),
    enabled: employeeId !== null,
  });
}

/** Confirmed payslips only: a draft is the office's until it is confirmed (AC-PY9). */
export function useMyPayslips(employeeId: string | null): UseQueryResult<MyPayslipList> {
  return useQuery({
    queryKey: myWorkKeys.payslips(employeeId),
    queryFn: () => mine(`/me/work/${employeeId}/payslips`, MyPayslipList),
    enabled: employeeId !== null,
  });
}

export function useMyLoans(employeeId: string | null): UseQueryResult<MyLoanList> {
  return useQuery({
    queryKey: myWorkKeys.loans(employeeId),
    queryFn: () => mine(`/me/work/${employeeId}/loans`, MyLoanList),
    enabled: employeeId !== null,
  });
}

/** The person's own joining or leaving list: every task of it, theirs to tick marked. */
export function useMyChecklists(employeeId: string | null): UseQueryResult<MyChecklists> {
  return useQuery({
    queryKey: myWorkKeys.checklists(employeeId),
    queryFn: () => mine(`/me/work/${employeeId}/checklists`, MyChecklists),
    enabled: employeeId !== null,
  });
}

/** Whether the person has a kiosk PIN, and since when. Never the PIN: nothing keeps it. */
export function useMyKioskPin(employeeId: string | null): UseQueryResult<KioskPinState> {
  return useQuery({
    queryKey: myWorkKeys.pin(employeeId),
    queryFn: () => mine(`/me/work/${employeeId}/kiosk-pin`, KioskPinState),
    enabled: employeeId !== null,
  });
}

// --- Commands ------------------------------------------------------------------

/** How long to wait for the browser to say where it is before clocking without it. */
const LOCATION_WAIT_MS = 6_000;

/**
 * Where this device says it is, or nothing.
 *
 * The server measures a clock in against the branch's geofence and holds one
 * it cannot place for a supervisor to validate (AC-TM9). So "no position" is an
 * answer, not a failure: a desk machine with no GPS, or a person who said no
 * to the prompt, still clocks in, and reads why it is waiting.
 */
function whereAmI(): Promise<PhoneClockRequest> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve({});
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({}), LOCATION_WAIT_MS + 500);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timer);
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyM: Math.round(position.coords.accuracy),
        });
      },
      () => {
        clearTimeout(timer);
        resolve({});
      },
      { enableHighAccuracy: true, timeout: LOCATION_WAIT_MS, maximumAge: 30_000 },
    );
  });
}

/** Clock in or out. The answer says whether it stands or waits for a supervisor, and why. */
export function useMyClock(employeeId: string | null): UseMutationResult<PhoneClockResult, Error, "in" | "out"> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (direction) =>
      PhoneClockResult.parse(await ask(`/me/work/${employeeId}/clock-${direction}`, await whereAmI())),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: myWorkKeys.all });
      // The desk's sheet shows this punch too, when this person also works it.
      void client.invalidateQueries({ queryKey: ["ops", "attendance"] });
    },
  });
}

export function useAskLeave(employeeId: string | null): UseMutationResult<LeaveRequest, Error, CreateMyLeaveRequestRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) => LeaveRequest.parse(await ask(`/me/work/${employeeId}/leave/requests`, body)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: myWorkKeys.all });
      void client.invalidateQueries({ queryKey: ["ops", "leave-requests"] });
    },
  });
}

export function useCancelMyLeave(employeeId: string | null): UseMutationResult<LeaveRequest, Error, { id: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }) => LeaveRequest.parse(await ask(`/me/work/${employeeId}/leave/requests/${id}/cancel`)),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: myWorkKeys.all });
      void client.invalidateQueries({ queryKey: ["ops", "leave-requests"] });
    },
  });
}

/** Tick a task that is the person's own to do, or untick it. The office's tasks are refused in words. */
export function useTickMyTask(employeeId: string | null): UseMutationResult<MyChecklists, Error, { taskId: string; done: boolean }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, done }) =>
      MyChecklists.parse(await ask(`/me/work/${employeeId}/checklists/tasks/${taskId}/${done ? "done" : "undo"}`)),
    onSuccess: (answer) => {
      client.setQueryData(myWorkKeys.checklists(employeeId), answer);
      void client.invalidateQueries({ queryKey: ["ops", "checklists"] });
    },
  });
}

/** Change one's own kiosk PIN. The current one proves who is asking; the server refuses a wrong one in words. */
export function useChangeMyKioskPin(employeeId: string | null): UseMutationResult<KioskPinState, Error, { currentPin: string; pin: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) => KioskPinState.parse(await ask(`/me/work/${employeeId}/kiosk-pin`, body, "PUT")),
    onSuccess: (answer) => client.setQueryData(myWorkKeys.pin(employeeId), answer),
  });
}

// --- Asking for money back, and for extra days ------------------------------------------------

/** What the person has claimed back: each claim, and the office's answer to it (AC-PY9). */
export function useMyClaims(employeeId: string | null): UseQueryResult<MyPayClaimList> {
  return useQuery({
    queryKey: myWorkKeys.claims(employeeId),
    queryFn: () => mine(`/me/work/${employeeId}/claims`, MyPayClaimList),
    enabled: employeeId !== null,
  });
}

/**
 * Ask for money back, or for unused leave to be paid out. The key makes a
 * second press of Send the same claim, never a second one.
 */
export function useAskClaim(employeeId: string | null): UseMutationResult<PayClaim, Error, CreateMyPayClaimRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body) => ask<PayClaim>(`/me/work/${employeeId}/claims`, body, "POST", newIdempotencyKey()),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: myWorkKeys.claims(employeeId) });
      void client.invalidateQueries({ queryKey: ["ops", "pay-claims"] });
    },
  });
}

/** Take back a claim still waiting. A decided one is the office's to undo. */
export function useCancelMyClaim(employeeId: string | null): UseMutationResult<PayClaim, Error, { id: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => ask<PayClaim>(`/me/work/${employeeId}/claims/${id}/cancel`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: myWorkKeys.claims(employeeId) });
      void client.invalidateQueries({ queryKey: ["ops", "pay-claims"] });
    },
  });
}

/** The extra days the person has asked for, each with its answer (058-leave AC-LV7). */
export function useMyAllocations(employeeId: string | null): UseQueryResult<MyLeaveAllocationList> {
  return useQuery({
    queryKey: myWorkKeys.allocations(employeeId),
    queryFn: () => mine(`/me/work/${employeeId}/leave/allocation-requests`, MyLeaveAllocationList),
    enabled: employeeId !== null,
  });
}

/** Ask for days on top of what a kind of leave gives. Nothing is added until it is approved. */
export function useAskExtraDays(
  employeeId: string | null,
): UseMutationResult<LeaveAllocationRequest, Error, CreateMyLeaveAllocationRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body) => ask<LeaveAllocationRequest>(`/me/work/${employeeId}/leave/allocation-requests`, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: myWorkKeys.allocations(employeeId) });
      void client.invalidateQueries({ queryKey: ["ops", "leave-allocations"] });
    },
  });
}

export function useCancelMyAllocation(employeeId: string | null): UseMutationResult<LeaveAllocationRequest, Error, { id: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => ask<LeaveAllocationRequest>(`/me/work/${employeeId}/leave/allocation-requests/${id}/cancel`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: myWorkKeys.allocations(employeeId) });
      void client.invalidateQueries({ queryKey: myWorkKeys.balances(employeeId) });
      void client.invalidateQueries({ queryKey: ["ops", "leave-allocations"] });
    },
  });
}

/**
 * Send a sick note, or whatever else a leave type asks for, ahead of the
 * request that names it (058-leave AC-LV6). The server reads what the file is
 * from its first bytes, never from its name.
 */
export function uploadMyNote(employeeId: string, file: File): Promise<MyUpload> {
  return upload<MyUpload>(`/me/work/${employeeId}/files`, file);
}

/** Ask for a day's times to be put right, or for a day that was never recorded (AC-TM6). */
export function useAskAttendanceFix(
  employeeId: string | null,
): UseMutationResult<AttendanceRequest, Error, CreateMyAttendanceRequestRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body) => ask<AttendanceRequest>(`/me/work/${employeeId}/attendance/requests`, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: myWorkKeys.all });
      void client.invalidateQueries({ queryKey: ["ops", "attendance-requests"] });
    },
  });
}

/**
 * Save one of the person's own payslips. The route is session guarded, so the
 * file is fetched with the cookie and handed to the browser as a download; a
 * plain link would open a tab that the API, on another origin, answers with
 * no page around it.
 */
export async function downloadMyPayslip(employeeId: string, payslipId: string, period: string): Promise<void> {
  const controller = new AbortController();
  // A PDF is drawn on request and may take longer than a read.
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS * 3);
  try {
    const res = await fetch(`${API_BASE}/api/v1/me/work/${employeeId}/payslips/${payslipId}/pdf`, {
      credentials: "include",
      signal: controller.signal,
    });
    if (!res.ok) throw await readRefusal(res);
    const named = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1];
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = named ?? `payslip-${period}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, humanMessage(0, null));
  } finally {
    clearTimeout(timer);
  }
}
