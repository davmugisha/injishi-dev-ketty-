import { TenantSearchQuery, UpdateTenantRequest, type TenantList, type TenantView } from '@injishi/contracts';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';

import { TenantsService } from '../../../../modules/rentals/application/tenants.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import { CurrentWorkspace, RequirePermission, WorkspaceGuard } from '../../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../../shared/validation/zod-validation.pipe';

/**
 * Tenants → /api/v1/ops/tenants (blueprint 2.3). A tenant record carries an
 * ID number and contact details, so it is read and changed with
 * `lease.manage` alone; the money side sees a tenant's name on the lease.
 * A record no longer changes once a contract naming the person is signed.
 */
@Controller({ path: 'ops/tenants', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsTenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @RequirePermission('lease.manage')
  search(
    @Query(new ZodValidationPipe(TenantSearchQuery)) query: TenantSearchQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<TenantList> {
    return this.tenants.search(workspace, query.q);
  }

  @Get(':id')
  @RequirePermission('lease.manage')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<TenantView> {
    return this.tenants.get(workspace, id);
  }

  @Patch(':id')
  @RequirePermission('lease.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateTenantRequest)) body: UpdateTenantRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<TenantView> {
    return this.tenants.update(workspace, user.id, id, body);
  }
}
