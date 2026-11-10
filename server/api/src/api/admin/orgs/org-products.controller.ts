import {
  ProductId,
  SetOrgProductRequest,
  type OrgProductsView,
  type SetOrgProductResult,
} from '@injishi/contracts';
import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';

import { EntitlementsService } from '../../../modules/entitlements/application/entitlements.service';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Which products a business runs, and switching one on or off (ADR-076 G6 to
 * G8).
 *
 * Reading is `admin.business.view`, beside the rest of a business's page.
 * Changing is its own power, `admin.business.entitlement.edit`, held by
 * `super_admin` and `ops`: it narrows or widens what a business runs, so it
 * takes a written reason, is refused while the product still has open work
 * where it would close, writes one audit row per real change and tells the
 * owner by email and in the app.
 *
 * `PUT` because the body states where the product should be on, and stating it
 * twice changes nothing the second time.
 */
@Controller({ path: 'admin/orgs', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminOrgProductsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get(':orgId/products')
  @RequireStaffPermission('admin.business.view')
  view(@Param('orgId', ParseUUIDPipe) orgId: string): Promise<OrgProductsView> {
    return this.entitlements.view(orgId);
  }

  @Put(':orgId/products/:productId')
  @RequireStaffPermission('admin.business.entitlement.edit')
  set(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('productId', new ZodValidationPipe(ProductId)) productId: ProductId,
    @Body(new ZodValidationPipe(SetOrgProductRequest)) body: SetOrgProductRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<SetOrgProductResult> {
    return this.entitlements.set(orgId, productId, body, user.id);
  }
}
