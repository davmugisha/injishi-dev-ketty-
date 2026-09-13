import {
  type CreateRoomTypeRequest,
  type OperatorRoomType,
  type UpdateRoomTypeRequest,
  type WorkspaceAccess,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { assertContained } from '../domain/containment';
import { InventoryRepository } from '../infrastructure/inventory.repository';
import {
  RoomTypesRepository,
  type RoomTypeRow,
} from '../infrastructure/room-types.repository';

/**
 * Room type authoring (ADR-049, AC-I1, AC-I7).
 *
 * The same two controls that front every method in `InventoryService` front these:
 * `WorkspaceGuard` proves the caller holds the workspace and that it grants
 * `listing.manage`, and `assertContained` proves the target row belongs to it.
 * The guard cannot do the second, and without it holding one workspace would be
 * permission to edit another's rooms.
 *
 * Containment answers **404, not 403**, for every row in another workspace. The
 * two answers together tell a stranger which ids exist.
 */
@Injectable()
export class RoomTypesService {
  constructor(
    private readonly repo: RoomTypesRepository,
    private readonly properties: InventoryRepository,
  ) {}

  /** Every room type on one of the caller's properties. */
  async list(
    workspace: WorkspaceAccess,
    propertyId: string,
  ): Promise<OperatorRoomType[]> {
    const property = await this.properties.findProperty(propertyId);
    assertContained(property, workspace.workspaceId, 'Property');
    const rows = await this.repo.listForProperty(propertyId);
    return rows.map((row) => this.toContract(row));
  }

  /**
   * Create a room type, and the default rate plan it sells on.
   *
   * The domain is inherited from the owning org rather than asked for: it is
   * decided at registration, and asking again would let a hospitality business
   * file rows in the residence half of the product.
   */
  async create(
    workspace: WorkspaceAccess,
    propertyId: string,
    request: CreateRoomTypeRequest,
  ): Promise<OperatorRoomType> {
    const property = await this.properties.findProperty(propertyId);
    assertContained(property, workspace.workspaceId, 'Property');

    const domain = await this.repo.domainForProperty(propertyId);
    if (domain === null) {
      throw new BadRequestException(
        'That property has no business behind it any more.',
      );
    }

    const roomTypeId = await this.repo.create({
      propertyId,
      workspaceId: workspace.workspaceId,
      domain,
      request,
    });
    return this.read(roomTypeId);
  }

  /**
   * Edit a room type, refusing the edit that would break a published listing.
   *
   * **AC-I7.** Archiving the last priced room type on a PUBLISHED property is a
   * 409, and the operator unpublishes first. The alternative — allow it and
   * unpublish automatically — was rejected because a business vanishing from the
   * marketplace with nobody pressing anything is far worse to discover than a
   * refusal is to read.
   */
  async update(
    workspace: WorkspaceAccess,
    roomTypeId: string,
    request: UpdateRoomTypeRequest,
  ): Promise<OperatorRoomType> {
    const existing = await this.repo.find(roomTypeId);
    assertContained(existing, workspace.workspaceId, 'Room type');
    const row = existing as RoomTypeRow;

    const archiving = request.status === 'archived' && row.status === 'active';
    const unpricing =
      request.basePriceRwf === null && row.basePriceRwf !== null;

    if (archiving || unpricing) {
      await this.assertNotTheLastPricedRoomType({
        propertyId: row.propertyId,
        roomTypeId,
        archiving,
      });
    }

    await this.repo.update({ roomTypeId, request });
    return this.read(roomTypeId);
  }

  /** One room type, after a write, read back through the same shape a list uses. */
  private async read(roomTypeId: string): Promise<OperatorRoomType> {
    const row = await this.repo.find(roomTypeId);
    if (!row) throw new NotFoundException('No such room type.');
    return this.toContract(row);
  }

  /**
   * Would this leave a published property with nothing priced to sell?
   *
   * Asked only when the property is actually published. A draft may be left in any
   * half-finished state the operator likes; that is what a draft is for.
   */
  private async assertNotTheLastPricedRoomType(input: {
    propertyId: string;
    roomTypeId: string;
    archiving: boolean;
  }): Promise<void> {
    const property = await this.properties.findProperty(input.propertyId);
    if (property?.listingStatus !== 'published') return;

    const others = await this.repo.otherPricedActiveCount({
      propertyId: input.propertyId,
      excludingRoomTypeId: input.roomTypeId,
    });
    if (others > 0) return;

    throw new ConflictException(
      input.archiving
        ? 'This is the only priced room type on a published property. ' +
          'Unpublish the property first, or add another priced room type.'
        : 'A published property needs at least one priced room type. ' +
          'Unpublish the property first, or price another room type.',
    );
  }

  private toContract(row: RoomTypeRow): OperatorRoomType {
    return {
      id: row.id,
      propertyId: row.propertyId,
      name: row.name,
      domain: row.domain,
      status: row.status,
      maxGuests: row.maxGuests,
      basePriceRwf: row.basePriceRwf === null ? null : Number(row.basePriceRwf),
      // The columns are nullable enums; the contract names the same unions.
      bookingMode: (row.bookingMode ?? null) as OperatorRoomType['bookingMode'],
      cancellationTier: (row.cancellationTier ??
        null) as OperatorRoomType['cancellationTier'],
      roomCount: row.roomCount,
      sellableRoomCount: row.sellableRoomCount,
      defaultRatePlanId: row.defaultRatePlanId,
    };
  }
}
