import {
  CreatePayComponentRequest,
  type CreatePayStructureRequest,
  type PayComponent,
  type PayComponentList,
  type PayStructure,
  type PayStructureList,
  type UpdatePayComponentRequest,
  type UpdatePayStructureRequest,
} from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { violatedConstraint, type Tx } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { PayItemsRepository, type ComponentRow, type ComponentValues } from '../infrastructure/pay-items.repository';
import { orgOf } from './hr-access';

/**
 * Pay components and pay structures (058-payroll AC-PY5). Everything here is
 * `payroll.run`'s. A component is archived, never deleted: a confirmed payslip
 * names it by code in its lines. An edit applies to the next computation; a
 * confirmed run keeps what it computed.
 */
@Injectable()
export class PayComponentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly items: PayItemsRepository,
  ) {}

  async list(ws: ScopedWorkspace): Promise<PayComponentList> {
    const orgId = orgOf(ws);
    const rows = await this.items.components(orgId);
    const [targets, structures] = await Promise.all([this.items.targets(rows.map((r) => r.id)), this.items.structures(orgId)]);
    return {
      components: rows.map((r) => presentComponent(r, targets.filter((t) => t.componentId === r.id), structures.filter((s) => s.componentIds.includes(r.id)).map((s) => s.id))),
    };
  }

  async create(ws: ScopedWorkspace, userId: string, body: CreatePayComponentRequest): Promise<PayComponent> {
    const orgId = orgOf(ws);
    const { code, targets, ...rest } = body;
    await this.assertTargets(orgId, targets ?? []);
    const values = allValuesOf(rest);
    const id = await this.db.transaction(async (tx) => {
      let created: string;
      try {
        created = await this.items.insertComponent(tx, { orgId, code, createdByUserId: userId, ...values });
      } catch (error) {
        if (violatedConstraint(error) === 'pay_components_code_uk') throw new ConflictException(`A component with the code ${code} exists here already.`);
        throw error;
      }
      await this.items.replaceTargets(tx, orgId, created, targets ?? []);
      await this.audit(tx, userId, orgId, 'hr.pay_component_created', { componentId: created, code, ...values, targets: (targets ?? []).length });
      return created;
    });
    return this.present(orgId, id);
  }

  async update(ws: ScopedWorkspace, userId: string, id: string, body: UpdatePayComponentRequest): Promise<PayComponent> {
    const orgId = orgOf(ws);
    const row = assertOwnedByOrg(await this.items.findComponent(id), ws);
    const { status, targets, ...changes } = body;
    const merged = { ...rulesOf(row), ...changes };
    // The cross field rules read the whole component, not just this edit.
    const check = CreatePayComponentRequest.safeParse({ ...merged, code: row.code });
    if (!check.success) throw new UnprocessableEntityException(check.error.issues[0]?.message ?? 'Those rules do not fit together.');
    if (targets) await this.assertTargets(orgId, targets);
    await this.db.transaction(async (tx) => {
      try {
        await this.items.updateComponent(tx, id, { ...valuesOf(changes), ...(status ? { status } : {}) });
      } catch (error) {
        if (violatedConstraint(error) === 'pay_components_code_uk') throw new ConflictException(`An active component already has the code ${row.code}.`);
        throw error;
      }
      if (targets) await this.items.replaceTargets(tx, orgId, id, targets);
      await this.audit(tx, userId, orgId, 'hr.pay_component_updated', { componentId: id, code: row.code, ...changes, ...(status ? { status } : {}), ...(targets ? { targets: targets.length } : {}) });
    });
    return this.present(orgId, id);
  }

  async structures(ws: ScopedWorkspace): Promise<PayStructureList> {
    return { structures: (await this.items.structures(orgOf(ws))).map(presentStructure) };
  }

  async createStructure(ws: ScopedWorkspace, userId: string, body: CreatePayStructureRequest): Promise<PayStructure> {
    const orgId = orgOf(ws);
    await this.assertComponents(orgId, body.componentIds);
    const id = await this.db.transaction(async (tx) => {
      let created: string;
      try {
        created = await this.items.insertStructure(tx, orgId, body.name.trim());
      } catch (error) {
        if (violatedConstraint(error) === 'pay_structures_name_uk') throw new ConflictException(`A structure called ${body.name.trim()} exists here already.`);
        throw error;
      }
      await this.items.replaceStructureComponents(tx, orgId, created, body.componentIds);
      await this.audit(tx, userId, orgId, 'hr.pay_structure_created', { structureId: created, name: body.name.trim(), components: body.componentIds.length });
      return created;
    });
    return this.presentStructure(orgId, id);
  }

  async updateStructure(ws: ScopedWorkspace, userId: string, id: string, body: UpdatePayStructureRequest): Promise<PayStructure> {
    const orgId = orgOf(ws);
    assertOwnedByOrg(await this.items.findStructure(id), ws);
    if (body.componentIds) await this.assertComponents(orgId, body.componentIds);
    await this.db.transaction(async (tx) => {
      try {
        await this.items.updateStructure(tx, id, { ...(body.name ? { name: body.name.trim() } : {}), ...(body.status ? { status: body.status } : {}) });
      } catch (error) {
        if (violatedConstraint(error) === 'pay_structures_name_uk') throw new ConflictException('An active structure already has that name.');
        throw error;
      }
      if (body.componentIds) await this.items.replaceStructureComponents(tx, orgId, id, body.componentIds);
      await this.audit(tx, userId, orgId, 'hr.pay_structure_updated', { structureId: id, ...body, ...(body.componentIds ? { componentIds: body.componentIds.length } : {}) });
    });
    return this.presentStructure(orgId, id);
  }

  private async assertTargets(orgId: string, targets: readonly { employeeId: string }[]): Promise<void> {
    const ids = [...new Set(targets.map((t) => t.employeeId))];
    const own = await this.items.ownEmployees(orgId, ids);
    if (own.length !== ids.length) throw new UnprocessableEntityException('A person named is not on this business\'s files.');
  }

  private async assertComponents(orgId: string, ids: readonly string[]): Promise<void> {
    if ((await this.items.ownComponents(orgId, ids)) !== new Set(ids).size) {
      throw new UnprocessableEntityException('A component named is not this business\'s.');
    }
  }

  private async present(orgId: string, id: string): Promise<PayComponent> {
    const row = await this.items.findComponent(id);
    if (!row) throw new NotFoundException();
    const [targets, structures] = await Promise.all([this.items.targets([id]), this.items.structures(orgId)]);
    return presentComponent(row, targets, structures.filter((s) => s.componentIds.includes(id)).map((s) => s.id));
  }

  private async presentStructure(orgId: string, id: string): Promise<PayStructure> {
    const found = (await this.items.structures(orgId)).find((s) => s.id === id);
    if (!found) throw new NotFoundException();
    return presentStructure(found);
  }

  private async audit(tx: Tx, userId: string, orgId: string, eventType: string, diff: Record<string, unknown>): Promise<void> {
    await writeHrAudit(tx, { actorUserId: userId, subjectType: 'org', subjectId: orgId, eventType, orgId, diff });
  }
}

/** The request's rule fields as the table takes them. */
/** Every column a new component writes, from a create request that carries them all. */
function allValuesOf(b: Omit<CreatePayComponentRequest, 'code' | 'targets'>): ComponentValues {
  return {
    name: b.name.trim(),
    kind: b.kind,
    taxable: b.taxable,
    inContributionBase: b.inContributionBase,
    beforeTax: b.beforeTax,
    amountType: b.amountType,
    amountRwf: b.amountRwf,
    rate: b.rate,
    capRwf: b.capRwf,
    conditionField: b.condition?.field ?? null,
    conditionOp: b.condition?.op ?? null,
    conditionValue: b.condition?.value ?? null,
    appliesAllActive: b.appliesAllActive,
    oneOffPeriod: b.oneOffPeriod,
  };
}

function valuesOf(b: Partial<Omit<CreatePayComponentRequest, 'code' | 'targets'>>): Partial<ComponentValues> {
  const out: Partial<ComponentValues> = {};
  if (b.name !== undefined) out.name = b.name.trim();
  if (b.kind !== undefined) out.kind = b.kind;
  if (b.taxable !== undefined) out.taxable = b.taxable;
  if (b.inContributionBase !== undefined) out.inContributionBase = b.inContributionBase;
  if (b.beforeTax !== undefined) out.beforeTax = b.beforeTax;
  if (b.amountType !== undefined) out.amountType = b.amountType;
  if (b.amountRwf !== undefined) out.amountRwf = b.amountRwf;
  if (b.rate !== undefined) out.rate = b.rate;
  if (b.capRwf !== undefined) out.capRwf = b.capRwf;
  if (b.condition !== undefined) {
    out.conditionField = b.condition?.field ?? null;
    out.conditionOp = b.condition?.op ?? null;
    out.conditionValue = b.condition?.value ?? null;
  }
  if (b.appliesAllActive !== undefined) out.appliesAllActive = b.appliesAllActive;
  if (b.oneOffPeriod !== undefined) out.oneOffPeriod = b.oneOffPeriod;
  return out;
}

function rulesOf(row: ComponentRow): Omit<CreatePayComponentRequest, 'code' | 'targets'> {
  return {
    name: row.name,
    kind: row.kind,
    taxable: row.taxable,
    inContributionBase: row.inContributionBase,
    beforeTax: row.beforeTax,
    amountType: row.amountType,
    amountRwf: row.amountRwf,
    rate: row.rate,
    capRwf: row.capRwf,
    condition: row.conditionField && row.conditionOp && row.conditionValue ? { field: row.conditionField, op: row.conditionOp, value: row.conditionValue } : null,
    appliesAllActive: row.appliesAllActive,
    oneOffPeriod: row.oneOffPeriod,
  };
}

function presentComponent(row: ComponentRow, targets: readonly { employeeId: string; displayName: string; mode: 'include' | 'exclude' }[], structureIds: string[]): PayComponent {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    ...rulesOf(row),
    targets: targets.map((t) => ({ employeeId: t.employeeId, displayName: t.displayName, mode: t.mode })),
    structureIds,
  };
}

function presentStructure(s: { id: string; name: string; status: 'active' | 'archived'; componentIds: string[]; contractCount: number }): PayStructure {
  return { id: s.id, name: s.name, status: s.status, componentIds: s.componentIds, contractCount: s.contractCount };
}
