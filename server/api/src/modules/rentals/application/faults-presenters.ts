import { NotFoundException } from '@nestjs/common';
import {
  FAULT_STATUS_TENANT,
  formatRwf,
  TICKET_MOVES,
  faultMoveWords,
  faultReopenUntil,
  faultTabOf,
  kigaliDateOf,
  type FaultActorRole,
  type FaultAssigneeView,
  type FaultEventView,
  type FaultListItem,
  type FaultPhotoView,
  type MaintenanceStatus,
  type TenantFaultItem,
} from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { assertBuildingInScope, assertResidence } from '../domain/residence';
import type { FaultEventRow, FaultPhotoRow, FaultRow } from '../infrastructure/faults.repository';

export const FAULT_NOT_FOUND = 'Fault not found.';

/** A fault of this residence business, in the caller's buildings, or 404 like one that does not exist. */
export function assertFaultOwned(ws: ScopedWorkspace, row: FaultRow | null): FaultRow {
  const r = assertResidence(ws);
  if (!row || row.workspaceId !== r.workspaceId || (!row.unitId && !row.leaseId)) throw new NotFoundException(FAULT_NOT_FOUND);
  if (row.propertyId) assertBuildingInScope(ws, row.propertyId, 'Fault');
  return row;
}

/** `2026-10-20` as "20 Oct". */
function shortDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "Paid RWF 45,000 to Eric on 20 Oct": the line the timeline reads for a payment. */
export function paidLine(amountRwf: number, payee: string | null, paidOn: string): string {
  return `Paid ${formatRwf(amountRwf)}${payee ? ` to ${payee}` : ''} on ${shortDay(paidOn)}`;
}

/** Who is fixing it, as the landlord sees it. */
export function assigneeOf(row: FaultRow): FaultAssigneeView | null {
  if (row.assigneeKind === 'member' && row.assignedToUserId) {
    return { kind: 'member', userId: row.assignedToUserId, name: row.assignedToName ?? 'Someone on your team', phone: null };
  }
  if (row.assignedContractor) {
    return { kind: 'contractor', userId: null, name: row.assignedContractor, phone: row.assignedContractorPhone };
  }
  if (row.assignedToUserId) {
    return { kind: 'member', userId: row.assignedToUserId, name: row.assignedToName ?? 'Someone on your team', phone: null };
  }
  return null;
}

export function presentFaultItem(row: FaultRow): FaultListItem {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    category: row.category,
    urgency: row.priority,
    status: row.status,
    tab: faultTabOf(row.status),
    unitId: row.unitId,
    unitLabel: row.unitLabel,
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    leaseId: row.leaseId,
    leaseReference: row.leaseReference,
    tenantName: row.tenantName,
    reportedBy: row.raisedByRole === 'tenant' ? 'tenant' : 'landlord',
    reportedAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    assigneeName: assigneeOf(row)?.name ?? null,
    photoCount: row.photoCount,
  };
}

/** The moves the landlord's "Move to" menu offers. Handing it over is Assign, so `assigned` needs someone already. */
export function allowedMoves(row: FaultRow): MaintenanceStatus[] {
  return TICKET_MOVES[row.status].filter((to) => to !== 'assigned' || assigneeOf(row) !== null);
}

export function presentPhoto(row: FaultPhotoRow, url: string, tenantUserId: string | null): FaultPhotoView {
  return {
    id: row.id,
    url,
    phase: row.phase,
    position: row.position,
    byTenant: tenantUserId !== null && row.uploadedByUserId === tenantUserId,
    uploadedAt: row.createdAt.toISOString(),
  };
}

function actorRoleOf(row: FaultEventRow): FaultActorRole {
  if (row.authorRole === 'tenant') return 'tenant';
  if (row.authorUserId || row.authorRole) return 'landlord';
  return 'system';
}

/** "Assigned to Eric. Bring a washer." → who, and the rest as the note. */
function splitAssignment(note: string | null): { who: string | null; rest: string | null } {
  const m = note?.match(/^Assigned to (.+?)\.(?:\s+([\s\S]*))?$/);
  if (!m) return { who: null, rest: note };
  return { who: m[1] ?? null, rest: m[2]?.trim() ? m[2].trim() : null };
}

/**
 * One timeline row, in plain words. The landlord's side names team notes and
 * messages as such; the tenant's side reads "You" and "Your landlord".
 */
export function presentEvent(row: FaultEventRow, viewer: 'landlord' | 'tenant'): FaultEventView {
  const actorRole = actorRoleOf(row);
  let words: string;
  let note = row.note;
  if (row.kind === 'reported') {
    words = actorRole === 'tenant' ? (viewer === 'tenant' ? 'You reported it.' : 'The tenant reported it.') : 'Reported by your landlord.';
  } else if (row.kind === 'assigned') {
    const { who, rest } = splitAssignment(row.note);
    words = faultMoveWords('assigned', { who });
    note = rest;
  } else if (row.kind === 'note') {
    if (!row.visibleToTenant) words = 'Team note.';
    else if (actorRole === 'tenant') words = viewer === 'tenant' ? 'You wrote.' : 'The tenant wrote.';
    else words = viewer === 'tenant' ? 'Your landlord wrote.' : 'Reply to the tenant.';
  } else if (row.kind === 'paid') {
    words = row.note ?? 'The fixer was paid.';
    note = null;
  } else if (row.toStatus) {
    words = faultMoveWords(row.toStatus, { from: row.fromStatus, byTenant: actorRole === 'tenant' });
    if (viewer === 'tenant' && row.toStatus === 'open' && actorRole === 'tenant') words = 'You reopened it.';
  } else {
    words = row.note ?? 'Updated.';
    note = null;
  }
  return {
    id: row.id,
    kind: row.kind,
    from: row.fromStatus,
    to: row.toStatus,
    words,
    note,
    actorName: viewer === 'tenant' && actorRole === 'landlord' ? null : row.authorName,
    actorRole,
    visibleToTenant: row.visibleToTenant,
    at: row.createdAt.toISOString(),
  };
}

/** One of the tenant's faults: what they may see of it. */
export function presentTenantFaultItem(row: FaultRow, today: string): TenantFaultItem {
  const assignee = assigneeOf(row);
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    category: row.category,
    urgency: row.priority,
    status: row.status,
    statusWords: FAULT_STATUS_TENANT[row.status],
    reportedAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    assigneeName: assignee?.name ?? null,
    photoCount: row.photoCount,
    reopenUntil: faultReopenUntil(row.status, row.resolvedAt, today),
  };
}

/** The Kigali day a fault was reported. */
export function reportedOn(row: FaultRow): string {
  return kigaliDateOf(row.createdAt);
}
