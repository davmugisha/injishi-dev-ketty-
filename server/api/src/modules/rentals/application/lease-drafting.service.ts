import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  addDays,
  brokerFeeFrom,
  canEditLease,
  dueDayFromStart,
  editVoidsLandlordSignature,
  idNumberProblem,
  kigaliToday,
  leaseDatesProblem,
  longDate,
  nextLeaseStatus,
  type CreateLeaseRequest,
  type EditLeaseRequest,
  type LeaseDetail,
  type TenantInput,
} from '@injishi/contracts';
import { and, eq } from 'drizzle-orm';

import { brokers } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { nextLeaseReference } from '../domain/lease-words';
import { assertBuildingInScope, assertResidence, leaseStateConflict } from '../domain/residence';
import { LeasesRepository, type LeaseRow, type OverlapRow } from '../infrastructure/leases.repository';
import { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import { LeaseEventsWriter, RentalsAuditWriter, type Tx } from '../infrastructure/rentals-writers';
import { TenantsRepository, type TenantRow } from '../infrastructure/tenants.repository';
import { UnitsRepository, type UnitListRow } from '../infrastructure/units.repository';
import { LeaseBrokersService } from './lease-brokers.service';
import { LeaseContractService } from './lease-contract.service';
import { LeaseReadsService } from './lease-reads.service';

/** The lease terms the edit form can change, by the name the event payload uses. */
const TERM_FIELDS = [
  'startDate',
  'endDate',
  'billingStartsOn',
  'monthlyRentRwf',
  'depositRwf',
  'rentDueDay',
  'graceDays',
  'noticeDays',
  'occupants',
  'otherTerms',
] as const;

const TENANT_FIELDS = ['fullName', 'email', 'phone', 'idKind', 'idNumber', 'nationality'] as const;
type TenantField = (typeof TENANT_FIELDS)[number];

/** How many times a draft retries when two landlords took the same next reference at once. */
const REFERENCE_ATTEMPTS = 3;

/**
 * Drafting a lease (blueprint 2.3, WP 1.5a): create, and edit before the
 * tenant signs. The state machine is contracts' `LEASE_TRANSITIONS`; signing
 * moves a lease on in `LeaseSigningService`, starting and cancelling in
 * `LeaseLifecycleService`. Every write locks the lease row, writes its
 * timeline event (and an audit row for a signature voided) in the same
 * transaction, and answers the lease record.
 */
@Injectable()
export class LeaseDraftingService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly leases: LeasesRepository,
    private readonly tenants: TenantsRepository,
    private readonly units: UnitsRepository,
    private readonly context: RentalsContextRepository,
    private readonly contracts: LeaseContractService,
    private readonly events: LeaseEventsWriter,
    private readonly audit: RentalsAuditWriter,
    private readonly reads: LeaseReadsService,
    /** The broker on a lease (2026-10-25); absent in the older unit tests, which name none. */
    @Optional() private readonly brokers?: LeaseBrokersService,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected today(): string {
    return kigaliToday();
  }

  /**
   * Draft a lease on one unit for a tenant: one already on the books
   * (`tenantId`), or a new one (`tenant`), found again by email when the
   * business has rented to them before. Grace, notice and the due day the
   * request leaves out come from the landlord's lease defaults.
   */
  async create(ws: ScopedWorkspace, userId: string, body: CreateLeaseRequest): Promise<LeaseDetail> {
    const r = assertResidence(ws);
    const profile = await this.context.ensureProfile(r);
    const unit = await this.leasableUnit(ws, body.unitId);
    const terms = body.terms;
    const rentDueDay = terms.rentDueDay ?? profile.defaultRentDueDay ?? dueDayFromStart(terms.startDate);
    const billingStartsOn = terms.billingStartsOn ?? terms.startDate;
    await this.assertNoOverlap(unit, terms.startDate, terms.endDate);
    if (body.brokerId) await this.assertActiveBroker(body.brokerId);
    const defaultFee = brokerFeeFrom(profile.brokerFeeKind, profile.brokerFeePercent, profile.brokerFeeRwf);

    let created: { leaseId: string; tenantTouched: string | null } | null = null;
    for (let attempt = 1; created === null; attempt += 1) {
      try {
        created = await this.db.transaction(async (tx) => {
          const tenant = await this.tenantFor(tx, ws, body);
          const reference = nextLeaseReference(await this.leases.references(tx, r.workspaceId));
          const id = await this.leases.insert(tx, {
            orgId: r.orgId,
            workspaceId: r.workspaceId,
            reference,
            propertyId: unit.propertyId,
            unitId: unit.id,
            tenantId: tenant.id,
            brokerId: body.brokerId ?? null,
            status: 'draft',
            startDate: terms.startDate,
            endDate: terms.endDate,
            billingStartsOn,
            monthlyRentRwf: terms.monthlyRentRwf,
            depositRwf: terms.depositRwf,
            rentDueDay,
            graceDays: terms.graceDays ?? profile.defaultGraceDays,
            noticeDays: terms.noticeDays ?? profile.defaultNoticeDays,
            occupants: terms.occupants,
            otherTerms: terms.otherTerms?.trim() || null,
          });
          if (body.brokerId && this.brokers) {
            const { placementId } = await this.brokers.attach(
              tx,
              {
                leaseId: id,
                workspaceId: r.workspaceId,
                unitId: unit.id,
                monthlyRentRwf: terms.monthlyRentRwf,
                unitFee: brokerFeeFrom(unit.brokerFeeKind, unit.brokerFeePercent, unit.brokerFeeRwf),
                defaultFee,
              },
              { brokerId: body.brokerId, placementId: body.placementId, brokerFee: body.brokerFee },
            );
            if (placementId) await this.leases.update(tx, id, { placementId });
          }
          const record = await this.leases.find(id, tx);
          if (!record) throw new Error(`lease ${id} vanished`);
          const frozen = await this.contracts.freeze(tx, record, userId);
          await this.events.write(tx, {
            leaseId: id,
            workspaceId: r.workspaceId,
            kind: 'created',
            actorUserId: userId,
            actorRole: 'landlord',
            payload: { reference, version: frozen.version, tenantId: tenant.id, tenant: tenant.how, unitId: unit.id },
          });
          if (tenant.updatedFields.length > 0) {
            await this.audit.write(tx, {
              actorUserId: userId,
              subjectType: 'tenant',
              subjectId: tenant.id,
              eventType: 'tenant.updated',
              diff: { fields: tenant.updatedFields, leaseId: id },
            });
          }
          return { leaseId: id, tenantTouched: tenant.updatedFields.length > 0 ? tenant.id : null };
        });
      } catch (cause) {
        if (attempt < REFERENCE_ATTEMPTS && isUniqueViolation(cause, 'leases_workspace_reference_uk')) continue;
        throw mapConstraint(cause);
      }
    }
    const { leaseId, tenantTouched } = created;
    if (tenantTouched) {
      // The tenant's other drafts name them too.
      const others = (await this.tenants.draftLeaseIds(tenantTouched)).filter((id) => id !== leaseId);
      await this.contracts.refreshDrafts(others, userId);
    }
    return this.reads.detail(ws, leaseId);
  }

  /**
   * Change a lease before the tenant signs. Only what is sent changes. A lease
   * out for signature goes back to draft: the landlord's signature is voided,
   * the invitation is withdrawn, and the next contract version is written for
   * the landlord to sign again (`LEASE_TRANSITIONS`, `edit_terms`).
   */
  async edit(ws: ScopedWorkspace, userId: string, leaseId: string, body: EditLeaseRequest): Promise<LeaseDetail> {
    const r = assertResidence(ws);
    const today = this.today();
    let otherDrafts: string[] = [];
    await this.db
      .transaction(async (tx) => {
        const row = await this.lockOwned(tx, ws, leaseId);
        if (!canEditLease(row.status)) {
          throw leaseStateConflict(
            row.status,
            row.status === 'signed'
              ? 'Both sides signed it, so its terms can no longer change. Cancel it and draft a new one.'
              : 'Its terms can no longer change.',
          );
        }

        // The unit.
        let unit: UnitListRow | null = null;
        if (body.unitId && body.unitId !== row.unitId) unit = await this.leasableUnit(ws, body.unitId);

        // The terms, merged. Billing that followed the start date keeps following it.
        const t = body.terms ?? {};
        const startDate = t.startDate ?? row.startDate;
        const endDate = t.endDate ?? row.endDate;
        const billingFollowsStart = row.billingStartsOn === row.startDate;
        const billingStartsOn =
          t.billingStartsOn !== undefined ? (t.billingStartsOn ?? startDate) : billingFollowsStart ? startDate : row.billingStartsOn;
        const datesChanged = startDate !== row.startDate || endDate !== row.endDate || billingStartsOn !== row.billingStartsOn;
        if (datesChanged) {
          const problem = leaseDatesProblem(
            { startDate, endDate, billingStartsOn: billingStartsOn === startDate ? null : billingStartsOn },
            today,
          );
          if (problem) throw fieldError(['terms', problem.path], problem.message);
        }
        if (datesChanged || unit) {
          const target = unit ?? (await this.units.find(row.unitId, tx));
          if (target) await this.assertNoOverlap(target, startDate, endDate, row.id, tx);
        }
        const next = {
          startDate,
          endDate,
          billingStartsOn,
          monthlyRentRwf: t.monthlyRentRwf ?? row.monthlyRentRwf,
          depositRwf: t.depositRwf ?? row.depositRwf,
          rentDueDay: t.rentDueDay ?? row.rentDueDay,
          graceDays: t.graceDays ?? row.graceDays,
          noticeDays: t.noticeDays ?? row.noticeDays,
          occupants: t.occupants ?? row.occupants,
          otherTerms: t.otherTerms !== undefined ? t.otherTerms?.trim() || null : row.otherTerms,
        };
        const changedTerms = TERM_FIELDS.filter((f) => !sameValue(next[f], row[f]));

        // The tenant's record.
        const tenantChanges = await this.tenantEdits(tx, ws, row, body.tenant ?? {});

        // The broker who brought the tenant: not in the contract, so no new version for it alone.
        await this.editBroker(tx, r.workspaceId, row, unit, next.monthlyRentRwf, body);

        if (changedTerms.length === 0 && !unit && tenantChanges.fields.length === 0) {
          return; // Nothing in the contract changed: no version, no event.
        }

        const wasPending = editVoidsLandlordSignature(row.status);
        await this.leases.update(tx, row.id, {
          ...next,
          ...(unit ? { unitId: unit.id, propertyId: unit.propertyId } : {}),
          ...(wasPending ? { status: nextLeaseStatus(row.status, 'edit_terms') ?? 'draft' } : {}),
        });
        if (tenantChanges.fields.length > 0) {
          await this.tenants.update(tx, row.tenantId, tenantChanges.values);
          await this.audit.write(tx, {
            actorUserId: userId,
            subjectType: 'tenant',
            subjectId: row.tenantId,
            eventType: 'tenant.updated',
            diff: { fields: tenantChanges.fields, leaseId: row.id },
          });
          otherDrafts = (await this.tenants.draftLeaseIds(row.tenantId, tx)).filter((id) => id !== row.id);
        }

        if (wasPending) {
          const voided = await this.leases.voidLandlordSignatures(tx, row.id, 'Voided: the terms were edited after signing.');
          const invitation = await this.leases.revokeLiveInvitation(tx, row.id);
          await this.events.write(tx, {
            leaseId: row.id,
            workspaceId: r.workspaceId,
            kind: 'landlord_signature_voided',
            actorUserId: userId,
            actorRole: 'landlord',
            visibleToTenant: true,
            payload: { signatureIds: voided, invitationRevoked: invitation !== null },
          });
          await this.audit.write(tx, {
            actorUserId: userId,
            subjectType: 'lease',
            subjectId: row.id,
            eventType: 'lease.signature_voided',
            diff: { signatureIds: voided, from: row.status, to: 'draft', changed: [...changedTerms, ...tenantChanges.fields] },
            reason: 'The terms were edited after the landlord signed.',
          });
        }

        const record = await this.leases.find(row.id, tx);
        if (!record) throw new Error(`lease ${row.id} vanished`);
        const frozen = await this.contracts.freeze(tx, record, userId);
        if (changedTerms.length > 0 || unit) {
          await this.events.write(tx, {
            leaseId: row.id,
            workspaceId: r.workspaceId,
            kind: 'terms_edited',
            actorUserId: userId,
            actorRole: 'landlord',
            visibleToTenant: wasPending,
            payload: { changed: [...changedTerms, ...(unit ? ['unitId'] : [])], version: frozen.version },
          });
        }
        if (tenantChanges.fields.length > 0) {
          await this.events.write(tx, {
            leaseId: row.id,
            workspaceId: r.workspaceId,
            kind: 'tenant_updated',
            actorUserId: userId,
            actorRole: 'landlord',
            visibleToTenant: wasPending,
            payload: { changed: tenantChanges.fields, version: frozen.version },
          });
        }
      })
      .catch((cause: unknown) => {
        throw mapConstraint(cause);
      });
    if (otherDrafts.length > 0) await this.contracts.refreshDrafts(otherDrafts, userId);
    return this.reads.detail(ws, leaseId);
  }

  // --- Helpers --------------------------------------------------------------------

  private async lockOwned(tx: Tx, ws: ScopedWorkspace, leaseId: string): Promise<LeaseRow> {
    const row = await this.leases.lock(tx, leaseId);
    if (!row || row.workspaceId !== ws.workspaceId) throw new NotFoundException('Lease not found.');
    assertBuildingInScope(ws, row.propertyId, 'Lease');
    return row;
  }

  /** A unit of this business, in scope, that can be let. */
  private async leasableUnit(ws: ScopedWorkspace, unitId: string): Promise<UnitListRow> {
    const unit = await this.units.find(unitId);
    if (!unit || unit.workspaceId !== ws.workspaceId) throw new NotFoundException('Unit not found.');
    assertBuildingInScope(ws, unit.propertyId, 'Unit');
    if (unit.state === 'retired') {
      throw new ConflictException({ code: 'unit_retired', message: `Unit ${unit.label} is retired. Pick another unit.` });
    }
    return unit;
  }

  /** Refuse dates that meet a live lease's on the unit, saying whose and until when. */
  private async assertNoOverlap(
    unit: Pick<UnitListRow, 'id' | 'label'>,
    start: string,
    end: string,
    exceptLeaseId?: string,
    db?: Tx,
  ): Promise<void> {
    const clash = await this.leases.liveOverlap(unit.id, start, end, exceptLeaseId, db);
    if (clash) throw overlapConflict(unit.label, clash);
  }

  /**
   * Name the broker on a draft, change the fee agreed, or take the broker off.
   * A rent change moves a percent fee with it. True when anything was written.
   */
  private async editBroker(
    tx: Tx,
    workspaceId: string,
    row: LeaseRow,
    unit: UnitListRow | null,
    monthlyRentRwf: number,
    body: EditLeaseRequest,
  ): Promise<boolean> {
    if (!this.brokers) return false;
    const asked = body.brokerId !== undefined || body.placementId !== undefined || body.brokerFee !== undefined;
    if (!asked) {
      if (row.brokerId && monthlyRentRwf !== row.monthlyRentRwf) {
        await this.brokers.rentChanged(tx, row.id, row.brokerId, workspaceId, monthlyRentRwf);
      }
      return false;
    }
    const brokerId = body.brokerId === undefined ? row.brokerId : body.brokerId;
    if (!brokerId) {
      if (!row.brokerId) return false;
      await this.brokers.detach(tx, row.id);
      await this.leases.update(tx, row.id, { brokerId: null, placementId: null });
      return true;
    }
    if (brokerId !== row.brokerId) await this.brokers.assertBroker(brokerId, tx);
    const target = unit ?? (await this.units.find(row.unitId, tx));
    const profile = await this.context.profileByWorkspace(workspaceId, tx);
    const { placementId } = await this.brokers.attach(
      tx,
      {
        leaseId: row.id,
        workspaceId,
        unitId: target?.id ?? row.unitId,
        monthlyRentRwf,
        unitFee: target ? brokerFeeFrom(target.brokerFeeKind, target.brokerFeePercent, target.brokerFeeRwf) : null,
        defaultFee: profile ? brokerFeeFrom(profile.brokerFeeKind, profile.brokerFeePercent, profile.brokerFeeRwf) : null,
      },
      {
        brokerId,
        placementId: body.placementId === undefined ? (brokerId === row.brokerId ? row.placementId : null) : body.placementId,
        brokerFee: body.brokerFee,
      },
    );
    await this.leases.update(tx, row.id, { brokerId, placementId });
    return true;
  }

  private async assertActiveBroker(brokerId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: brokers.id })
      .from(brokers)
      .where(and(eq(brokers.id, brokerId), eq(brokers.status, 'active')))
      .limit(1);
    if (!row) throw fieldError(['brokerId'], "That broker isn't an active broker on Injishi. Pick one from the list.");
  }

  /**
   * The tenant a new lease names. By id: theirs, in this business. New: the
   * record with that email when the business has one (brought up to date
   * unless a signed contract names them), else a new record.
   */
  private async tenantFor(
    tx: Tx,
    ws: ScopedWorkspace,
    body: CreateLeaseRequest,
  ): Promise<{ id: string; how: 'picked' | 'linked' | 'created'; updatedFields: TenantField[] }> {
    if (body.tenantId) {
      const tenant = await this.tenants.find(body.tenantId, tx);
      if (!tenant || tenant.workspaceId !== ws.workspaceId) throw new NotFoundException('Tenant not found.');
      return { id: tenant.id, how: 'picked', updatedFields: [] };
    }
    const input = body.tenant as TenantInput;
    const existing = await this.tenants.findByEmail(ws.workspaceId, input.email, tx);
    if (!existing) {
      const id = await this.tenants.insert(tx, {
        workspaceId: ws.workspaceId,
        orgId: ws.orgId as string,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        idKind: input.idKind,
        idNumber: input.idNumber,
        nationality: input.nationality,
      });
      return { id, how: 'created', updatedFields: [] };
    }
    const differing = TENANT_FIELDS.filter((f) => !sameValue(input[f], existing[f]));
    if (differing.length === 0) return { id: existing.id, how: 'linked', updatedFields: [] };
    const signed = await this.tenants.signedTenantIds([existing.id], undefined, tx);
    if (signed.has(existing.id)) {
      throw new ConflictException({
        code: 'tenant_signed',
        message: `${existing.fullName} already rents from you with this email and has signed a lease, so their details can't change here. Pick them from your tenants, or use another email.`,
      });
    }
    await this.tenants.update(tx, existing.id, {
      fullName: input.fullName,
      phone: input.phone,
      idKind: input.idKind,
      idNumber: input.idNumber,
      nationality: input.nationality,
    });
    return { id: existing.id, how: 'linked', updatedFields: differing };
  }

  /** The tenant fields an edit changes, checked; refused when another signed contract names the tenant. */
  private async tenantEdits(
    tx: Tx,
    ws: ScopedWorkspace,
    row: LeaseRow,
    patch: NonNullable<EditLeaseRequest['tenant']>,
  ): Promise<{ fields: TenantField[]; values: Partial<Pick<TenantRow, TenantField>> }> {
    const sent = TENANT_FIELDS.filter((f) => patch[f] !== undefined);
    if (sent.length === 0) return { fields: [], values: {} };
    const tenant = await this.tenants.find(row.tenantId, tx);
    if (!tenant) throw new Error(`tenant ${row.tenantId} vanished`);
    const fields = sent.filter((f) => !sameValue(patch[f], tenant[f]));
    if (fields.length === 0) return { fields: [], values: {} };
    const signedElsewhere = await this.tenants.signedTenantIds([tenant.id], row.id, tx);
    if (signedElsewhere.has(tenant.id)) {
      throw new ConflictException({
        code: 'tenant_signed',
        message: `${tenant.fullName} has signed another lease with you, so their details can't change. Draft this lease for a new tenant record instead.`,
      });
    }
    const idKind = patch.idKind ?? tenant.idKind;
    const idNumber = patch.idNumber ?? tenant.idNumber;
    if ((patch.idKind || patch.idNumber) && idKind && idNumber) {
      const problem = idNumberProblem(idKind, idNumber);
      if (problem) throw fieldError(['tenant', 'idNumber'], problem);
    }
    if (patch.email && patch.email !== tenant.email) {
      const other = await this.tenants.findByEmail(ws.workspaceId, patch.email, tx);
      if (other && other.id !== tenant.id) {
        throw new ConflictException({
          code: 'tenant_email_taken',
          message: `${other.fullName} is already a tenant of yours with this email. Pick them instead, or use another email.`,
        });
      }
    }
    const values: Partial<Pick<TenantRow, TenantField>> = {};
    for (const f of fields) (values as Record<string, unknown>)[f] = patch[f];
    return { fields, values };
  }
}

// --- Words and errors -----------------------------------------------------------------

function overlapConflict(unitLabel: string, clash: OverlapRow): ConflictException {
  const free = addDays(clash.endsOn, 1);
  return new ConflictException({
    code: 'unit_taken',
    leaseId: clash.id,
    message:
      `Unit ${unitLabel} is let to ${clash.tenantName} from ${longDate(clash.startDate)} to ${longDate(clash.endsOn)} ` +
      `(lease ${clash.reference}). Pick dates from ${longDate(free)} on, or another unit.`,
  });
}

/** A 400 shaped like the validation pipe's, so a form puts it under the right field. */
function fieldError(path: (string | number)[], message: string): BadRequestException {
  return new BadRequestException({ message: 'Validation failed', issues: [{ code: 'custom', path, message }] });
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
  return (a ?? null) === (b ?? null);
}

interface PgError {
  code?: string;
  constraint?: string;
  cause?: PgError;
}

function pgError(cause: unknown): PgError | null {
  if (!cause || typeof cause !== 'object') return null;
  const e = cause as PgError;
  if (e.code) return e;
  return e.cause && typeof e.cause === 'object' ? pgError(e.cause) : null;
}

function isUniqueViolation(cause: unknown, constraint: string): boolean {
  const e = pgError(cause);
  return e?.code === '23505' && e.constraint === constraint;
}

/**
 * The database's own refusals, in words: the overlap exclusion (two live
 * leases on one unit), and a tenant email already on another record.
 */
function mapConstraint(cause: unknown): unknown {
  const e = pgError(cause);
  if (e?.code === '23P01' && e.constraint === 'leases_unit_no_overlap') {
    return new ConflictException({ code: 'unit_taken', message: 'Another lease holds this unit on those days. Pick other dates or another unit.' });
  }
  if (e?.code === '23505' && e.constraint === 'tenants_workspace_email_uk') {
    return new ConflictException({ code: 'tenant_email_taken', message: 'Another tenant of yours already uses this email.' });
  }
  return cause;
}
