"use server";

/**
 * The landlord's writes (WP 2.2, 2.3): each checks its input with the contracts schema the API checks
 * with, calls the API in the business this request acts in, and answers in words for a toast or under a
 * field. The sidebar counts and every rentals screen are refreshed after a change.
 */
import {
  type BlockView,
  BrokerDefaultsRequest,
  BulkUnitsRequest,
  type BulkUnitsResult,
  ChangeMemberRoleRequest,
  CreateBlockRequest,
  CreateUnitRequest,
  InviteStaffRequest,
  type LandlordProfileView,
  LeaseDefaultsRequest,
  type OperatorStaffInvitation,
  type OperatorTeamMember,
  PayoutAccountInput,
  type PayoutAccountList,
  type PayoutView,
  PropertyLocationRequest,
  type RentalPropertyView,
  type RentalUnitView,
  ReorderUnitPhotosRequest,
  SignatoryRequest,
  type UnitMediaView,
  UpdateBlockRequest,
  UpdateUnitRequest,
} from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { hostScope, type LandlordScope, landlordScope } from "@/server/rentals/client";

export type ActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fieldErrorsOf(
  issues: readonly { path: readonly (string | number)[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** A contracts schema (zod 3, used only through its own methods: the app's zod is 4). */
interface Schema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: Invalid };
}
interface Invalid {
  issues: { path: (string | number)[]; message: string }[];
}

function invalid<T>(error: Invalid): ActionResult<T> {
  const fieldErrors = fieldErrorsOf(error.issues);
  return { ok: false, error: fieldErrors._ ?? "Check the highlighted fields.", fieldErrors };
}

/**
 * Which business a payout write acts in: the landlord's (the default), or a
 * hospitality business by its workspace id (0116).
 */
export type PaidBusiness = "landlord" | { host: string };

/** Run one write in the landlord's business (or the host's), with the API's refusals in words. */
async function run<T>(
  write: (scope: LandlordScope) => Promise<T>,
  business: PaidBusiness = "landlord",
): Promise<ActionResult<T>> {
  const scope = business === "landlord" ? await landlordScope() : await hostScope(business.host);
  if (!scope)
    return {
      ok: false,
      error: business === "landlord" ? "There is no rentals business here." : "There is no hotel or venue business here.",
    };
  try {
    const value = await write(scope);
    revalidatePath("/", "layout");
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.unauthenticated) redirect("/sign-in");
      const body = error.body as { issues?: { path: (string | number)[]; message: string }[] } | null;
      if (error.status === 400 && Array.isArray(body?.issues) && body.issues.length > 0) {
        const fieldErrors = fieldErrorsOf(body.issues);
        return {
          ok: false,
          error: fieldErrors._ ?? body.issues[0]?.message ?? "Check the highlighted fields.",
          fieldErrors,
        };
      }
      if (error.forbidden) return { ok: false, error: "You can't do this in this business. Ask the owner." };
      return { ok: false, error: error.message.startsWith("HTTP ") ? "That didn't work. Try again." : error.message };
    }
    if (error instanceof ApiUnreachableError) {
      return { ok: false, error: "Injishi could not be reached. Check your connection and try again." };
    }
    throw error;
  }
}

function parse<T>(schema: Schema<T>, input: unknown): { ok: true; data: T } | { ok: false; error: Invalid } {
  const result = schema.safeParse(input);
  return result.success ? { ok: true, data: result.data } : { ok: false, error: result.error };
}

const ws = (scope: LandlordScope) => ({ workspaceId: scope.workspace.workspaceId });

// --- Settings ---------------------------------------------------------------------------------

/** Invite somebody into a role of the business; the API mails them the link. Every building (no limit). */
export async function inviteTeamMember(input: unknown): Promise<ActionResult<OperatorStaffInvitation>> {
  const parsed = parse(InviteStaffRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return run((s) =>
    s.api.post<OperatorStaffInvitation>("/api/v1/ops/team/invitations", { ...parsed.data, branchIds: null }, ws(s)),
  );
}

export async function changeTeamRole(userId: string, input: unknown): Promise<ActionResult<OperatorTeamMember>> {
  if (!UUID.test(userId)) return { ok: false, error: "That person was not found." };
  const parsed = parse(ChangeMemberRoleRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return run((s) => s.api.patch<OperatorTeamMember>(`/api/v1/ops/team/${userId}/role`, parsed.data, ws(s)));
}

export async function revokeTeamInvitation(id: string): Promise<ActionResult<null>> {
  if (!UUID.test(id)) return { ok: false, error: "That invitation was not found." };
  return run(async (s) => {
    await s.api.post(`/api/v1/ops/team/invitations/${id}/revoke`, {}, ws(s));
    return null;
  });
}

export async function saveLeaseDefaults(input: unknown): Promise<ActionResult<LandlordProfileView>> {
  const parsed = parse(LeaseDefaultsRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return run((s) => s.api.put<LandlordProfileView>("/api/v1/ops/rentals/profile/lease-defaults", parsed.data, ws(s)));
}

/** The broker fee a unit starts with when brokers may offer it; null clears it. */
export async function saveBrokerDefaults(input: unknown): Promise<ActionResult<LandlordProfileView>> {
  const parsed = parse(BrokerDefaultsRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return run((s) => s.api.put<LandlordProfileView>("/api/v1/ops/rentals/profile/brokers", parsed.data, ws(s)));
}

export async function saveSignatory(input: unknown): Promise<ActionResult<LandlordProfileView>> {
  const parsed = parse(SignatoryRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return run((s) => s.api.put<LandlordProfileView>("/api/v1/ops/rentals/profile/signatory", parsed.data, ws(s)));
}

export async function addPayoutAccount(
  input: unknown,
  business: PaidBusiness = "landlord",
): Promise<ActionResult<PayoutAccountList>> {
  const parsed = parse(PayoutAccountInput, input);
  if (!parsed.ok) return invalid(parsed.error);
  return run((s) => s.api.post<PayoutAccountList>("/api/v1/ops/payout-accounts", parsed.data, ws(s)), business);
}

export async function makePrimaryPayoutAccount(
  id: string,
  business: PaidBusiness = "landlord",
): Promise<ActionResult<PayoutAccountList>> {
  if (!UUID.test(id)) return { ok: false, error: "That account was not found." };
  return run((s) => s.api.post<PayoutAccountList>(`/api/v1/ops/payout-accounts/${id}/primary`, {}, ws(s)), business);
}

export async function retirePayoutAccount(
  id: string,
  business: PaidBusiness = "landlord",
): Promise<ActionResult<PayoutAccountList>> {
  if (!UUID.test(id)) return { ok: false, error: "That account was not found." };
  return run((s) => s.api.post<PayoutAccountList>(`/api/v1/ops/payout-accounts/${id}/retire`, {}, ws(s)), business);
}

export async function retryPayout(id: string, business: PaidBusiness = "landlord"): Promise<ActionResult<PayoutView>> {
  if (!UUID.test(id)) return { ok: false, error: "That payout was not found." };
  return run((s) => s.api.post<PayoutView>(`/api/v1/ops/payouts/${id}/retry`, {}, ws(s)), business);
}

export async function saveLocation(propertyId: string, input: unknown): Promise<ActionResult<RentalPropertyView>> {
  if (!UUID.test(propertyId)) return { ok: false, error: "That building was not found." };
  const parsed = parse(PropertyLocationRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return run((s) => s.api.put<RentalPropertyView>(`/api/v1/ops/properties/${propertyId}/location`, parsed.data, ws(s)));
}

// --- Units and blocks ----------------------------------------------------------------------------

export async function createUnit(input: unknown): Promise<ActionResult<RentalUnitView>> {
  const parsed = parse(CreateUnitRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return run((s) => s.api.post<RentalUnitView>("/api/v1/ops/units", parsed.data, ws(s)));
}

export async function bulkAddUnits(input: unknown): Promise<ActionResult<BulkUnitsResult>> {
  const parsed = parse(BulkUnitsRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return run((s) => s.api.post<BulkUnitsResult>("/api/v1/ops/units/bulk", parsed.data, ws(s)));
}

export async function updateUnit(id: string, input: unknown): Promise<ActionResult<RentalUnitView>> {
  if (!UUID.test(id)) return { ok: false, error: "That unit was not found." };
  const parsed = parse(UpdateUnitRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return run((s) => s.api.patch<RentalUnitView>(`/api/v1/ops/units/${id}`, parsed.data, ws(s)));
}

export async function retireUnit(id: string): Promise<ActionResult<RentalUnitView>> {
  if (!UUID.test(id)) return { ok: false, error: "That unit was not found." };
  return run((s) => s.api.post<RentalUnitView>(`/api/v1/ops/units/${id}/retire`, {}, ws(s)));
}

export async function createBlock(input: unknown): Promise<ActionResult<BlockView>> {
  const parsed = parse(CreateBlockRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return run((s) => s.api.post<BlockView>("/api/v1/ops/blocks", parsed.data, ws(s)));
}

export async function updateBlock(id: string, input: unknown): Promise<ActionResult<BlockView>> {
  if (!UUID.test(id)) return { ok: false, error: "That block was not found." };
  const parsed = parse(UpdateBlockRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return run((s) => s.api.patch<BlockView>(`/api/v1/ops/blocks/${id}`, parsed.data, ws(s)));
}

// --- A unit's photos and video ---------------------------------------------------------------------

/** The unit's photos and video with fresh links, when its panel opens. */
export async function loadUnitMedia(id: string): Promise<ActionResult<UnitMediaView>> {
  if (!UUID.test(id)) return { ok: false, error: "That unit was not found." };
  const scope = await landlordScope();
  if (!scope) return { ok: false, error: "There is no rentals business here." };
  try {
    return { ok: true, value: await scope.api.get<UnitMediaView>(`/api/v1/ops/units/${id}/media`, ws(scope)) };
  } catch (error) {
    if (error instanceof ApiError || error instanceof ApiUnreachableError) {
      return { ok: false, error: "Couldn't load the photos. Try again." };
    }
    throw error;
  }
}

export async function reorderUnitPhotos(id: string, photoIds: string[]): Promise<ActionResult<UnitMediaView>> {
  if (!UUID.test(id)) return { ok: false, error: "That unit was not found." };
  const parsed = parse(ReorderUnitPhotosRequest, { photoIds });
  if (!parsed.ok) return invalid(parsed.error);
  return run((s) => s.api.patch<UnitMediaView>(`/api/v1/ops/units/${id}/photos/order`, parsed.data, ws(s)));
}

export async function removeUnitPhoto(id: string, photoId: string): Promise<ActionResult<UnitMediaView>> {
  if (!UUID.test(id) || !UUID.test(photoId)) return { ok: false, error: "That photo was not found." };
  return run((s) => s.api.delete<UnitMediaView>(`/api/v1/ops/units/${id}/photos/${photoId}`, ws(s)));
}

export async function removeUnitVideo(id: string): Promise<ActionResult<UnitMediaView>> {
  if (!UUID.test(id)) return { ok: false, error: "That unit was not found." };
  return run((s) => s.api.delete<UnitMediaView>(`/api/v1/ops/units/${id}/video`, ws(s)));
}
