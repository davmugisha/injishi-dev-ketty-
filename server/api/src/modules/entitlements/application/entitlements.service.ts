import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ENTITLED_PRODUCTS,
  ENTITLEMENT_LEVEL,
  ENTITLEMENT_REASON_MIN_LENGTH,
  PRODUCT_LABEL,
  type EntitlementRefusalCode,
  type OrgProductsView,
  type ProductId,
  type SetOrgProductRequest,
  type SetOrgProductResult,
} from '@injishi/contracts';

import { AuditWriter } from '../../../shared/audit/audit-writer';
import { isNoop, isOnAt, isOnEveryBranch, planEntitlementChange } from '../../../shared/entitlements/entitlement-rules';
import { entitlementNotice, type EntitlementNotice } from '../domain/entitlement-notice';
import { EntitlementMailer } from '../infrastructure/entitlement.mailer';
import { EntitlementsRepository } from '../infrastructure/entitlements.repository';

/**
 * Which products a business runs, as Injishi staff read and change it
 * (ADR-076 G6 to G8).
 *
 * A change happens in ONE transaction holding the org's row: the plan, the
 * refusal while work is open, the rows closed and opened, the audit row and
 * the owner's in app notice either all land or none does. The email goes
 * after the commit and can only fail on its own.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly repo: EntitlementsRepository,
    private readonly mailer: EntitlementMailer,
  ) {}

  /** Every row, open and closed, and where each product is on, by the guard's own rule. */
  async view(orgId: string): Promise<OrgProductsView> {
    const org = await this.repo.org(orgId);
    if (!org) throw new NotFoundException('No business has that id.');
    const [rows, branches] = await Promise.all([this.repo.rows(orgId), this.repo.activeBranches(orgId)]);
    const open = rows.filter((row) => row.disabledAt === null);
    return {
      orgId,
      rows,
      resolved: ENTITLED_PRODUCTS.map((productId) => ({
        productId,
        label: PRODUCT_LABEL[productId],
        level: ENTITLEMENT_LEVEL[productId],
        everyBranch: isOnEveryBranch(open, productId),
        branches: branches.map((branch) => ({
          propertyId: branch.id,
          name: branch.name,
          on: isOnAt(open, productId, branch.id),
        })),
      })),
    };
  }

  /**
   * Set where one product is on, with a reason. A request for what is already
   * true writes nothing, not even an audit row.
   */
  async set(
    orgId: string,
    productId: ProductId,
    request: SetOrgProductRequest,
    actorUserId: string,
  ): Promise<SetOrgProductResult> {
    const reason = request.reason.trim();
    if (reason.length < ENTITLEMENT_REASON_MIN_LENGTH) {
      throw refused(
        'reason_required',
        `Say why, in at least ${ENTITLEMENT_REASON_MIN_LENGTH} characters. The owner is told the reason.`,
      );
    }

    const org = await this.repo.org(orgId);
    if (!org) throw new NotFoundException('No business has that id.');

    const outcome = await this.repo.inOrgTransaction(orgId, async (tx) => {
      const branches = await this.repo.activeBranches(orgId, tx);
      const byId = new Map(branches.map((b) => [b.id.toLowerCase(), b]));
      const named = request.branchIds?.map((id) => byId.get(id.toLowerCase()));
      if (named && named.some((branch) => branch === undefined)) {
        throw refused('branch_invalid', 'A branch named is not an active branch of this business.');
      }

      const openRows = await this.repo.openRows(tx, orgId, productId);
      const planned = planEntitlementChange({
        product: productId,
        state: request.state,
        branchIds: named ? named.map((b) => b!.id) : null,
        openRows,
        activeBranchIds: branches.map((b) => b.id),
      });
      if (!planned.ok) throw refused(planned.code, planned.message);
      if (isNoop(planned.plan)) return { changed: false as const };

      // Switching off waits for open work to finish there, as archiving a
      // branch does (ADR-054): a guest in house, an order not delivered, a
      // draft pay run.
      if (request.state === 'off') {
        const reasons = await this.repo.openWork(tx, {
          orgId,
          productId,
          propertyIds: named ? named.map((b) => b!.id) : null,
        });
        if (reasons.length > 0) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            code: 'product_in_use',
            message: `${PRODUCT_LABEL[productId]} still has open work there, so it cannot be switched off yet.`,
            reasons,
          });
        }
      }

      const opened = await this.repo.applyPlan(tx, {
        orgId,
        productId,
        plan: planned.plan,
        actorUserId,
        reason,
      });

      await AuditWriter.write(tx, {
        actorUserId,
        subjectType: 'entitlement',
        subjectId: opened[0] ?? planned.plan.close[0] ?? null,
        eventType: request.state === 'on' ? 'admin.org.product_on' : 'admin.org.product_off',
        payloadDiff: {
          orgId,
          productId,
          branchIds: request.branchIds,
          before: openRows.map((row) => row.propertyId),
          closed: planned.plan.close,
          opened,
        },
        reason,
      });

      const owners = await this.repo.owners(tx, orgId);
      const notices: { to: string; notice: EntitlementNotice }[] = [];
      for (const owner of owners) {
        const notice = entitlementNotice({
          businessName: org.legalName,
          productId,
          state: request.state,
          branchNames: named ? named.map((b) => b!.name) : null,
          reason,
          locale: owner.locale,
        });
        await this.repo.notify(tx, {
          userId: owner.userId,
          workspaceId: org.workspaceId,
          title: notice.title,
          body: notice.body,
        });
        notices.push({ to: owner.email, notice });
      }
      return { changed: true as const, notices };
    });

    if (outcome === null) throw new NotFoundException('No business has that id.');
    if (outcome.changed) {
      await Promise.all(outcome.notices.map(({ to, notice }) => this.mailer.send(orgId, to, notice)));
    }
    const rows = await this.repo.rows(orgId);
    return {
      changed: outcome.changed,
      open: rows.filter((row) => row.productId === productId && row.disabledAt === null),
    };
  }
}

function refused(code: EntitlementRefusalCode, message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({
    statusCode: 422,
    error: 'Unprocessable Entity',
    code,
    message,
  });
}
