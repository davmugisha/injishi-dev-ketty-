import {
  type AdminConfiguration,
  type AdminFeeSchedule,
  type AdminRegistrationFee,
  AppendRegistrationFeeRequest,
  CreatePsfTierRequest,
  type PsfTier,
  UpdatePsfTierRequest,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';

import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { ConfigurationAdminService } from './configuration.service';

/**
 * The admin console's Configuration section -> `/api/v1/admin/configuration`
 * (F-A10).
 *
 * `@UseGuards(SessionGuard, StaffGuard)`, in that order, for the reason stated
 * on `StaffGuard` itself: it throws a 500 rather than treating the request as
 * anonymous when the session guard did not run first, so a wiring mistake is
 * noisy instead of looking like a working control.
 *
 * READING AND CHANGING ARE TWO PERMISSIONS (ADR-053). Both reads, the settings
 * with their flags and the fee catalog, sit behind `admin.config.view`, which
 * every staff role holds: configuration is the one area all four need context
 * from, and the fee amounts live here. The writes keep their own powers,
 * `admin.fee.edit` to append a fee and `admin.config.edit` for the settings, so
 * a `finance` staffer can price and an `ops` staffer can only look.
 *
 * ROUTE ORDER IS LOAD BEARING. `fees` is declared FIRST. Nest matches in
 * declaration order, so a parameterised route added above it later — a
 * `:configType` handler is the obvious next one — would swallow `/fees` and
 * serve the fee screen a config entry whose id is the literal string "fees".
 * Keep every named route above every parameterised one.
 */
@Controller({ path: 'admin/configuration', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminConfigurationController {
  constructor(private readonly config: ConfigurationAdminService) {}

  /** The fee catalog: registration fees, subscription plans, placement totals. */
  @Get('fees')
  @RequireStaffPermission('admin.config.view')
  fees(): Promise<AdminFeeSchedule> {
    return this.config.fees();
  }

  /**
   * Append a registration fee (ADR-053, AC-R9).
   *
   * Behind `admin.fee.edit`, which `finance` and `super_admin` hold; the read
   * above is `admin.config.view`. `201`: a row is created, and it is appended
   * rather than replacing anything. A moment in the past answers 422.
   *
   * Declared above the parameterised `@Get()` for the reason this controller's
   * header gives about route order.
   */
  @Post('fees')
  @HttpCode(201)
  @RequireStaffPermission('admin.fee.edit')
  appendFee(
    @Body(new ZodValidationPipe(AppendRegistrationFeeRequest))
    body: AppendRegistrationFeeRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<AdminRegistrationFee> {
    return this.config.appendRegistrationFee({
      actorUserId: user.id,
      request: body,
    });
  }

  /** Every versioned platform setting and every feature flag. */
  /**
   * The PSF membership tier catalogue (ADR-056 AC-19), retired tiers
   * included. Written by the same staff who price the registration fee,
   * because a tier is a price.
   */
  @Get('psf-tiers')
  @RequireStaffPermission('admin.config.view')
  psfTiers(): Promise<PsfTier[]> {
    return this.config.psfTiers();
  }

  @Post('psf-tiers')
  @HttpCode(201)
  @RequireStaffPermission('admin.fee.edit')
  createPsfTier(
    @Body(new ZodValidationPipe(CreatePsfTierRequest)) body: CreatePsfTierRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<PsfTier> {
    return this.config.createPsfTier({ actorUserId: user.id, request: body });
  }

  @Patch('psf-tiers/:code')
  @RequireStaffPermission('admin.fee.edit')
  updatePsfTier(
    @Param('code') code: string,
    @Body(new ZodValidationPipe(UpdatePsfTierRequest)) body: UpdatePsfTierRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<PsfTier> {
    return this.config.updatePsfTier({ actorUserId: user.id, code, request: body });
  }

  @Get()
  @RequireStaffPermission('admin.config.view')
  configuration(): Promise<AdminConfiguration> {
    return this.config.configuration();
  }
}
