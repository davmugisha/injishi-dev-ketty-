"use server";

import {
  CreateGovernmentBodyRequest,
  GovernmentBody,
  UpdateGovernmentBodyRequest,
} from "@injishi/contracts";

import { apiPatch, apiPost } from "@/lib/api/server";

import { badInput, outcomeOf, type WriteOutcome, type WriteSpec } from "./outcome";

/**
 * The government body catalogue writes (ADR-053, AC-G4) — `POST` and `PATCH
 * /api/v1/admin/government-bodies`.
 *
 * `admin.config.edit`, which only `super_admin` holds. A body is never deleted:
 * it is RETIRED, because every appointment and every officer decision already
 * taken names it, and a retired body stops being offered for a new appointment
 * while each existing one keeps naming it. The code never changes either; a
 * rename changes the names a person reads.
 */

const BASE = "/api/v1/admin/government-bodies";

const CREATE: WriteSpec<GovernmentBody> = {
  what: "the new government body",
  permission: "admin.config.edit",
  success: (b) => `${b.nameEn} (${b.code}) is in the catalogue and can take appointments. Your reason is on the audit trail.`,
};

const RENAME: WriteSpec<GovernmentBody> = {
  what: "the rename",
  permission: "admin.config.edit",
  success: (b) =>
    `Renamed to ${b.nameEn}. Officer consoles show the new name; decisions already recorded keep the name they were taken under.`,
};

const RETIRE: WriteSpec<GovernmentBody> = {
  what: "retiring the body",
  permission: "admin.config.edit",
  success: (b) =>
    `${b.nameEn} is retired. It is no longer offered for a new appointment; existing appointments still name it.`,
};

const RESTORE: WriteSpec<GovernmentBody> = {
  what: "restoring the body",
  permission: "admin.config.edit",
  success: (b) => `${b.nameEn} is live again and can take new appointments.`,
};

export async function createGovernmentBody(input: {
  code: string;
  nameEn: string;
  nameRw: string;
  abbreviation: string;
  reason: string;
}): Promise<WriteOutcome<GovernmentBody>> {
  const body = CreateGovernmentBodyRequest.safeParse({
    ...input,
    code: input.code.trim().toUpperCase(),
    abbreviation: input.abbreviation.trim() || undefined,
  });
  if (!body.success) return badInput(CREATE);
  return outcomeOf(await apiPost(BASE, GovernmentBody, body.data), CREATE);
}

export async function renameGovernmentBody(
  code: string,
  input: { nameEn: string; nameRw: string; reason: string },
): Promise<WriteOutcome<GovernmentBody>> {
  const body = UpdateGovernmentBodyRequest.safeParse(input);
  if (!body.success || !/^[A-Z][A-Z0-9_]{1,15}$/.test(code)) return badInput(RENAME);
  return outcomeOf(await apiPatch(`${BASE}/${code}`, GovernmentBody, body.data), RENAME);
}

export async function setGovernmentBodyActive(
  code: string,
  active: boolean,
  reason: string,
): Promise<WriteOutcome<GovernmentBody>> {
  const spec = active ? RESTORE : RETIRE;
  const body = UpdateGovernmentBodyRequest.safeParse({ active, reason });
  if (!body.success || !/^[A-Z][A-Z0-9_]{1,15}$/.test(code)) return badInput(spec);
  return outcomeOf(await apiPatch(`${BASE}/${code}`, GovernmentBody, body.data), spec);
}
