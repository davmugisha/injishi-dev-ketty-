"use client";

/**
 * The client for the people file's routes (ADR-058, 058-people-file): the
 * photo, pay accounts, notes, documents and requests, policies, staff
 * announcements, discipline, the org chart, and the HR catalogs and settings.
 *
 * The same rules as `people.ts`: every read is parsed against its contract and
 * asks `useMayRead` with exactly the permissions its route declares
 * (`OPS_READ`), so nobody fires the refused read that would invalidate
 * `me.workspaces`. Nothing here decides a permission.
 *
 * **Files go up, then attach by key.** `uploadHrFile` sends the bytes to
 * `POST /ops/hr/files` with what they are for, and the write that hangs them on
 * a file, a note or a policy carries only the key it got back. A private file is
 * never a URL in the page: `openFileLink` asks the server for a five minute link
 * at the moment of the click, and the server records the fetch.
 */

import {
  CreateDisciplinaryActionResponse,
  DisciplinaryActionList,
  DocumentRequestList,
  EmployeeDocument,
  EmployeeDocumentList,
  EmployeeNote,
  EmployeeNoteList,
  Employee,
  FileLink,
  HrCatalogItem,
  HrCatalogList,
  HrSettings,
  HrUpload,
  OrgChart,
  PayAccount,
  PayAccountList,
  StaffAnnouncement,
  StaffAnnouncementList,
  StaffPolicy,
  StaffPolicyList,
  type CreateDisciplinaryActionRequest,
  type CreateDocumentRequestRequest,
  type CreateEmployeeNoteRequest,
  type CreateHrCatalogItemRequest,
  type CreatePayAccountRequest,
  type CreateStaffAnnouncementRequest,
  type CreateStaffPolicyRequest,
  type DecideDocumentRequest,
  type DocumentStatus,
  type HrCatalogKind,
  type HrUploadPurpose,
  type UpdateDocumentDatesRequest,
  type UpdateHrCatalogItemRequest,
  type UpdateHrSettingsRequest,
  type UpdatePayAccountRequest,
  type UpdateStaffAnnouncementRequest,
  type UpdateStaffPolicyRequest,
  type UploadEmployeeDocumentRequest,
} from "@injishi/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { command, upload } from "./api";
import { OPS_READ, read, useMayRead } from "./ops";

export const peopleFileKeys = {
  photo: (ws: string | null, id: string) => ["ops", "employee-photo", ws, id] as const,
  payAccounts: (ws: string | null, id: string) => ["ops", "pay-accounts", ws, id] as const,
  notes: (ws: string | null, id: string) => ["ops", "employee-notes", ws, id] as const,
  personDocuments: (ws: string | null, id: string) => ["ops", "documents", ws, "person", id] as const,
  documents: (ws: string | null, status: DocumentStatus | "all") => ["ops", "documents", ws, "all", status] as const,
  requests: (ws: string | null) => ["ops", "document-requests", ws] as const,
  policies: (ws: string | null) => ["ops", "policies", ws] as const,
  announcements: (ws: string | null) => ["ops", "staff-announcements", ws] as const,
  discipline: (ws: string | null, employeeId: string | null) => ["ops", "discipline", ws, employeeId ?? "all"] as const,
  orgChart: (ws: string | null) => ["ops", "org-chart", ws] as const,
  catalog: (ws: string | null, kind: HrCatalogKind) => ["ops", "hr-catalog", ws, kind] as const,
  settings: (ws: string | null) => ["ops", "hr-settings", ws] as const,
};

function refresh(client: QueryClient, ...nouns: string[]): void {
  for (const noun of nouns) void client.invalidateQueries({ queryKey: ["ops", noun] });
}

// --- Files ----------------------------------------------------------------------

/** Send one file up, as what it is for; answers the key to attach it by. */
export function uploadHrFile(ws: string, purpose: HrUploadPurpose, file: File): Promise<HrUpload> {
  return upload<unknown>("/ops/hr/files", file, { workspaceId: ws, fields: { purpose } }).then((r) => HrUpload.parse(r));
}

/**
 * Open a private file in a new tab through a fresh five minute link. The tab is
 * opened before the read so a browser does not treat it as an unasked popup,
 * and cut from this page before it is pointed anywhere.
 */
export async function openFileLink(ws: string, path: string): Promise<void> {
  // Not `noopener` in the features: with it `window.open` answers null, and the
  // link would have nowhere to go but this page.
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  try {
    const link = await read(path, ws, FileLink);
    if (tab) tab.location.href = link.url;
    else window.location.assign(link.url);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

// --- The photo (AC-PF1) ---------------------------------------------------------------

/** A short lived link to the photo, when the file has one. Refetched before it lapses. */
export function useEmployeePhoto(ws: string | null, id: string, hasPhoto: boolean): UseQueryResult<FileLink> {
  const mayRead = useMayRead(OPS_READ.employees);
  return useQuery({
    queryKey: peopleFileKeys.photo(ws, id),
    queryFn: () => read(`/ops/employees/${id}/photo`, ws as string, FileLink),
    enabled: ws !== null && mayRead && hasPhoto,
    // The link lives five minutes; ask again well before it lapses.
    staleTime: 3 * 60_000,
    refetchInterval: 4 * 60_000,
  });
}

export function useSetPhoto(ws: string | null): UseMutationResult<Employee, Error, { id: string; objectKey: string | null }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, objectKey }) =>
      Employee.parse(
        await command<unknown>(`/ops/employees/${id}/photo`, { workspaceId: ws as string, body: { objectKey }, method: "PUT" }),
      ),
    onSuccess: () => refresh(client, "employees", "employee", "employee-photo", "org-chart"),
  });
}

// --- Pay accounts (AC-PF3) -------------------------------------------------------------

export function usePayAccounts(ws: string | null, id: string): UseQueryResult<PayAccountList> {
  const mayRead = useMayRead(OPS_READ.payAccounts);
  return useQuery({
    queryKey: peopleFileKeys.payAccounts(ws, id),
    queryFn: () => read(`/ops/employees/${id}/pay-accounts`, ws as string, PayAccountList),
    enabled: ws !== null && mayRead,
  });
}

export function useAddPayAccount(
  ws: string | null,
): UseMutationResult<PayAccount, Error, { id: string; body: CreatePayAccountRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      PayAccount.parse(await command<unknown>(`/ops/employees/${id}/pay-accounts`, { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "pay-accounts"),
  });
}

export function useChangePayAccount(
  ws: string | null,
): UseMutationResult<PayAccount, Error, { accountId: string; body: UpdatePayAccountRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ accountId, body }) =>
      PayAccount.parse(
        await command<unknown>(`/ops/pay-accounts/${accountId}`, { workspaceId: ws as string, body, method: "PATCH" }),
      ),
    onSuccess: () => refresh(client, "pay-accounts"),
  });
}

// --- Notes (AC-PF6) -----------------------------------------------------------------------

export function useEmployeeNotes(ws: string | null, id: string): UseQueryResult<EmployeeNoteList> {
  const mayRead = useMayRead(OPS_READ.employeeNotes);
  return useQuery({
    queryKey: peopleFileKeys.notes(ws, id),
    queryFn: () => read(`/ops/employees/${id}/notes`, ws as string, EmployeeNoteList),
    enabled: ws !== null && mayRead,
  });
}

export function useAddNote(
  ws: string | null,
): UseMutationResult<EmployeeNote, Error, { id: string; body: CreateEmployeeNoteRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      EmployeeNote.parse(await command<unknown>(`/ops/employees/${id}/notes`, { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "employee-notes"),
  });
}

// --- Documents and requests (AC-PF4, AC-PF5) -------------------------------------------------

export function usePersonDocuments(ws: string | null, id: string): UseQueryResult<EmployeeDocumentList> {
  const mayRead = useMayRead(OPS_READ.documents);
  return useQuery({
    queryKey: peopleFileKeys.personDocuments(ws, id),
    queryFn: () => read(`/ops/employees/${id}/documents`, ws as string, EmployeeDocumentList),
    enabled: ws !== null && mayRead,
  });
}

/** The Documents lens: every document of the caller's branches, or those at one status. */
export function useDocuments(ws: string | null, status: DocumentStatus | "all"): UseQueryResult<EmployeeDocumentList> {
  const mayRead = useMayRead(OPS_READ.documents);
  return useQuery({
    queryKey: peopleFileKeys.documents(ws, status),
    queryFn: () =>
      read(`/ops/documents${status === "all" ? "" : `?status=${status}`}`, ws as string, EmployeeDocumentList),
    enabled: ws !== null && mayRead,
  });
}

export function useDocumentRequests(ws: string | null): UseQueryResult<DocumentRequestList> {
  const mayRead = useMayRead(OPS_READ.documentRequests);
  return useQuery({
    queryKey: peopleFileKeys.requests(ws),
    queryFn: () => read("/ops/document-requests", ws as string, DocumentRequestList),
    enabled: ws !== null && mayRead,
  });
}

export function useRequestDocuments(
  ws: string | null,
): UseMutationResult<DocumentRequestList, Error, CreateDocumentRequestRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      DocumentRequestList.parse(await command<unknown>("/ops/document-requests", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "document-requests", "documents"),
  });
}

export function useUploadDocument(
  ws: string | null,
): UseMutationResult<EmployeeDocument, Error, { id: string; body: UploadEmployeeDocumentRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      EmployeeDocument.parse(await command<unknown>(`/ops/employees/${id}/documents`, { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "documents", "document-requests"),
  });
}

export function useDecideDocument(
  ws: string | null,
): UseMutationResult<EmployeeDocument, Error, { documentId: string; body: DecideDocumentRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, body }) =>
      EmployeeDocument.parse(
        await command<unknown>(`/ops/documents/${documentId}/decide`, { workspaceId: ws as string, body }),
      ),
    onSuccess: () => refresh(client, "documents", "document-requests"),
  });
}

export function useDocumentDates(
  ws: string | null,
): UseMutationResult<EmployeeDocument, Error, { documentId: string; body: UpdateDocumentDatesRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, body }) =>
      EmployeeDocument.parse(
        await command<unknown>(`/ops/documents/${documentId}`, { workspaceId: ws as string, body, method: "PATCH" }),
      ),
    onSuccess: () => refresh(client, "documents"),
  });
}

// --- Policies and announcements (AC-PF7, AC-PF9) ---------------------------------------------

export function usePolicies(ws: string | null): UseQueryResult<StaffPolicyList> {
  const mayRead = useMayRead(OPS_READ.policies);
  return useQuery({
    queryKey: peopleFileKeys.policies(ws),
    queryFn: () => read("/ops/policies", ws as string, StaffPolicyList),
    enabled: ws !== null && mayRead,
  });
}

export function useCreatePolicy(ws: string | null): UseMutationResult<StaffPolicy, Error, CreateStaffPolicyRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      StaffPolicy.parse(await command<unknown>("/ops/policies", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "policies"),
  });
}

export function useUpdatePolicy(
  ws: string | null,
): UseMutationResult<StaffPolicy, Error, { id: string; body: UpdateStaffPolicyRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      StaffPolicy.parse(await command<unknown>(`/ops/policies/${id}`, { workspaceId: ws as string, body, method: "PATCH" })),
    onSuccess: () => refresh(client, "policies"),
  });
}

export function useAnnouncements(ws: string | null): UseQueryResult<StaffAnnouncementList> {
  const mayRead = useMayRead(OPS_READ.staffAnnouncements);
  return useQuery({
    queryKey: peopleFileKeys.announcements(ws),
    queryFn: () => read("/ops/staff-announcements", ws as string, StaffAnnouncementList),
    enabled: ws !== null && mayRead,
  });
}

export function useCreateAnnouncement(
  ws: string | null,
): UseMutationResult<StaffAnnouncement, Error, CreateStaffAnnouncementRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      StaffAnnouncement.parse(await command<unknown>("/ops/staff-announcements", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "staff-announcements"),
  });
}

export function useUpdateAnnouncement(
  ws: string | null,
): UseMutationResult<StaffAnnouncement, Error, { id: string; body: UpdateStaffAnnouncementRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      StaffAnnouncement.parse(
        await command<unknown>(`/ops/staff-announcements/${id}`, { workspaceId: ws as string, body, method: "PATCH" }),
      ),
    onSuccess: () => refresh(client, "staff-announcements"),
  });
}

// --- Discipline (AC-PF8) ---------------------------------------------------------------------

/** Every record of the caller's branches, or one person's. */
export function useDiscipline(ws: string | null, employeeId: string | null): UseQueryResult<DisciplinaryActionList> {
  const mayRead = useMayRead(OPS_READ.discipline);
  return useQuery({
    queryKey: peopleFileKeys.discipline(ws, employeeId),
    queryFn: () =>
      read(
        `/ops/disciplinary-actions${employeeId ? `?employeeId=${employeeId}` : ""}`,
        ws as string,
        DisciplinaryActionList,
      ),
    enabled: ws !== null && mayRead,
  });
}

export function useRecordDiscipline(
  ws: string | null,
): UseMutationResult<CreateDisciplinaryActionResponse, Error, CreateDisciplinaryActionRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      CreateDisciplinaryActionResponse.parse(
        await command<unknown>("/ops/disciplinary-actions", { workspaceId: ws as string, body }),
      ),
    onSuccess: () => refresh(client, "discipline"),
  });
}

// --- The org chart (AC-PF10) -----------------------------------------------------------------

export function useOrgChart(ws: string | null): UseQueryResult<OrgChart> {
  const mayRead = useMayRead(OPS_READ.orgChart);
  return useQuery({
    queryKey: peopleFileKeys.orgChart(ws),
    queryFn: () => read("/ops/org-chart", ws as string, OrgChart),
    enabled: ws !== null && mayRead,
  });
}

// --- Catalogs and settings (AC-PF11, AC-PF12) -----------------------------------------------

export function useHrCatalog(ws: string | null, kind: HrCatalogKind): UseQueryResult<HrCatalogList> {
  const mayRead = useMayRead(OPS_READ.hrCatalog);
  return useQuery({
    queryKey: peopleFileKeys.catalog(ws, kind),
    queryFn: () => read(`/ops/hr/catalog/${kind}`, ws as string, HrCatalogList),
    enabled: ws !== null && mayRead,
  });
}

export function useAddCatalogItem(
  ws: string | null,
): UseMutationResult<HrCatalogItem, Error, { kind: HrCatalogKind; body: CreateHrCatalogItemRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, body }) =>
      HrCatalogItem.parse(await command<unknown>(`/ops/hr/catalog/${kind}`, { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "hr-catalog"),
  });
}

export function useChangeCatalogItem(
  ws: string | null,
): UseMutationResult<HrCatalogItem, Error, { kind: HrCatalogKind; id: string; body: UpdateHrCatalogItemRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, id, body }) =>
      HrCatalogItem.parse(
        await command<unknown>(`/ops/hr/catalog/${kind}/${id}`, { workspaceId: ws as string, body, method: "PATCH" }),
      ),
    // A renamed position or tag reads differently on every file that carries it.
    onSuccess: () => refresh(client, "hr-catalog", "employees", "employee"),
  });
}

export function useHrSettings(ws: string | null): UseQueryResult<HrSettings> {
  const mayRead = useMayRead(OPS_READ.hrSettings);
  return useQuery({
    queryKey: peopleFileKeys.settings(ws),
    queryFn: () => read("/ops/hr/settings", ws as string, HrSettings),
    enabled: ws !== null && mayRead,
  });
}

export function useUpdateHrSettings(ws: string | null): UseMutationResult<HrSettings, Error, UpdateHrSettingsRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      HrSettings.parse(await command<unknown>("/ops/hr/settings", { workspaceId: ws as string, body, method: "PATCH" })),
    onSuccess: () => refresh(client, "hr-settings"),
  });
}
