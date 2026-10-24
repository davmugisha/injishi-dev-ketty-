import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  type GuestCountry,
  type GuestRelationship,
  type HostGuest,
  HostGuestQuery,
  type TenantGuestList,
  TenantGuestRequest,
} from '@injishi/contracts';

import { GuestRegistryService } from '../../../modules/guests/application/guest-registry.service';
import type { TenancyRef } from '../../../modules/rentals/application/tenancies.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { CurrentTenancy, TenancyGuard } from '../me/tenancy.guard';

/**
 * A tenant's guests → /api/v1/me/tenancies/:leaseId/guests (P5, blueprint 2.4).
 *
 * `TenancyGuard`: the lease is the caller's own (their account is linked to
 * the lease's tenant record, `tenants.user_id`) and not a draft; anything
 * else is a 404, the same answer every tenancy route gives. The service checks
 * the same rule again where it reads the home. Registering needs a signed
 * lease that has not ended; dates stay inside the lease and 90 days. The
 * landlord never sees these.
 */
@Controller({ path: 'me/tenancies/:leaseId/guests', version: '1' })
@UseGuards(SessionGuard, TenancyGuard)
export class TenantGuestsController {
  constructor(private readonly guests: GuestRegistryService) {}

  @Get()
  list(
    @CurrentTenancy() tenancy: TenancyRef,
    @Query(new ZodValidationPipe(HostGuestQuery)) query: HostGuestQuery,
  ): Promise<TenantGuestList> {
    return this.guests.tenantList(tenancy.userId, tenancy.leaseId, query);
  }

  @Post()
  @HttpCode(201)
  register(
    @CurrentTenancy() tenancy: TenancyRef,
    @Body(new ZodValidationPipe(TenantGuestRequest)) body: TenantGuestRequest,
  ): Promise<HostGuest> {
    return this.guests.tenantRegister(tenancy.userId, tenancy.leaseId, body);
  }

  @Patch(':id')
  update(
    @CurrentTenancy() tenancy: TenancyRef,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(TenantGuestRequest)) body: TenantGuestRequest,
  ): Promise<HostGuest> {
    return this.guests.tenantUpdate(tenancy.userId, tenancy.leaseId, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentTenancy() tenancy: TenancyRef, @Param('id', ParseUUIDPipe) id: string): Promise<HostGuest> {
    return this.guests.tenantCancel(tenancy.userId, tenancy.leaseId, id);
  }
}

/**
 * The lists a guest form offers → /api/v1/reference/countries and
 * /api/v1/reference/guest-relationships (blueprint 2.5). Public reference
 * data, cached for a day.
 */
@Controller({ path: 'reference', version: '1' })
export class GuestReferenceController {
  constructor(private readonly guests: GuestRegistryService) {}

  @Get('countries')
  @Header('cache-control', 'public, max-age=86400')
  countries(): Promise<GuestCountry[]> {
    return this.guests.countries();
  }

  @Get('guest-relationships')
  @Header('cache-control', 'public, max-age=86400')
  relationships(): Promise<GuestRelationship[]> {
    return this.guests.relationships();
  }
}
