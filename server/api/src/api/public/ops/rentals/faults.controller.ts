import {
  AssignFaultRequest,
  FAULT_PHOTO_MAX_BYTES,
  FAULT_PHOTOS_PER_PHASE,
  FaultListQuery,
  FaultMessageRequest,
  FaultPhotoFields,
  MoveFaultRequest,
  RaiseFaultRequest,
  type FaultDetail,
  type FaultListPage,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';

import { FaultsService } from '../../../../modules/rentals/application/faults.service';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import { CurrentWorkspace, RequirePermission, WorkspaceGuard } from '../../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../../shared/validation/zod-validation.pipe';
import { UploadThrottlerGuard } from '../../uploads/upload-throttler.guard';
import { normaliseFormFields, parseFields, readForm, type FormRequest } from './multipart-form';

const PHOTO_LIMITS = { maxFiles: FAULT_PHOTOS_PER_PHASE, maxBytes: FAULT_PHOTO_MAX_BYTES, what: 'A photo' } as const;

/**
 * Faults → /api/v1/ops/faults (blueprint 2.3 "Faults", WP 4.1). Residence
 * businesses only, and every route is `ticket.advance`: whoever works the
 * faults reads them, moves them, hands them over, adds photos and writes on
 * them. A reply the tenant sees also needs `message.send` (the service
 * checks). Paying the fixer is `expense.manage` (WP 4.3). Moves the chain
 * refuses are 409; "won't fix" needs the reason.
 *
 * Raising a fault and adding photos take multipart/form-data (the fields
 * beside up to four photos, `photos`), or JSON when there is no photo.
 */
@Controller({ path: 'ops/faults', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsFaultsController {
  constructor(private readonly faults: FaultsService) {}

  @Get()
  @RequirePermission('ticket.advance')
  list(@Query(new ZodValidationPipe(FaultListQuery)) query: FaultListQuery, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<FaultListPage> {
    return this.faults.list(workspace, query);
  }

  @Get(':id')
  @RequirePermission('ticket.advance')
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<FaultDetail> {
    return this.faults.detail(workspace, id);
  }

  /** The landlord writes down a fault on a unit, with photos. */
  @Post()
  @RequirePermission('ticket.advance')
  @UseGuards(UploadThrottlerGuard)
  async raise(@Req() request: FormRequest, @CurrentWorkspace() workspace: ScopedWorkspace, @CurrentUser() user: SessionUser): Promise<FaultDetail> {
    const form = await readForm(request, PHOTO_LIMITS);
    const body = parseFields(RaiseFaultRequest, normaliseFormFields(form.fields));
    return this.faults.raise(workspace, user.id, body, form.files.map((f) => ({ filename: f.filename, body: f.body })));
  }

  @Post(':id/move')
  @HttpCode(200)
  @RequirePermission('ticket.advance')
  move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(MoveFaultRequest)) body: MoveFaultRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FaultDetail> {
    return this.faults.move(workspace, user.id, id, body);
  }

  @Post(':id/assign')
  @HttpCode(200)
  @RequirePermission('ticket.advance')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AssignFaultRequest)) body: AssignFaultRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FaultDetail> {
    return this.faults.assign(workspace, user.id, id, body);
  }

  /** Photos of the report, the work or the fix (`phase`), at most four in each. */
  @Post(':id/photos')
  @HttpCode(200)
  @RequirePermission('ticket.advance')
  @UseGuards(UploadThrottlerGuard)
  async photos(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: FormRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FaultDetail> {
    const form = await readForm(request, PHOTO_LIMITS);
    const { phase } = parseFields(FaultPhotoFields, normaliseFormFields(form.fields));
    return this.faults.addPhotos(workspace, user.id, id, phase, form.files.map((f) => ({ filename: f.filename, body: f.body })));
  }

  @Post(':id/messages')
  @HttpCode(200)
  @RequirePermission('ticket.advance')
  message(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(FaultMessageRequest)) body: FaultMessageRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FaultDetail> {
    return this.faults.message(workspace, user.id, id, body);
  }
}
