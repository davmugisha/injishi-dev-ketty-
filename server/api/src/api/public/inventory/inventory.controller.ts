import {
  AttachPropertyPhotoRequest,
  CreatePropertyRequest,
  CreateRatePlanRequest,
  CreateRoomsRequest,
  CreateRoomTypeRequest,
  type InventoryRoom,
  type InventoryRoomList,
  type PropertySetupProgress,
  UpdateRoomRequest,
  type OperatorProperty,
  type OperatorPropertyList,
  type OperatorRatePlan,
  type OperatorRatePlanList,
  type OperatorRoomType,
  type OperatorRoomTypeList,
  type PropertyPhotoList,
  ReorderPropertyPhotosRequest,
  UpdatePropertyRequest,
  UpdateRatePlanRequest,
  UpdateRoomTypeRequest,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { InventoryService } from '../../../modules/platform/property/application/inventory.service';
import { PropertyPhotosService } from '../../../modules/platform/property/application/property-photos.service';
import { RatePlansService } from '../../../modules/platform/property/application/rate-plans.service';
import { RoomTypesService } from '../../../modules/platform/property/application/room-types.service';
import { RoomsService } from '../../../modules/platform/property/application/rooms.service';
import { SetupProgressService } from '../../../modules/platform/property/application/setup-progress.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireEveryBranch,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Inventory authoring → /api/v1/inventory/* (ADR-009, F-S04 / F-B01).
 *
 * DELIBERATELY NOT UNDER `/api/v1/properties`. That path is the public,
 * unauthenticated read of a PUBLISHED property, and an operator has to be able
 * to read a draft. Two different questions get two different paths, rather than
 * one path that changes meaning depending on whether a cookie was sent.
 *
 * Every route composes `@UseGuards(SessionGuard, WorkspaceGuard)` and declares
 * `listing.manage`. A business that is not `active` holds no permissions at all
 * (D20), so the whole surface is closed to it without a single extra check.
 *
 * The guard proves the caller HOLDS the workspace they named. It does not prove
 * the `:id` belongs to that workspace; `InventoryService` does that (AC-14).
 */
@Controller({ path: 'inventory', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequirePermission('listing.manage')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly ratePlans: RatePlansService,
    private readonly roomTypes: RoomTypesService,
    private readonly photos: PropertyPhotosService,
    private readonly rooms: RoomsService,
    private readonly setup: SetupProgressService,
  ) {}

  /**
   * Every rate plan in this workspace (ADR-035, wave 2 follow-up).
   *
   * **This route did not exist**, which is why the Rate plans lens was a
   * placeholder while `rate_plans` sat there fully specified.
   *
   * It takes NO `workspaceId` query parameter, and since ADR-053 task 18 no
   * route on this controller does. Its neighbours used to validate one and
   * throw it away while `WorkspaceGuard` resolved the real workspace from the
   * header, so a client had to send the same fact twice for nothing.
   */
  @Get('rate-plans')
  listRatePlans(
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorRatePlanList> {
    return this.ratePlans.list(workspace);
  }

  /**
   * Every property in this workspace, with its listing state.
   *
   * `includeArchived=true` adds the archived branches, for the Branches screen
   * (ADR-054). Anything else leaves them out.
   */
  @Get('properties')
  async listProperties(
    @Query('includeArchived') includeArchived: string | undefined,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorPropertyList> {
    return {
      properties: await this.inventory.listProperties(
        workspace,
        includeArchived === 'true',
      ),
    };
  }

  /**
   * Create a property, and its draft listing with it.
   *
   * Draft is the only state it can be created in: publishing is a separate act
   * with its own rules, and a property that arrived already visible would have
   * skipped every one of them.
   *
   * On a business that already has one, this is how a branch is added (ADR-054
   * AC-M1): the same door, with a check that the caller covers every branch.
   */
  @Post('properties')
  @RequireEveryBranch()
  createProperty(
    @Body(new ZodValidationPipe(CreatePropertyRequest))
    body: CreatePropertyRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorProperty> {
    return this.inventory.createProperty(workspace, body, user.id);
  }

  /** One property in full, draft or published. */
  @Get('properties/:id')
  getProperty(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorProperty> {
    return this.inventory.getProperty(workspace, id);
  }

  /**
   * Edit a property. Only the fields sent are replaced. Sending `rraBranchId`
   * also needs `ebm.manage`, checked in the service (ADR-054 AC-M2).
   */
  @Patch('properties/:id')
  updateProperty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePropertyRequest))
    body: UpdatePropertyRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorProperty> {
    return this.inventory.updateProperty(workspace, id, body, user.id);
  }

  // -------------------------------------------------------------------------
  // Branches (ADR-054, AC-M3 to AC-M6)
  //
  // Each move is org wide, so the guard refuses a limited member 403 before
  // the row is looked up (AC-M6). Without it they got a 404 for a branch they
  // do not cover, which is the right answer to a read and the wrong one here.
  // -------------------------------------------------------------------------

  /**
   * Archive a branch. `200`: nothing is created, a branch moves. A 409 names
   * every reason it cannot move in `reasons`.
   */
  @Post('properties/:id/archive')
  @HttpCode(200)
  @RequireEveryBranch()
  archiveBranch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorProperty> {
    return this.inventory.archiveBranch(workspace, id, user.id);
  }

  /** Restore an archived branch. Its listing stays a draft until published again. */
  @Post('properties/:id/restore')
  @HttpCode(200)
  @RequireEveryBranch()
  restoreBranch(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorProperty> {
    return this.inventory.restoreBranch(workspace, id, user.id);
  }

  /** Make this branch the head office. Answers with every active branch. */
  @Post('properties/:id/head-office')
  @HttpCode(200)
  @RequireEveryBranch()
  async makeHeadOffice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<OperatorPropertyList> {
    return {
      properties: await this.inventory.makeHeadOffice(workspace, id, user.id),
    };
  }

  // -------------------------------------------------------------------------
  // Room types (ADR-053, AC-I1)
  // -------------------------------------------------------------------------

  /** Every room type on a property, archived ones included. */
  @Get('properties/:id/room-types')
  async listRoomTypes(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorRoomTypeList> {
    return { roomTypes: await this.roomTypes.list(workspace, id) };
  }

  /**
   * Create a room type, and the default rate plan it sells on.
   *
   * Both, always. `rate_plans` is what a quote is built from, so a room type with
   * no plan cannot be sold and publishing would refuse for a reason the operator
   * did nothing to cause.
   */
  @Post('properties/:id/room-types')
  createRoomType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateRoomTypeRequest))
    body: CreateRoomTypeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorRoomType> {
    return this.roomTypes.create(workspace, id, body);
  }

  /**
   * Edit a room type.
   *
   * Addressed by the room type alone rather than nested under its property: the
   * screen editing it holds its id, and carrying the property id as well would let
   * a request name a pair that disagrees.
   */
  @Patch('room-types/:id')
  updateRoomType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateRoomTypeRequest))
    body: UpdateRoomTypeRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorRoomType> {
    return this.roomTypes.update(workspace, id, body);
  }

  // -------------------------------------------------------------------------
  // Rooms and units (setup after approval, 2026-09-13)
  // -------------------------------------------------------------------------

  /** Every room of a room type, with whether it can be sold and is clean. */
  @Get('room-types/:id/rooms')
  async listRooms(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<InventoryRoomList> {
    return { rooms: await this.rooms.list(workspace, id) };
  }

  /**
   * Add rooms to a room type, each by the label on its door.
   *
   * The only write that makes a property SELLABLE: publishing, the room status
   * board, a booking and a lease all need a real `rooms` row, and nothing wrote
   * one outside the seeds until this route.
   */
  @Post('room-types/:id/rooms')
  async addRooms(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateRoomsRequest))
    body: CreateRoomsRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<InventoryRoomList> {
    return { rooms: await this.rooms.add(workspace, id, body) };
  }

  /** Renumber a room, or take it out of sale. */
  @Patch('rooms/:id')
  updateRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateRoomRequest))
    body: UpdateRoomRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<InventoryRoom> {
    return this.rooms.update(workspace, id, body);
  }

  // -------------------------------------------------------------------------
  // The setup checklist (setup after approval, 2026-09-13)
  // -------------------------------------------------------------------------

  /**
   * The counts the setup checklist is judged against, for one property.
   *
   * Behind `listing.manage` with the rest of this controller, so a business the
   * approver has not activated gets the registration gate's refusal, never a
   * checklist it cannot act on.
   */
  @Get('setup')
  setupProgress(
    @Query('propertyId', new ParseUUIDPipe({ optional: true }))
    propertyId: string | undefined,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<PropertySetupProgress> {
    return this.setup.progress(workspace, propertyId);
  }

  // -------------------------------------------------------------------------
  // Rate plans (ADR-053, AC-I2)
  // -------------------------------------------------------------------------

  /** Add a plan to a room type. */
  @Post('room-types/:id/rate-plans')
  createRatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateRatePlanRequest))
    body: CreateRatePlanRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorRatePlan> {
    return this.ratePlans.create(workspace, id, body);
  }

  /** Edit a plan. Making it the default moves the flag off the old one. */
  @Patch('rate-plans/:id')
  updateRatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateRatePlanRequest))
    body: UpdateRatePlanRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorRatePlan> {
    return this.ratePlans.update(workspace, id, body);
  }

  // -------------------------------------------------------------------------
  // Photographs (ADR-053, AC-I3)
  // -------------------------------------------------------------------------

  /** Every photograph on a property, in the operator's order. */
  @Get('properties/:id/photos')
  async listPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<PropertyPhotoList> {
    return { photos: await this.photos.list(workspace, id) };
  }

  /**
   * Attach an already uploaded object.
   *
   * The bytes went up at `POST /api/v1/uploads/property-photo` and this carries
   * the key. The first photograph on a property becomes its cover whatever the
   * body says, because nobody chooses "photographs but no cover".
   */
  @Post('properties/:id/photos')
  async attachPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AttachPropertyPhotoRequest))
    body: AttachPropertyPhotoRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<PropertyPhotoList> {
    return { photos: await this.photos.attach(workspace, id, body) };
  }

  /**
   * Reorder, re caption, and move the cover, in one call.
   *
   * One call because reordering is ONE act: a drag that lands renumbers several
   * rows, and five requests leave the order half written when the fourth fails.
   */
  @Patch('properties/:id/photos')
  async reorderPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReorderPropertyPhotosRequest))
    body: ReorderPropertyPhotosRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<PropertyPhotoList> {
    return { photos: await this.photos.reorder(workspace, id, body) };
  }

  /** Remove a photograph. Refused when it is the last one on a live listing. */
  @Delete('properties/:id/photos/:photoId')
  async removePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<PropertyPhotoList> {
    return { photos: await this.photos.remove(workspace, id, photoId) };
  }

  // -------------------------------------------------------------------------
  // Publishing (ADR-053, AC-I4 to AC-I6, AC-I10)
  // -------------------------------------------------------------------------

  /**
   * Put the property on the marketplace.
   *
   * `200` rather than `201`: nothing is created, a listing moves. Pressing it
   * twice is safe — the second press finds the listing already published and
   * returns the same body, so one press and two are indistinguishable.
   */
  @Post('properties/:id/publish')
  @HttpCode(200)
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorProperty> {
    return this.inventory.publish(workspace, id);
  }

  /** Take it back off, keeping the public address for a later republish. */
  @Post('properties/:id/unpublish')
  @HttpCode(200)
  unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorProperty> {
    return this.inventory.unpublish(workspace, id);
  }
}
