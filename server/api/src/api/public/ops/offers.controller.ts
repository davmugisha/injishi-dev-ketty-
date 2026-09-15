import type { Offer, OfferList, WorkspaceAccess } from '@injishi/contracts';
import { CreateOfferRequest, UpdateOfferRequest } from '@injishi/contracts';
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

import { OffersService } from '../../../modules/operations/application/offers.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Offers → `/api/v1/ops/offers` (§6.8).
 *
 * ## The read is open to the workspace; the writes are not
 *
 * A receptionist needs to see what the property is offering — a guest at the
 * counter asks about the September rate and the desk has to be able to answer.
 * Writing one is setting a price downwards, which is `offer.manage` and owner
 * or manager only: whoever can write "50% off, no end date, unlimited" can give
 * the property's revenue away without any single transaction being approved.
 *
 * ## There is no delete
 *
 * `PATCH { status: "archived" }` retires one. A redemption three months old has
 * to stay readable — it is a credit on somebody's bill and a line in the ledger
 * — and deleting the offer behind it would leave a discount nobody can explain.
 */
@Controller({ path: 'ops/offers', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsOffersController {
  constructor(private readonly offers: OffersService) {}

  @Get()
  list(
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @Query('propertyId') propertyId: string | undefined,
  ): Promise<OfferList> {
    return this.offers.list(workspace, propertyId);
  }

  @Post()
  @RequirePermission('offer.manage')
  create(
    @Body(new ZodValidationPipe(CreateOfferRequest)) body: CreateOfferRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
    @CurrentUser() user: SessionUser,
  ): Promise<Offer> {
    return this.offers.create(workspace, body, user.id);
  }

  /**
   * Edit one, INCLUDING while it is live.
   *
   * A hotel that cannot fix a typo in a running offer archives it and writes
   * another, and the redemption history then reads as two offers where there
   * was one. Redemptions already made are unaffected: each stored the francs it
   * actually took off, so a later edit cannot re-price a credit somebody has
   * already been given.
   */
  @Patch(':id')
  @RequirePermission('offer.manage')
  update(
    @Param('id', new ParseUUIDPipe()) offerId: string,
    @Body(new ZodValidationPipe(UpdateOfferRequest)) body: UpdateOfferRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<Offer> {
    return this.offers.update(workspace, offerId, body);
  }
}
