import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  TENANT_SEARCH_LIMIT,
  idNumberProblem,
  type TenantList,
  type TenantView,
  type UpdateTenantRequest,
} from '@injishi/contracts';

import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { assertResidence } from '../domain/residence';
import { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { TenantsRepository, type TenantRow } from '../infrastructure/tenants.repository';
import { LeaseContractService } from './lease-contract.service';
import { presentTenant } from './rentals-presenters';

const FIELDS = ['fullName', 'email', 'phone', 'idKind', 'idNumber', 'nationality'] as const;
type Field = (typeof FIELDS)[number];

/**
 * Tenants (blueprint 2.3): the business's records of the people it rents to.
 * A record changes only until a contract naming the person is signed (by
 * either side): what they signed names them as they were, and a later lease
 * is drafted from the record as it stands. Their draft leases get a new
 * contract version when the record changes.
 */
@Injectable()
export class TenantsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly tenants: TenantsRepository,
    private readonly contracts: LeaseContractService,
    private readonly events: LeaseEventsWriter,
    private readonly audit: RentalsAuditWriter,
  ) {}

  /** Tenants whose name, email, phone or ID number matches `q`, most recently changed first. */
  async search(ws: ScopedWorkspace, q: string | undefined): Promise<TenantList> {
    const r = assertResidence(ws);
    const rows = await this.tenants.search(r.workspaceId, q, TENANT_SEARCH_LIMIT);
    return { tenants: await this.present(rows) };
  }

  async get(ws: ScopedWorkspace, id: string): Promise<TenantView> {
    const row = await this.owned(ws, id);
    const [view] = await this.present([row]);
    return view as TenantView;
  }

  async update(ws: ScopedWorkspace, userId: string, id: string, body: UpdateTenantRequest): Promise<TenantView> {
    const r = assertResidence(ws);
    const row = await this.owned(ws, id);
    const changed = FIELDS.filter((f) => body[f] !== undefined && (body[f] ?? null) !== (row[f] ?? null));
    if (changed.length === 0) return this.get(ws, id);

    if ((await this.tenants.signedTenantIds([id])).has(id)) {
      throw new ConflictException({
        code: 'tenant_signed',
        message: `${row.fullName} has a signed lease with you, so their details can't change. A new lease is drafted from the record as it is.`,
      });
    }
    const idKind = body.idKind ?? row.idKind;
    const idNumber = body.idNumber ?? row.idNumber;
    if ((body.idKind || body.idNumber) && idKind && idNumber) {
      const problem = idNumberProblem(idKind, idNumber);
      if (problem) {
        throw new BadRequestException({ message: 'Validation failed', issues: [{ code: 'custom', path: ['idNumber'], message: problem }] });
      }
    } else if (body.idKind && !idNumber) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: [{ code: 'custom', path: ['idNumber'], message: 'Enter the ID or passport number.' }],
      });
    }
    if (body.email && body.email !== row.email) {
      const other = await this.tenants.findByEmail(r.workspaceId, body.email);
      if (other && other.id !== id) {
        throw new ConflictException({
          code: 'tenant_email_taken',
          message: `${other.fullName} is already a tenant of yours with this email.`,
        });
      }
    }

    const values: Partial<Pick<TenantRow, Field>> = {};
    for (const f of changed) (values as Record<string, unknown>)[f] = body[f];
    const drafts = await this.tenants.draftLeaseIds(id);
    await this.db.transaction(async (tx) => {
      await this.tenants.update(tx, id, values);
      await this.audit.write(tx, {
        actorUserId: userId,
        subjectType: 'tenant',
        subjectId: id,
        eventType: 'tenant.updated',
        diff: { fields: changed },
      });
      for (const leaseId of drafts) {
        await this.events.write(tx, {
          leaseId,
          workspaceId: r.workspaceId,
          kind: 'tenant_updated',
          actorUserId: userId,
          actorRole: 'landlord',
          payload: { changed },
        });
      }
    });
    await this.contracts.refreshDrafts(drafts, userId);
    return this.get(ws, id);
  }

  private async owned(ws: ScopedWorkspace, id: string): Promise<TenantRow> {
    const r = assertResidence(ws);
    const row = await this.tenants.find(id);
    if (!row || row.workspaceId !== r.workspaceId) throw new NotFoundException('Tenant not found.');
    return row;
  }

  private async present(rows: readonly TenantRow[]): Promise<TenantView[]> {
    const ids = rows.map((t) => t.id);
    const [leases, signed] = await Promise.all([this.tenants.leasesOf(ids), this.tenants.signedTenantIds(ids)]);
    return rows.map((t) =>
      presentTenant(
        t,
        leases.filter((l) => l.tenantId === t.id),
        !signed.has(t.id),
      ),
    );
  }
}
