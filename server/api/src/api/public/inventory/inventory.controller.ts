import {
  AttachPropertyPhotoRequest,
  CreatePropertyRequest,
  CreateRatePlanRequest,
  CreateRoomTypeRequest,
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
  type WorkspaceAccess,
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
  UseGuards,
} from '@nestjs/common';

import { InventoryService } from '../../../modules/listing-setup/application/inventory.service';
import { PropertyPhotosService } from '../../../modules/listing-setup/application/property-photos.service';
import { RatePlansService } from '../../../modules/listing-setup/application/rate-plans.service';
import { RoomTypesService } from '../../../modules/listing-setup/application/room-types.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
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
  ) {}

  /**
   * Every rate plan in this workspace (ADR-035, wave 2 follow-up).
   *
   * **This route did not exist**, which is why the Rate plans lens was a
   * placeholder while `rate_plans` sat there fully specified.
   *
   * It takes NO `workspaceId` query parameter, and since ADR-049 task 18 no
   * route on this controller does. Its neighbours used to validate one and
   * throw it away while `WorkspaceGuard` resolved the real workspace from the
   * header, so a client had to send the same fact twice for nothing.
   */
  @Get('rate-plans')
  listRatePlans(
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorRatePlanList> {
    return this.ratePlans.list(workspace);
  }

  /** Every property in this workspace, with its listing state. */
  @Get('properties')
  async listProperties(
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorPropertyList> {
    return { properties: await this.inventory.listProperties(workspace) };
  }

  /**
   * Create a property, and its draft listing with it.
   *
   * Draft is the only state it can be created in: publishing is a separate act
   * with its own rules, and a property that arrived already visible would have
   * skipped every one of them.
   */
  @Post('properties')
  createProperty(
    @Body(new ZodValidationPipe(CreatePropertyRequest))
    body: CreatePropertyRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorProperty> {
    return this.inventory.createProperty(workspace, body);
  }

  /** One property in full, draft or published. */
  @Get('properties/:id')
  getProperty(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorProperty> {
    return this.inventory.getProperty(workspace, id);
  }

  /** Edit a property. Only the fields sent are replaced. */
  @Patch('properties/:id')
  updateProperty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePropertyRequest))
    body: UpdatePropertyRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorProperty> {
    return this.inventory.updateProperty(workspace, id, body);
  }

  // -------------------------------------------------------------------------
  // Room types (ADR-049, AC-I1)
  // -------------------------------------------------------------------------

  /** Every room type on a property, archived ones included. */
  @Get('properties/:id/room-types')
  async listRoomTypes(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
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
    @CurrentWorkspace() workspace: WorkspaceAccess,
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
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorRoomType> {
    return this.roomTypes.update(workspace, id, body);
  }

  // -------------------------------------------------------------------------
  // Rate plans (ADR-049, AC-I2)
  // -------------------------------------------------------------------------

  /** Add a plan to a room type. */
  @Post('room-types/:id/rate-plans')
  createRatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateRatePlanRequest))
    body: CreateRatePlanRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorRatePlan> {
    return this.ratePlans.create(workspace, id, body);
  }

  /** Edit a plan. Making it the default moves the flag off the old one. */
  @Patch('rate-plans/:id')
  updateRatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateRatePlanRequest))
    body: UpdateRatePlanRequest,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorRatePlan> {
    return this.ratePlans.update(workspace, id, body);
  }

  // -------------------------------------------------------------------------
  // Photographs (ADR-049, AC-I3)
  // -------------------------------------------------------------------------

  /** Every photograph on a property, in the operator's order. */
  @Get('properties/:id/photos')
  async listPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
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
    @CurrentWorkspace() workspace: WorkspaceAccess,
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
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<PropertyPhotoList> {
    return { photos: await this.photos.reorder(workspace, id, body) };
  }

  /** Remove a photograph. Refused when it is the last one on a live listing. */
  @Delete('properties/:id/photos/:photoId')
  async removePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<PropertyPhotoList> {
    return { photos: await this.photos.remove(workspace, id, photoId) };
  }

  // -------------------------------------------------------------------------
  // Publishing (ADR-049, AC-I4 to AC-I6, AC-I10)
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
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorProperty> {
    return this.inventory.publish(workspace, id);
  }

  /** Take it back off, keeping the public address for a later republish. */
  @Post('properties/:id/unpublish')
  @HttpCode(200)
  unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: WorkspaceAccess,
  ): Promise<OperatorProperty> {
    return this.inventory.unpublish(workspace, id);
  }
}
