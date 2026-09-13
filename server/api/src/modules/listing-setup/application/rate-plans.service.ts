import type {
  CreateRatePlanRequest,
  OperatorRatePlan,
  OperatorRatePlanList,
  UpdateRatePlanRequest,
  WorkspaceAccess,
} from '@injishi/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';

import { assertContained } from '../domain/containment';
import {
  type RatePlanRow,
  RatePlansRepository,
} from '../infrastructure/rate-plans.repository';
import { RoomTypesRepository } from '../infrastructure/room-types.repository';

/**
 * Rate plans (ADR-035, wave 2 follow-up).
 *
 * A room type is WHAT THE GUEST GETS; a rate plan is THE TERMS IT SELLS ON. The
 * same rooms sell several ways at once, which is why a plan names its room type
 * rather than the other way round.
 *
 * **It was read only, and ADR-049 gave it the writes it names below.** The
 * reasoning recorded here — that a plan carries occupancy anchors, derivation
 * rules, meal plans, stay limits and discount curves, and that authoring all of
 * that is a pricing screen with its own rules (F-L03, F-L05) — still holds for
 * the RICH half. What is written here is the narrow half AC-I2 asks for: a name,
 * a price, an occupancy anchor, a cancellation tier, and which plan is the
 * default. Derivation, meal plans and discount curves stay unwritten and stay
 * F-L03's.
 */
@Injectable()
export class RatePlansService {
  constructor(
    private readonly ratePlans: RatePlansRepository,
    private readonly roomTypes: RoomTypesRepository,
  ) {}

  /** Add a plan to one of the caller's room types. */
  async create(
    workspace: WorkspaceAccess,
    roomTypeId: string,
    request: CreateRatePlanRequest,
  ): Promise<OperatorRatePlan> {
    const roomType = await this.roomTypes.find(roomTypeId);
    assertContained(roomType, workspace.workspaceId, 'Room type');

    const ratePlanId = await this.ratePlans.create({
      roomTypeId,
      workspaceId: workspace.workspaceId,
      request,
    });
    return this.read(ratePlanId);
  }

  /** Edit a plan. Making it the default moves the flag off the old one. */
  async update(
    workspace: WorkspaceAccess,
    ratePlanId: string,
    request: UpdateRatePlanRequest,
  ): Promise<OperatorRatePlan> {
    const existing = await this.ratePlans.find(ratePlanId);
    assertContained(
      existing === null
        ? null
        : { workspaceId: existing.workspaceId ?? '' },
      workspace.workspaceId,
      'Rate plan',
    );

    await this.ratePlans.update({
      ratePlanId,
      roomTypeId: (existing as RatePlanRow).roomTypeId,
      request,
    });
    return this.read(ratePlanId);
  }

  /** One plan, read back after a write through the same shape the list uses. */
  private async read(ratePlanId: string): Promise<OperatorRatePlan> {
    const row = await this.ratePlans.find(ratePlanId);
    if (!row) throw new NotFoundException('No such rate plan.');
    // A single read has no sibling array to name a parent from, and a parent is
    // always a sibling, so it reads as unknown rather than triggering a second
    // query for a field this screen does not edit.
    return this.present(row, new Map());
  }

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
