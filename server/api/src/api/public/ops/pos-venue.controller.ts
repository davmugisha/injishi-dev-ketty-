import {
  CreateAreaRequest,
  CreateRegisterRequest,
  CreateStationRequest,
  CreateTableRequest,
  SetItemRouteRequest,
  UpdateAreaRequest,
  UpdateRegisterRequest,
  UpdateStationRequest,
  UpdateTableRequest,
  type PosSetup,
  type PosVenue,
} from '@injishi/contracts';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';

import { PosVenueService } from '../../../modules/pos/application/pos-venue.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Venue setup -> /api/v1/ops/pos/outlets/:outletId/venue (the owner configures the floor).
 *
 * Dining areas, tables, preparation stations, registers and which station prepares which menu item.
 * Everything is `outlet.manage` (owner and manager): seating and serving guests is `table.manage`, but
 * deciding what the floor IS belongs to whoever runs the business. The service applies the tenant and
 * branch scope (another business's or another branch's outlet is a 404) and refuses to remove anything
 * that is in use; "remove" is always archive.
 *
 * POS's, like every other `ops/pos` controller (ADR-076 G10): refused where POS is switched off. Setting up
 * a register is configuration; operating one (shifts, cash) is `OpsPosShiftsController`'s, already POS's.
 */
@Controller({ path: 'ops/pos/outlets/:outletId', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('pos')
export class OpsPosVenueController {
  constructor(private readonly venue: PosVenueService) {}

  @Get('venue')
  @RequirePermission('outlet.manage')
  get(@Param('outletId', ParseUUIDPipe) outletId: string, @CurrentWorkspace() ws: ScopedWorkspace): Promise<PosVenue> {
    return this.venue.get(ws, outletId);
  }

  /** How far the outlet is set up, counted from its records. Informational: it never blocks a screen. */
  @Get('setup')
  @RequirePermission('outlet.manage')
  setup(@Param('outletId', ParseUUIDPipe) outletId: string, @CurrentWorkspace() ws: ScopedWorkspace): Promise<PosSetup> {
    return this.venue.setup(ws, outletId);
  }

  // ── Dining areas ───────────────────────────────────────────────────────────────────────────────

  @Post('venue/areas')
  @RequirePermission('outlet.manage')
  createArea(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Body(new ZodValidationPipe(CreateAreaRequest)) body: CreateAreaRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosVenue> {
    return this.venue.createArea(ws, outletId, body, user.id);
  }

  @Patch('venue/areas/:areaId')
  @RequirePermission('outlet.manage')
  updateArea(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body(new ZodValidationPipe(UpdateAreaRequest)) body: UpdateAreaRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosVenue> {
    return this.venue.updateArea(ws, outletId, areaId, body, user.id);
  }

  @Post('venue/areas/:areaId/archive')
  @RequirePermission('outlet.manage')
  archiveArea(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosVenue> {
    return this.venue.archiveArea(ws, outletId, areaId, user.id);
  }

  // ── Tables ─────────────────────────────────────────────────────────────────────────────────────

  @Post('venue/tables')
  @RequirePermission('outlet.manage')
  createTable(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Body(new ZodValidationPipe(CreateTableRequest)) body: CreateTableRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosVenue> {
    return this.venue.createTable(ws, outletId, body, user.id);
  }

  @Patch('venue/tables/:tableId')
  @RequirePermission('outlet.manage')
  updateTable(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @Body(new ZodValidationPipe(UpdateTableRequest)) body: UpdateTableRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosVenue> {
    return this.venue.updateTable(ws, outletId, tableId, body, user.id);
  }

  @Post('venue/tables/:tableId/archive')
  @RequirePermission('outlet.manage')
  archiveTable(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosVenue> {
    return this.venue.archiveTable(ws, outletId, tableId, user.id);
  }

  // ── Preparation stations ───────────────────────────────────────────────────────────────────────

  @Post('venue/stations')
  @RequirePermission('outlet.manage')
  createStation(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Body(new ZodValidationPipe(CreateStationRequest)) body: CreateStationRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosVenue> {
    return this.venue.createStation(ws, outletId, body, user.id);
  }

  @Patch('venue/stations/:stationId')
  @RequirePermission('outlet.manage')
  updateStation(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @Body(new ZodValidationPipe(UpdateStationRequest)) body: UpdateStationRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosVenue> {
    return this.venue.updateStation(ws, outletId, stationId, body, user.id);
  }

  @Post('venue/stations/:stationId/archive')
  @RequirePermission('outlet.manage')
  archiveStation(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Param('stationId', ParseUUIDPipe) stationId: string,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosVenue> {
    return this.venue.archiveStation(ws, outletId, stationId, user.id);
  }

  // ── Registers ──────────────────────────────────────────────────────────────────────────────────

  @Post('venue/registers')
  @RequirePermission('outlet.manage')
  createRegister(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Body(new ZodValidationPipe(CreateRegisterRequest)) body: CreateRegisterRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosVenue> {
    return this.venue.createRegister(ws, outletId, body, user.id);
  }

  @Patch('venue/registers/:registerId')
  @RequirePermission('outlet.manage')
  updateRegister(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Param('registerId', ParseUUIDPipe) registerId: string,
    @Body(new ZodValidationPipe(UpdateRegisterRequest)) body: UpdateRegisterRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosVenue> {
    return this.venue.updateRegister(ws, outletId, registerId, body, user.id);
  }

  @Post('venue/registers/:registerId/archive')
  @RequirePermission('outlet.manage')
  archiveRegister(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Param('registerId', ParseUUIDPipe) registerId: string,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosVenue> {
    return this.venue.archiveRegister(ws, outletId, registerId, user.id);
  }

  // ── Item routing ───────────────────────────────────────────────────────────────────────────────

  @Put('venue/routing')
  @RequirePermission('outlet.manage')
  setRoute(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Body(new ZodValidationPipe(SetItemRouteRequest)) body: SetItemRouteRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PosVenue> {
    return this.venue.setRoute(ws, outletId, body, user.id);
  }
}
