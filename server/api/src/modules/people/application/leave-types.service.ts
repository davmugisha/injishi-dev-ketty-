import {
  CreateLeaveTypeRequest,
  type ApplyLeaveDefaultsRequest,
  type LeaveDefaultsDiff,
  type LeaveType,
  type LeaveTypeList,
  type UpdateLeaveTypeRequest,
} from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { assertOwnedByOrg } from '../../../shared/auth/assert-owned';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { kigaliToday } from '../domain/hr-calendar';
import { HR_RULE, missingRuleMessage, type HrRuleRow, type LeaveDefaultsRule } from '../domain/hr-rules';
import { violatedConstraint, type Tx } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { HrRulesRepository } from '../infrastructure/hr-rules.repository';
import { LeaveRepository, rulesOf, type LeaveTypeRow, type LeaveTypeRules } from '../infrastructure/leave.repository';
import { orgOf } from './hr-access';
import { LeaveService, presentType } from './leave.service';

/** The rules a type carries, in the order the defaults diff lists them. */
const RULE_FIELDS = [
  'name',
  'payment',
  'paymentPercent',
  'yearlyEntitlementDays',
  'accrual',
  'reset',
  'carry',
  'carryMaxDays',
  'carryExpiresMonths',
  'approvalSteps',
  'needsAttachment',
  'countsWeeklyOffs',
  'countsHolidays',
  'eligibleSex',
  'minServiceMonths',
  'oncePerEmployment',
  'statutory',
  'allowsPastRequests',
  'encashable',
  'compensatory',
  'seniorityEveryYears',
  'seniorityExtraDays',
  'seniorityCapDays',
] as const satisfies readonly (keyof LeaveTypeRules)[];

/**
 * Leave types (058-leave AC-LV1, AC-LV12): a business's own types, edited by
 * `people.manage`, and the national defaults compared with them.
 *
 * A type is archived, never deleted, because requests and the ledger name it. An edit
 * applies to requests made after it, because a request copies its type's steps
 * and pay terms as it is made, and no ledger row is ever rewritten. Whether a
 * type keeps a balance at all is fixed once anything names it: switching it
 * would leave a ledger that sums to a figure the type says it does not keep.
 */
@Injectable()
export class LeaveTypesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly leave: LeaveRepository,
    private readonly rules: HrRulesRepository,
    private readonly leaveService: LeaveService,
  ) {}

  /** `GET /ops/leave/types`: every type, archived ones too, created from the defaults the first time. */
  async list(ws: ScopedWorkspace): Promise<LeaveTypeList> {
    const orgId = orgOf(ws);
    await this.leaveService.ensureTypes(orgId);
    return { types: (await this.leave.listTypes(orgId, undefined, true)).map(presentType) };
  }

  /** `POST /ops/leave/types`: the business's own type, beside the national ones. */
  async create(ws: ScopedWorkspace, userId: string, body: CreateLeaveTypeRequest): Promise<LeaveType> {
    const orgId = orgOf(ws);
    await this.leaveService.ensureTypes(orgId);
    const { code, ...rules } = body;
    const id = await this.db.transaction(async (tx) => {
      if (rules.compensatory) await this.assertOneCompensatory(orgId, null, tx);
      let created: string;
      try {
        created = await this.leave.insertType(tx, { orgId, code, ...rules, configEntryId: null });
      } catch (error) {
        if (violatedConstraint(error) !== null) throw new ConflictException(`A leave type with the code ${code} exists here already.`);
        throw error;
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.leave_type_created',
        orgId,
        diff: { leaveTypeId: created, code, ...rules },
      });
      return created;
    });
    return this.present(id);
  }

  /** `PATCH /ops/leave/types/:id`: whole rule groups, checked again against what the type already has. */
  async update(ws: ScopedWorkspace, userId: string, id: string, body: UpdateLeaveTypeRequest): Promise<LeaveType> {
    const orgId = orgOf(ws);
    const type = assertOwnedByOrg(await this.leave.findType(id), ws);
    const { status, ...changes } = body;
    const merged = { ...rulesOfRow(type), ...changes };
    // The cross field checks read the whole type, not just what this edit sends.
    const check = CreateLeaveTypeRequest.safeParse({ ...merged, code: type.code });
    if (!check.success) throw new UnprocessableEntityException(check.error.issues[0]?.message ?? 'Those rules do not fit together.');
    await this.db.transaction(async (tx) => {
      const keepsBalance = (r: { yearlyEntitlementDays: number | null }): boolean => r.yearlyEntitlementDays !== null;
      if (keepsBalance(merged) !== keepsBalance(type) && (await this.leave.typeInUse(id, tx))) {
        throw new ConflictException(
          `${type.name} is already used, so whether it keeps a balance cannot change now. Archive it and make a new type instead.`,
        );
      }
      if (merged.compensatory && (status ?? type.status) === 'active') await this.assertOneCompensatory(orgId, id, tx);
      await this.leave.updateType(tx, id, { ...changes, ...(status ? { status } : {}) });
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.leave_type_updated',
        orgId,
        diff: { leaveTypeId: id, code: type.code, ...changes, ...(status ? { status } : {}) },
      });
    });
    return this.present(id);
  }

  /**
   * `GET /ops/leave/types/defaults`: what the national row in force says that
   * the business's types do not (AC-LV12). An archived type counts as had: the
   * business chose to stop offering it.
   */
  async defaultsDiff(ws: ScopedWorkspace): Promise<LeaveDefaultsDiff> {
    const orgId = orgOf(ws);
    await this.leaveService.ensureTypes(orgId);
    const defaults = await this.defaultsInForce();
    const own = await this.leave.listTypes(orgId, undefined, true);
    const missing: LeaveDefaultsDiff['missing'] = [];
    const changed: LeaveDefaultsDiff['changed'] = [];
    for (const d of defaults.value.types) {
      const type = own.find((t) => t.code === d.code);
      if (!type) {
        missing.push({ code: d.code, name: d.name });
        continue;
      }
      const wanted = rulesOf(d);
      for (const field of RULE_FIELDS) {
        if (wanted[field] !== type[field]) {
          changed.push({ code: d.code, name: type.name, field, current: type[field], defaults: wanted[field] });
        }
      }
    }
    return { configEntryId: defaults.configEntryId, version: defaults.version, missing, changed };
  }

  /**
   * `POST /ops/leave/types/defaults/apply`: missing types are added, and a type
   * already here takes the defaults' rules from now on. Nothing is deleted and
   * no ledger row is rewritten: an accrual already written stays as it was, and
   * the next period's is counted at the new entitlement.
   */
  async applyDefaults(ws: ScopedWorkspace, userId: string, body: ApplyLeaveDefaultsRequest): Promise<LeaveTypeList> {
    const orgId = orgOf(ws);
    await this.leaveService.ensureTypes(orgId);
    const defaults = await this.defaultsInForce();
    const unknown = body.codes.filter((c) => !defaults.value.types.some((d) => d.code === c));
    if (unknown.length > 0) throw new UnprocessableEntityException(`The defaults have no type ${unknown.join(', ')}.`);
    await this.db.transaction(async (tx) => {
      const own = await this.leave.listTypes(orgId, tx, true);
      for (const code of new Set(body.codes)) {
        const d = defaults.value.types.find((t) => t.code === code);
        if (!d) continue;
        const wanted = rulesOf(d);
        const type = own.find((t) => t.code === code);
        if (wanted.compensatory) await this.assertOneCompensatory(orgId, type?.id ?? null, tx);
        if (!type) {
          await this.leave.insertType(tx, { orgId, code, ...wanted, configEntryId: defaults.configEntryId });
        } else {
          if ((wanted.yearlyEntitlementDays !== null) !== (type.yearlyEntitlementDays !== null) && (await this.leave.typeInUse(type.id, tx))) {
            throw new ConflictException(`${type.name} is already used, so whether it keeps a balance cannot change now. Leave it out of this apply.`);
          }
          await this.leave.updateType(tx, type.id, { ...wanted, configEntryId: defaults.configEntryId });
        }
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.leave_defaults_applied',
        orgId,
        diff: { configEntryId: defaults.configEntryId, version: defaults.version, codes: [...new Set(body.codes)] },
      });
    });
    return { types: (await this.leave.listTypes(orgId, undefined, true)).map(presentType) };
  }

  private async defaultsInForce(): Promise<HrRuleRow<LeaveDefaultsRule>> {
    const today = kigaliToday();
    const defaults = await this.rules.leaveDefaults(today);
    if (!defaults) throw new ConflictException(missingRuleMessage(HR_RULE.leaveDefaults, today));
    return defaults;
  }

  /** Compensatory days land in one type, so only one active type may take them (AC-LV8). */
  private async assertOneCompensatory(orgId: string, exceptId: string | null, tx: Tx): Promise<void> {
    const other = (await this.leave.listTypes(orgId, tx)).find((t) => t.compensatory && t.id !== exceptId);
    if (other) throw new ConflictException(`${other.name} already takes compensatory days. Only one type does.`);
  }

  private async present(id: string): Promise<LeaveType> {
    const row = await this.leave.findType(id);
    if (!row) throw new NotFoundException();
    return presentType(row);
  }
}

function rulesOfRow(row: LeaveTypeRow): LeaveTypeRules {
  const rules = {} as Record<string, unknown>;
  for (const field of RULE_FIELDS) rules[field] = row[field];
  return rules as unknown as LeaveTypeRules;
}
