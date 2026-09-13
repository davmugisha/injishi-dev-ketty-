import {
  CreateGovernmentBodyRequest,
  type GovernmentBody,
  UpdateGovernmentBodyRequest,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { GovernmentBodiesService } from './government-bodies.service';

/**
 * The government body catalogue → `/api/v1/admin/government-bodies`
 * (ADR-053, AC-G4).
 *
 * `@UseGuards(SessionGuard, StaffGuard)` in that order: `StaffGuard` throws a 500
 * rather than treating a request as anonymous when the session guard did not
 * run. Reading is `admin.config.view`, which every staff role holds; creating,
 * renaming and retiring are `admin.config.edit`, `super_admin` alone.
 *
 * The code in the path is the body's permanent key. It is matched as sent, and
 * the create contract only ever writes capital letters, digits and underscores.
 */
@Controller({ path: 'admin/government-bodies', version: '1' })
@UseGuards(SessionGuard, StaffGuard)
export class AdminGovernmentBodiesController {
  constructor(private readonly bodies: GovernmentBodiesService) {}

  @Get()
  @RequireStaffPermission('admin.config.view')
  list(): Promise<GovernmentBody[]> {
    return this.bodies.list();
  }

  @Post()
  @HttpCode(201)
  @RequireStaffPermission('admin.config.edit')
  create(
    @Body(new ZodValidationPipe(CreateGovernmentBodyRequest))
    body: CreateGovernmentBodyRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<GovernmentBody> {
    return this.bodies.create({ actorUserId: user.id, request: body });
  }

  @Patch(':code')
  @RequireStaffPermission('admin.config.edit')
  update(
    @Param('code') code: string,
    @Body(new ZodValidationPipe(UpdateGovernmentBodyRequest))
    body: UpdateGovernmentBodyRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<GovernmentBody> {
    return this.bodies.update({ actorUserId: user.id, code, request: body });
  }
}
