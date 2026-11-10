import {
  CollectionInput,
  CollectionItemInput,
  ConsentInput,
  type GuestCollection,
  type GuestContact,
  GuestContactInput,
  type MyBusinesses,
  type MyCollections,
  type MyConsents,
  type MySaved,
  type MyTripFacts,
  type SavedPlace,
} from '@injishi/contracts';
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { MarketplaceService } from '../../../modules/marketplace/application/marketplace.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

const LanguagePreferenceInput = z.object({ locale: z.enum(['en', 'rw', 'fr']) }).strict();
type LanguagePreferenceInput = z.infer<typeof LanguagePreferenceInput>;

/*
 * The guest's own marketplace rows (real-data leaf 1.3.2). `SessionGuard` alone, and no
 * `@RequirePermission`, which is a decision and not an omission: a guest holds no business workspace
 * for `WorkspaceGuard` to read, so ownership IS the guard. Every handler takes the person from the
 * session and nothing else; a list, a place or a choice that is not theirs answers 404.
 */

/**
 * The heart (ADR-032): one flat surface over the person's hidden default list. POST is idempotent
 * (a second heart returns the same place); DELETE of something not saved is a 404, because the
 * client's picture of the world is wrong and it should read again.
 */
@Controller({ path: 'me/saved', version: '1' })
@UseGuards(SessionGuard)
export class MeSavedController {
  constructor(private readonly market: MarketplaceService) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<MySaved> {
    return this.market.saved(user.id);
  }

  @Post(':propertyId')
  @HttpCode(200)
  save(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<SavedPlace> {
    return this.market.save(user.id, propertyId);
  }

  @Delete(':propertyId')
  @HttpCode(204)
  async unsave(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<void> {
    await this.market.unsave(user.id, propertyId);
  }
}

/** F-B16's named lists, beside `/me/saved` (ADR-032: collections land as pure addition). */
@Controller({ path: 'me/collections', version: '1' })
@UseGuards(SessionGuard)
export class MeCollectionsController {
  constructor(private readonly market: MarketplaceService) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<MyCollections> {
    return this.market.collections(user.id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(CollectionInput)) body: CollectionInput,
    @CurrentUser() user: SessionUser,
  ): Promise<GuestCollection> {
    return this.market.createCollection(user.id, body);
  }

  @Patch(':id')
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CollectionInput)) body: CollectionInput,
    @CurrentUser() user: SessionUser,
  ): Promise<GuestCollection> {
    return this.market.renameCollection(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: SessionUser): Promise<void> {
    await this.market.deleteCollection(user.id, id);
  }

  @Post(':id/items')
  @HttpCode(200)
  add(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CollectionItemInput)) body: CollectionItemInput,
    @CurrentUser() user: SessionUser,
  ): Promise<GuestCollection> {
    return this.market.addToCollection(user.id, id, body.propertyId);
  }

  @Delete(':id/items/:propertyId')
  removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<GuestCollection> {
    return this.market.removeFromCollection(user.id, id, propertyId);
  }
}

/** Consent, append-only: a PUT records a new choice and answers with every current one. */
@Controller({ path: 'me/consents', version: '1' })
@UseGuards(SessionGuard)
export class MeConsentsController {
  constructor(private readonly market: MarketplaceService) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<MyConsents> {
    return this.market.consents(user.id);
  }

  @Put()
  record(
    @Body(new ZodValidationPipe(ConsentInput)) body: ConsentInput,
    @CurrentUser() user: SessionUser,
  ): Promise<MyConsents> {
    return this.market.recordConsent(user.id, body);
  }
}

/**
 * The account page's contact block: name, phone, country, language. Not `/me/profile`, which is the
 * identity step (document, date of birth) and replaces that whole block on every write.
 */
@Controller({ path: 'me/guest-contact', version: '1' })
@UseGuards(SessionGuard)
export class MeGuestContactController {
  constructor(private readonly market: MarketplaceService) {}

  @Get()
  read(@CurrentUser() user: SessionUser): Promise<GuestContact> {
    return this.market.contact(user.id);
  }

  @Put()
  save(
    @Body(new ZodValidationPipe(GuestContactInput)) body: GuestContactInput,
    @CurrentUser() user: SessionUser,
  ): Promise<GuestContact> {
    return this.market.updateContact(user.id, body);
  }
}

/** The account-wide interface language, independent of persona or workspace. */
@Controller({ path: 'me/preferences/language', version: '1' })
@UseGuards(SessionGuard)
export class MeLanguagePreferenceController {
  constructor(private readonly market: MarketplaceService) {}

  @Get()
  read(@CurrentUser() user: SessionUser): Promise<{ locale: string }> {
    return this.market.languagePreference(user.id);
  }

  @Patch()
  save(
    @Body(new ZodValidationPipe(LanguagePreferenceInput)) body: LanguagePreferenceInput,
    @CurrentUser() user: SessionUser,
  ): Promise<{ locale: string }> {
    return this.market.updateLanguagePreference(user.id, body.locale);
  }
}

/**
 * The branches of the businesses the person works at, for the help centre's contact form. Their own
 * memberships only; a guest with none gets an empty list, never a refusal.
 */
@Controller({ path: 'me/businesses', version: '1' })
@UseGuards(SessionGuard)
export class MeBusinessesController {
  constructor(private readonly market: MarketplaceService) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<MyBusinesses> {
    return this.market.businesses(user.id);
  }
}

/** What the account's trip cards say beside `/me/trips`: payment, refund, request window, pre-arrival. */
@Controller({ path: 'me/trip-facts', version: '1' })
@UseGuards(SessionGuard)
export class MeTripFactsController {
  constructor(private readonly market: MarketplaceService) {}

  @Get()
  list(@CurrentUser() user: SessionUser): Promise<MyTripFacts> {
    return this.market.tripFacts(user.id);
  }
}
