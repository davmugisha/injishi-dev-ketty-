import {
  CreatePropertyRequest,
  type OperatorProperty,
  type OperatorPropertyList,
  type OperatorRatePlanList,
  PropertyQuery,
  UpdatePropertyRequest,
  type WorkspaceAccess,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { InventoryService } from '../../../modules/listing-setup/application/inventory.service';
import { RatePlansService } from '../../../modules/listing-setup/application/rate-plans.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Inventory authoring → /api/v1/inventory/* (ADR-009, F-S04 / F-B01).
 *
 * DELIBERATELY NOT UNDER `/api/v1/properties`. That path is the public,
 * unauthenticated read of a PUBLISHED property, and an operator has to be able
 * to read a draft. Two different questions get two different paths, rather than
 * one path that changes meaning depending on whether a cookie was sent.
 *
 * Every route composes `@UseGuards(SessionGuard, WorkspaceGuard)` and declares
 * `listing.manage`. A business that is not `active` holds no permissions at all
 * (D20), so the whole surface is closed to it without a single extra check.
 *
 * The guard proves the caller HOLDS the workspace they named. It does not prove
 * the `:id` belongs to that workspace; `InventoryService` does that (AC-14).
 */
@Controller({ path: 'inventory', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequirePermission('listing.manage')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly ratePlans: RatePlansService,
  ) {}

  /**
   * Every rate plan in this workspace (ADR-035, wave 2 follow-up).
   *
   * **This route did not exist**, which is why the Rate plans lens was a
   * placeholder while `rate_plans` sat there fully specified.
   *
   * It takes NO `workspaceId` query parameter, unlike its neighbours on this
   * controller. Theirs is validated and then discarded — the header is what
   * `WorkspaceGuard` actually reads — and repeating that here would be
   * copying a defect forward. The redundancy on the others is recorded as
   * owed rather than spread.
   */
  @Get('rate-plans')
  listRatePlans(
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorRatePlanList> {
    return this.ratePlans.list(workspace);
  }

  /** Every property in this workspace, with its listing state. */
  @Get('properties')
  async listProperties(
    @Query(new ZodValidationPipe(PropertyQuery)) _query: PropertyQuery,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorPropertyList> {
    return { properties: await this.inventory.listProperties(workspace) };
  }

  /**
   * Create a property, and its draft listing with it.
   *
   * Draft is the only state it can be created in: publishing is a separate act
   * with its own rules, and a property that arrived already visible would have
   * skipped every one of them.
   */
  @Post('properties')
  createProperty(
    @Body(new ZodValidationPipe(CreatePropertyRequest))
    body: CreatePropertyRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorProperty> {
    return this.inventory.createProperty(workspace, body);
  }

  /** One property in full, draft or published. */
  @Get('properties/:id')
  getProperty(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(PropertyQuery)) _query: PropertyQuery,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorProperty> {
    return this.inventory.getProperty(workspace, id);
  }

  /** Edit a property. Only the fields sent are replaced. */
  @Patch('properties/:id')
  updateProperty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePropertyRequest))
    body: UpdatePropertyRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorProperty> {
    return this.inventory.updateProperty(workspace, id, body);
  }
}
