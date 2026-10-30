import { PropertyLocationRequest, type RentalPropertyList, type RentalPropertyView } from '@injishi/contracts';
import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';

import { PropertiesService } from '../../../../modules/rentals/application/properties.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../../shared/validation/zod-validation.pipe';

/**
 * The landlord's buildings and where they are → /api/v1/ops/properties
 * (blueprint 2.3, `PUT properties/:id/location`). Residence businesses only.
 *
 * Read by whoever works the rentals side; the location is the listing's
 * (`listing.manage`), because it is what a tenant, a broker and the local
 * leaders who receive guest reports are told.
 */
@Controller({ path: 'ops/properties', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsRentalPropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  @RequireAnyPermission('lease.manage', 'unit.manage', 'listing.manage', 'money.view', 'rent.record', 'deposit.return', 'payout.manage', 'lease.sign')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<RentalPropertyList> {
    return this.properties.list(workspace);
  }

  @Put(':id/location')
  @RequirePermission('listing.manage')
  setLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(PropertyLocationRequest)) body: PropertyLocationRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<RentalPropertyView> {
    return this.properties.setLocation(workspace, user.id, id, body);
  }
}
