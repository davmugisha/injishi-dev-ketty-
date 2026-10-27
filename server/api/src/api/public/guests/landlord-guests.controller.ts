import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { type HostGuest, HostGuestQuery, type LandlordGuestList, LandlordGuestRequest } from '@injishi/contracts';

import { GuestRegistryService } from '../../../modules/guests/application/guest-registry.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { CurrentWorkspace, RequirePermission, WorkspaceGuard } from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The landlord's own guests → /api/v1/ops/guests (P5, blueprint 2.3).
 *
 * A residence business only (404 otherwise), `guest.register` on every
 * route, and only the buildings the member covers. These are guests staying
 * with the landlord at one of their buildings; a tenant's guests are never
 * read or approved here.
 */
@Controller({ path: 'ops/guests', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsGuestsController {
  constructor(private readonly guests: GuestRegistryService) {}

  @Get()
  @RequirePermission('guest.register')
  list(
    @Query(new ZodValidationPipe(HostGuestQuery)) query: HostGuestQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<LandlordGuestList> {
    return this.guests.landlordList(workspace, query);
  }

  @Post()
  @HttpCode(201)
  @RequirePermission('guest.register')
  register(
    @Body(new ZodValidationPipe(LandlordGuestRequest)) body: LandlordGuestRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<HostGuest> {
    return this.guests.landlordRegister(workspace, user.id, body);
  }

  @Patch(':id')
  @RequirePermission('guest.register')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(LandlordGuestRequest)) body: LandlordGuestRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<HostGuest> {
    return this.guests.landlordUpdate(workspace, user.id, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('guest.register')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<HostGuest> {
    return this.guests.landlordCancel(workspace, user.id, id);
  }
}
