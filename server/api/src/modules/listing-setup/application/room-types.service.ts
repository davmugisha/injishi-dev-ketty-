import {
  bedsSleep,
  priceBasisFor,
  type CreateRoomTypeRequest,
  type RoomBed,
  type OperatorRoomType,
  type UpdateRoomTypeRequest,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  assertInBranchScope,
  type ScopedWorkspace,
} from '../../../shared/auth/branch-scope';
import { assertContained } from '../domain/containment';
import {
  collidingLabels,
  isRoomLabelCollision,
  numberedLabels,
} from '../domain/room-labels';
import { InventoryRepository } from '../infrastructure/inventory.repository';
import { RoomsRepository } from '../infrastructure/rooms.repository';
import {
  RoomTypesRepository,
  type RoomTypeRow,
} from '../infrastructure/room-types.repository';

/**
 * Room type authoring (ADR-053, AC-I1, AC-I7).
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
    private readonly rooms: RoomsRepository,
  ) {}

  /** Every room type on one of the caller's properties. */
  async list(
    workspace: ScopedWorkspace,
    propertyId: string,
  ): Promise<OperatorRoomType[]> {
    const property = await this.properties.findProperty(propertyId);
    assertContained(property, workspace.workspaceId, 'Property');
    assertInBranchScope(workspace, property.id, 'Property');
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
    workspace: ScopedWorkspace,
    propertyId: string,
    request: CreateRoomTypeRequest,
  ): Promise<OperatorRoomType> {
    const property = await this.properties.findProperty(propertyId);
    assertContained(property, workspace.workspaceId, 'Property');
    assertInBranchScope(workspace, property.id, 'Property');

    const domain = await this.repo.domainForProperty(propertyId);
    if (domain === null) {
      throw new BadRequestException(
        'That property has no business behind it any more.',
      );
    }

    // The rooms it starts with: the ones named, or `roomCount` numbered after
    // the type. A room type created with neither gets one room, which is what
    // the column default always claimed and never delivered.
    const roomLabels =
      request.roomLabels && request.roomLabels.length > 0
        ? request.roomLabels.map((l) => l.trim())
        : numberedLabels(request.name, request.roomCount ?? 1);
    const clashes = collidingLabels(
      roomLabels,
      await this.rooms.labelsOnProperty(propertyId),
    );
    if (clashes.length > 0) {
      throw new ConflictException(
        `These ${clashes.length === 1 ? 'name is' : 'names are'} already used on this property: ${clashes.join(', ')}. Every room needs its own.`,
      );
    }

    // Unsent, the price basis is the business's own (owner decisions,
    // 2026-10-29): a villa or apartment is let whole, a bar or coffee shop
    // lists menu items, everything else is per person. So no client can leave a
    // coffee shop's espresso bookable by forgetting the field.
    const kind = request.priceBasis ? null : await this.repo.businessKindForProperty(propertyId);
    const priceBasis = request.priceBasis ?? (kind ? priceBasisFor(kind) : 'per_person');
    assertRoomFacts({ ...request, priceBasis });

    let roomTypeId: string;
    try {
      roomTypeId = await this.repo.create({
        propertyId,
        workspaceId: workspace.workspaceId,
        domain,
        request: { ...request, priceBasis },
        roomLabels,
      });
    } catch (err) {
      // A concurrent write took one of these labels after the read above
      // (`rooms_property_label_uk`); the same refusal, not a 500.
      if (isRoomLabelCollision(err)) {
        throw new ConflictException(
          `These names are already used on this property: ${roomLabels.join(', ')}. Every room needs its own.`,
        );
      }
      throw err;
    }
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
    workspace: ScopedWorkspace,
    roomTypeId: string,
    request: UpdateRoomTypeRequest,
  ): Promise<OperatorRoomType> {
    const existing = await this.repo.find(roomTypeId);
    assertContained(existing, workspace.workspaceId, 'Room type');
    assertInBranchScope(workspace, existing.propertyId, 'Room type');
    const row = existing as RoomTypeRow;

    assertRoomFacts({
      maxGuests: request.maxGuests ?? row.maxGuests,
      basePriceRwf: request.basePriceRwf !== undefined ? request.basePriceRwf : row.basePriceRwf,
      priceBasis: request.priceBasis ?? row.priceBasis,
      singleGuestPriceRwf: request.singleGuestPriceRwf,
      maxAdults: request.maxAdults,
      beds: request.beds,
    });

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
      priceBasis: row.priceBasis,
      roomCount: row.roomCount,
      sellableRoomCount: row.sellableRoomCount,
      defaultRatePlanId: row.defaultRatePlanId,
    };
  }
}

/**
 * What a room type may say about itself (0117), beyond what each field's own range holds: a one guest
 * price is only for a room priced per room and costs less than the room, and a room holds no more adults
 * than it sleeps, or than its beds do. A field not sent is not checked.
 */
function assertRoomFacts(r: {
  maxGuests?: number | null;
  basePriceRwf?: number | null;
  priceBasis?: string | null;
  singleGuestPriceRwf?: number | null;
  maxAdults?: number | null;
  beds?: readonly RoomBed[] | null;
}): void {
  if (r.singleGuestPriceRwf != null) {
    if (r.priceBasis !== 'per_unit') {
      throw new BadRequestException('A price for one guest is only for a room priced per room.');
    }
    if (r.basePriceRwf != null && r.singleGuestPriceRwf >= r.basePriceRwf) {
      throw new BadRequestException('The price for one guest should be less than the room price.');
    }
  }
  if (r.maxAdults != null && r.maxGuests != null && r.maxAdults > r.maxGuests) {
    throw new BadRequestException('A room cannot take more adults than it sleeps.');
  }
  if (r.maxAdults != null && r.beds && r.beds.length > 0 && r.maxAdults > bedsSleep(r.beds)) {
    throw new BadRequestException(`Those beds sleep ${bedsSleep(r.beds)}, fewer than the adults the room takes.`);
  }
}
