import {
  FAULT_PHOTO_MAX_BYTES,
  FAULT_PHOTOS_PER_PHASE,
  ReopenFaultRequest,
  ReportFaultRequest,
  TenantFaultMessageRequest,
  type TenantFaultDetail,
  type TenantFaultList,
} from '@injishi/contracts';
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { TenantFaultsService } from '../../../modules/rentals/application/tenant-faults.service';
import type { TenancyRef } from '../../../modules/rentals/application/tenancies.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { UserThrottlerGuard } from '../../../shared/http/user-throttler.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { normaliseFormFields, parseFields, readForm, type FormRequest } from '../ops/rentals/multipart-form';
import { UploadThrottlerGuard } from '../uploads/upload-throttler.guard';
import { CurrentTenancy, TenancyGuard } from './tenancy.guard';

const PHOTO_LIMITS = { maxFiles: FAULT_PHOTOS_PER_PHASE, maxBytes: FAULT_PHOTO_MAX_BYTES, what: 'A photo' } as const;

/**
 * The tenant's faults → /api/v1/me/tenancies/:leaseId/faults (blueprint 2.4,
 * WP 4.1). Session plus `TenancyGuard`: the caller's own lease, 404 for any
 * other. A report takes multipart/form-data (title, category, description,
 * urgency, staffMayEnter, and up to four `photos`), or JSON with no photo.
 * The timeline shows only what the tenant may see; money never appears.
 */
@Controller({ path: 'me/tenancies', version: '1' })
@UseGuards(SessionGuard)
export class MeTenancyFaultsController {
  constructor(private readonly faults: TenantFaultsService) {}

  @Get(':leaseId/faults')
  @UseGuards(TenancyGuard)
  list(@CurrentTenancy() tenancy: TenancyRef): Promise<TenantFaultList> {
    return this.faults.list(tenancy);
  }

  @Get(':leaseId/faults/:id')
  @UseGuards(TenancyGuard)
  detail(@CurrentTenancy() tenancy: TenancyRef, @Param('id', ParseUUIDPipe) id: string): Promise<TenantFaultDetail> {
    return this.faults.detail(tenancy, id);
  }

  @Post(':leaseId/faults')
  @UseGuards(TenancyGuard, UploadThrottlerGuard)
  async report(@CurrentTenancy() tenancy: TenancyRef, @Req() request: FormRequest): Promise<TenantFaultDetail> {
    const form = await readForm(request, PHOTO_LIMITS);
    const body = parseFields(ReportFaultRequest, normaliseFormFields(form.fields));
    return this.faults.report(tenancy, body, form.files.map((f) => ({ filename: f.filename, body: f.body })));
  }

  /** The fix did not hold: back to Reported, within 14 days of it being settled. */
  @Post(':leaseId/faults/:id/reopen')
  @HttpCode(200)
  @UseGuards(TenancyGuard, UserThrottlerGuard)
  @Throttle({ money: { limit: 10, ttl: 60_000 } })
  reopen(
    @CurrentTenancy() tenancy: TenancyRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReopenFaultRequest)) body: ReopenFaultRequest,
  ): Promise<TenantFaultDetail> {
    return this.faults.reopen(tenancy, id, body);
  }

  @Post(':leaseId/faults/:id/messages')
  @HttpCode(200)
  @UseGuards(TenancyGuard, UserThrottlerGuard)
  @Throttle({ money: { limit: 20, ttl: 60_000 } })
  message(
    @CurrentTenancy() tenancy: TenancyRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(TenantFaultMessageRequest)) body: TenantFaultMessageRequest,
  ): Promise<TenantFaultDetail> {
    return this.faults.message(tenancy, id, body);
  }

  @Post(':leaseId/faults/:id/photos')
  @HttpCode(200)
  @UseGuards(TenancyGuard, UploadThrottlerGuard)
  async photos(@CurrentTenancy() tenancy: TenancyRef, @Param('id', ParseUUIDPipe) id: string, @Req() request: FormRequest): Promise<TenantFaultDetail> {
    const form = await readForm(request, PHOTO_LIMITS);
    return this.faults.addPhotos(tenancy, id, form.files.map((f) => ({ filename: f.filename, body: f.body })));
  }
}
