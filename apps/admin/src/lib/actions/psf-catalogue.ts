"use server";

import {
  CreatePsfAssociationRequest,
  CreatePsfClusterRequest,
  PsfCatalogue,
  UpsertPsfAssociationRequest,
  UpsertPsfClusterRequest,
} from "@injishi/contracts";

import { apiPatch, apiPost } from "@/lib/api/server";

import { badInput, outcomeOf, type WriteOutcome, type WriteSpec } from "./outcome";

/**
 * PSF's sector catalogue (the PSF path): its clusters and the associations a
 * business names when it registers — `POST` and `PATCH
 * /api/v1/admin/configuration/psf-clusters` and `psf-associations`.
 *
 * `admin.config.edit`, not the fee power: a sector is configuration, not a
 * price. Every write answers with the whole catalogue, which the page keeps.
 * Retiring an entry takes it off the registration form; the businesses already
 * filed under it keep reading it.
 */

const CLUSTER: WriteSpec<PsfCatalogue> = {
  what: "the cluster",
  permission: "admin.config.edit",
  success: () => "Saved the cluster. The registration form shows it from now on.",
};

const ASSOCIATION: WriteSpec<PsfCatalogue> = {
  what: "the association",
  permission: "admin.config.edit",
  success: () => "Saved the association. The registration form shows it from now on.",
};

const BASE = "/api/v1/admin/configuration";

export async function createPsfCluster(input: unknown): Promise<WriteOutcome<PsfCatalogue>> {
  const body = CreatePsfClusterRequest.safeParse(input);
  if (!body.success) return badInput(CLUSTER);
  return outcomeOf(await apiPost(`${BASE}/psf-clusters`, PsfCatalogue, body.data), CLUSTER);
}

export async function updatePsfCluster(code: string, input: unknown): Promise<WriteOutcome<PsfCatalogue>> {
  const body = UpsertPsfClusterRequest.safeParse(input);
  if (!body.success) return badInput(CLUSTER);
  return outcomeOf(await apiPatch(`${BASE}/psf-clusters/${encodeURIComponent(code)}`, PsfCatalogue, body.data), CLUSTER);
}

export async function createPsfAssociation(input: unknown): Promise<WriteOutcome<PsfCatalogue>> {
  const body = CreatePsfAssociationRequest.safeParse(input);
  if (!body.success) return badInput(ASSOCIATION);
  return outcomeOf(await apiPost(`${BASE}/psf-associations`, PsfCatalogue, body.data), ASSOCIATION);
}

export async function updatePsfAssociation(code: string, input: unknown): Promise<WriteOutcome<PsfCatalogue>> {
  const body = UpsertPsfAssociationRequest.safeParse(input);
  if (!body.success) return badInput(ASSOCIATION);
  return outcomeOf(
    await apiPatch(`${BASE}/psf-associations/${encodeURIComponent(code)}`, PsfCatalogue, body.data),
    ASSOCIATION,
  );
}
