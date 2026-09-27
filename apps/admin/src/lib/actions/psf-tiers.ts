"use server";

import { CreatePsfTierRequest, PsfTier, UpdatePsfTierRequest } from "@injishi/contracts";

import { apiPatch, apiPost } from "@/lib/api/server";

import { badInput, outcomeOf, type WriteOutcome, type WriteSpec } from "./outcome";

/**
 * The PSF membership tier catalogue (ADR-056 AC-19) —
 * `POST` and `PATCH /api/v1/admin/configuration/psf-tiers`.
 *
 * `admin.fee.edit`, the same power that prices the registration fee, because a
 * tier is a price. An edit changes what the apply form offers from now on; an
 * application already sent keeps the price it was shown, and retiring a tier
 * never removes it from an application or a membership that names it.
 */

const CREATE: WriteSpec<PsfTier> = {
  what: "the new tier",
  permission: "admin.fee.edit",
  success: (t) => `Added ${t.nameEn}. It is offered on the PSF form from now on.`,
};

const UPDATE: WriteSpec<PsfTier> = {
  what: "the tier change",
  permission: "admin.fee.edit",
  success: (t) =>
    t.active
      ? `Saved ${t.nameEn}. Applications already sent keep the price they were shown.`
      : `Retired ${t.nameEn}. It leaves the form; applications and memberships that name it keep it.`,
};

export async function createPsfTier(input: unknown): Promise<WriteOutcome<PsfTier>> {
  const body = CreatePsfTierRequest.safeParse(input);
  if (!body.success) return badInput(CREATE);
  return outcomeOf(await apiPost("/api/v1/admin/configuration/psf-tiers", PsfTier, body.data), CREATE);
}

export async function updatePsfTier(code: string, input: unknown): Promise<WriteOutcome<PsfTier>> {
  const body = UpdatePsfTierRequest.safeParse(input);
  if (!body.success) return badInput(UPDATE);
  return outcomeOf(
    await apiPatch(`/api/v1/admin/configuration/psf-tiers/${encodeURIComponent(code)}`, PsfTier, body.data),
    UPDATE,
  );
}
