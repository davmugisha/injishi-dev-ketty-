import {
  AddAmenityRequest,
  type OperatorAmenityList,
  PropertyScopedQuery,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AmenitiesService } from '../../../modules/operations/application/amenities.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * What a property offers → /api/v1/ops/amenities (ADR-012 step 4).
 *
 * Scoped to a PROPERTY on every route, read and write alike. A workspace can
 * hold several properties, and a read that skipped the property check would let
 * a caller enumerate a competitor's offering one id at a time — which the
 * workspace guard cannot catch, because the workspace they named is theirs.
 *
 * `property_amenities` has a composite primary key and no id of its own, so the
 * delete names the amenity CODE rather than a row id. That is the row's real
 * identity; inventing a surrogate one for the URL would be a second name for
 * the same thing.
 */
@Controller({ path: 'ops/amenities', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsAmenitiesController {
  constructor(private readonly amenities: AmenitiesService) {}

  /**
   * The whole catalog, flagged with what this property offers.
   *
   * Read by the inventory Offer lens (`listing.manage`; a landlord's Units
   * leaf grants it under `unit.manage`), by the Outlets lens, which labels an
   * outlet's amenities (`outlet.manage`), and by that same lens under Services,
   * which a receptionist opens (`order.advance`).
   */
  @Get()
  @RequireAnyPermission(
    'listing.manage',
    'amenity.manage',
    'unit.manage',
    'outlet.manage',
    'order.advance',
  )
  async list(
    @Query(new ZodValidationPipe(PropertyScopedQuery))
    query: PropertyScopedQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorAmenityList> {
    return {
      amenities: await this.amenities.list(workspace, query.propertyId),
    };
  }

  /** Start offering one. Doing it twice is the same fact, not an error. */
  @Post()
  @RequirePermission('amenity.manage')
  async add(
    @Body(new ZodValidationPipe(AddAmenityRequest)) body: AddAmenityRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorAmenityList> {
    return { amenities: await this.amenities.add(workspace, body) };
  }

  /** Stop offering one. Removing one never offered is also not an error. */
  @Delete(':code')
  @RequirePermission('amenity.manage')
  async remove(
    @Param('code') code: string,
    @Query(new ZodValidationPipe(PropertyScopedQuery))
    query: PropertyScopedQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorAmenityList> {
    return {
      amenities: await this.amenities.remove(workspace, query.propertyId, code),
    };
  }
}
