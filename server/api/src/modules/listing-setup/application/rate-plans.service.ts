import type { OperatorRatePlanList, WorkspaceAccess } from '@injishi/contracts';
import { Injectable } from '@nestjs/common';

import {
  type RatePlanRow,
  RatePlansRepository,
} from '../infrastructure/rate-plans.repository';

/**
 * Rate plans (ADR-035, wave 2 follow-up).
 *
 * A room type is WHAT THE GUEST GETS; a rate plan is THE TERMS IT SELLS ON. The
 * same rooms sell several ways at once, which is why a plan names its room type
 * rather than the other way round.
 *
 * READ ONLY, deliberately. `rate_plans` carries occupancy anchors, derivation
 * rules, cancellation tiers, meal plans, stay limits and discount curves —
 * writing one is a pricing decision with its own screen and its own rules
 * (F-L03, F-L05), not a form this wave should invent. Reading is the honest
 * half and it is what unblocks the lens.
 */
@Injectable()
export class RatePlansService {
  constructor(private readonly ratePlans: RatePlansRepository) {}

  async list(ws: WorkspaceAccess): Promise<OperatorRatePlanList> {
    const rows = await this.ratePlans.listForWorkspace(ws.workspaceId);
    /*
     * THE PARENT NAME IS RESOLVED HERE, not by a self join in the repository.
     * Every plan in the workspace is already in this array and a parent is
     * always one of them, so naming it is a lookup over rows in hand rather
     * than a second pass over the same table.
     *
     * A parent outside the workspace cannot happen — a derived plan follows a
     * sibling — but the name stays nullable, because a missing name must read
     * as "unknown" rather than crash the list.
     */
    const nameById = new Map(rows.map((row) => [row.id, row.name]));
    return { ratePlans: rows.map((row) => this.present(row, nameById)) };
  }

  private present(
    row: RatePlanRow,
    nameById: Map<string, string>,
  ): OperatorRatePlanList['ratePlans'][number] {
    return {
      id: row.id,
      roomTypeId: row.roomTypeId,
      roomTypeName: row.roomTypeName,
      name: row.name,
      status: row.status,
      isDefault: row.isDefault,
      basePriceRwf: row.basePriceRwf,
      cautionRwf: row.cautionRwf,
      baseOccupancy: row.baseOccupancy,
      singleOccupancyPriceRwf: row.singleOccupancyPriceRwf,
      cancellationTier:
        row.cancellationTier as OperatorRatePlanList['ratePlans'][number]['cancellationTier'],
      nonRefundable: row.nonRefundable,
      bookingMode:
        row.bookingMode as OperatorRatePlanList['ratePlans'][number]['bookingMode'],
      minStay: row.minStay,
      maxStay: row.maxStay,
      parentRatePlanId: row.parentRatePlanId,
      parentRatePlanName:
        row.parentRatePlanId === null
          ? null
          : (nameById.get(row.parentRatePlanId) ?? null),
      derivationKind:
        row.derivationKind as OperatorRatePlanList['ratePlans'][number]['derivationKind'],
      /*
       * `numeric` comes back as a STRING from postgres, deliberately, because a
       * float cannot hold every decimal exactly. It is parsed here rather than
       * shipped as a string, because the contract says number and a screen
       * doing `Number(x)` per row is the same conversion in a worse place.
       */
      derivationValue:
        row.derivationValue === null ? null : Number(row.derivationValue),
    };
  }
}
