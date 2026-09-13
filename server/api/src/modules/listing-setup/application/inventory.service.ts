import {
  type CreatePropertyRequest,
  type OperatorProperty,
  type OperatorPropertySummary,
  PUBLISH_BLOCKER_LABEL,
  type PublishBlocker,
  type UpdatePropertyRequest,
  type WorkspaceAccess,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { assertContained } from '../domain/containment';
import { publishBlockersFor } from '../domain/publish-eligibility';
import {
  InventoryRepository,
  type PropertyRow,
} from '../infrastructure/inventory.repository';
import { PropertyPhotosService } from './property-photos.service';

/**
 * Inventory authoring (ADR-009), the write path an approved business finally
 * has.
 *
 * LISTING-SETUP MODULE's only outward-facing surface. The API layer composes
 * this service, never the repository, so the containment check below cannot be
 * routed around.
 *
 * Two controls sit in front of every method here and they are NOT the same
 * check:
 *
 * 1. `WorkspaceGuard` on the route proves the caller HOLDS the workspace they
 *    named, and that the workspace grants `listing.manage`. A business that is
 *    not `active` holds no permissions at all, so it never gets this far, which
 *    is how "no inventory listing before approval" stays true in one place (D20).
 * 2. `assertContained` here proves the TARGET ROW belongs to that workspace.
 *    The guard does not do this. Without it, holding one workspace would be
 *    permission to edit another's rows.
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly repo: InventoryRepository,
    private readonly photos: PropertyPhotosService,
  ) {}

  /** Every property in the caller's workspace. */
  async listProperties(
    workspace: WorkspaceAccess,
  ): Promise<OperatorPropertySummary[]> {
    const [rows, counts] = await Promise.all([
      this.repo.findPropertiesInWorkspace(workspace.workspaceId),
      this.repo.countsForWorkspace(workspace.workspaceId),
    ]);
    return rows.map((row) => this.toSummary(row, counts.get(row.id)));
  }

  /**
   * Create a property, and its draft listing with it.
   *
   * The org comes from the resolved workspace rather than from the body: a
   * caller naming their own workspace cannot then write a property onto someone
   * else's org.
   */
  async createProperty(
    workspace: WorkspaceAccess,
    request: CreatePropertyRequest,
  ): Promise<OperatorProperty> {
    if (!workspace.orgId) {
      // A personal or broker workspace has no org to hang a property on. The
      // guard cannot express this, because holding such a workspace is normal.
      throw new BadRequestException(
        'Properties belong to a business workspace.',
      );
    }

    const districtId = await this.districtFor(request.sectorId);

    const propertyId = await this.repo.createProperty({
      orgId: workspace.orgId,
      workspaceId: workspace.workspaceId,
      districtId,
      request,
    });
    return this.getProperty(workspace, propertyId);
  }

  /** Edit a property, replacing only the fields that were sent. */
  async updateProperty(
    workspace: WorkspaceAccess,
    propertyId: string,
    request: UpdatePropertyRequest,
  ): Promise<OperatorProperty> {
    const existing = await this.repo.findProperty(propertyId);
    assertContained(existing, workspace.workspaceId, 'Property');

    // The derived district moves with the sector, or an edit would leave the
    // property filed under the district it used to be in.
    const districtId =
      request.sectorId === undefined
        ? null
        : await this.districtFor(request.sectorId);

    await this.repo.updateProperty({ propertyId, districtId, request });
    return this.getProperty(workspace, propertyId);
  }

  /** One property in full, draft or published. */
  async getProperty(
    workspace: WorkspaceAccess,
    propertyId: string,
  ): Promise<OperatorProperty> {
    const row = await this.repo.findProperty(propertyId);
    assertContained(row, workspace.workspaceId, 'Property');

    const [roomTypes, photos] = await Promise.all([
      this.repo.findRoomTypeSummaries(propertyId),
      // Containment is proven on the line above, so this takes the path that does
      // not re-read the property to ask again.
      this.photos.photosFor(propertyId),
    ]);
    const sellableRoomCount = roomTypes.reduce(
      (n, t) => n + t.sellableRoomCount,
      0,
    );

    return {
      ...this.toSummary(row as PropertyRow, {
        roomTypeCount: roomTypes.length,
        sellableRoomCount,
      }),
      description: (row as PropertyRow).description,
      checkInTime: (row as PropertyRow).checkInTime,
      checkOutTime: (row as PropertyRow).checkOutTime,
      houseRules: (row as PropertyRow).houseRules,
      locationPrivacy: (row as PropertyRow).locationPrivacy,
      timezone: (row as PropertyRow).timezone,
      photos,
      roomTypes,
    };
  }

  /**
   * Put a property on the marketplace (ADR-049, AC-I4, AC-I5, AC-I10).
   *
   * Eligibility is checked TWICE: once here, so an ineligible property is refused
   * without opening a transaction, and again inside the row lock by the
   * repository, so a property that lost its last photograph in between is refused
   * rather than published on a stale answer.
   *
   * The refusal names the condition that failed, in the operator's words rather
   * than a column name. A refusal that says only "cannot publish" sends somebody
   * hunting, which is the whole reason `PublishBlocker` is a code with a label
   * rather than a sentence built here.
   *
   * A second press is NOT an error. The lock serialises them and the second finds
   * the listing already published, so one press and two are indistinguishable to
   * the caller.
   */
  async publish(
    workspace: WorkspaceAccess,
    propertyId: string,
  ): Promise<OperatorProperty> {
    const existing = await this.repo.findProperty(propertyId);
    assertContained(existing, workspace.workspaceId, 'Property');

    const facts = await this.repo.publishFactsFor(propertyId);
    if (!facts) throw new NotFoundException('No such property.');
    const early = publishBlockersFor(facts);
    if (early.length > 0) throw this.publishRefusal(early);

    const result = await this.repo.publish(propertyId, (inLock) =>
      publishBlockersFor(inLock),
    );
    if (!result.published) {
      if (result.blockers.length === 0) {
        throw new NotFoundException('No such property.');
      }
      throw this.publishRefusal(result.blockers as PublishBlocker[]);
    }

    return this.getProperty(workspace, propertyId);
  }

  /**
   * Take it back off the marketplace, keeping the address (ADR-049, AC-I6).
   *
   * The slug survives, so a republished property keeps every bookmark and search
   * result already pointing at it. Nothing is checked beyond containment: an
   * operator may always withdraw their own listing.
   */
  async unpublish(
    workspace: WorkspaceAccess,
    propertyId: string,
  ): Promise<OperatorProperty> {
    const existing = await this.repo.findProperty(propertyId);
    assertContained(existing, workspace.workspaceId, 'Property');

    const done = await this.repo.unpublish(propertyId);
    if (!done) throw new NotFoundException('No such property.');
    return this.getProperty(workspace, propertyId);
  }

  /**
   * A 409 that says which condition failed, and carries the rest.
   *
   * The first blocker is the message, because a toast shows one sentence. All of
   * them ride in `blockers` so the screen can mark every section that needs work
   * instead of revealing them one press at a time.
   */
  private publishRefusal(blockers: PublishBlocker[]): ConflictException {
    return new ConflictException({
      message: PUBLISH_BLOCKER_LABEL[blockers[0]],
      blockers,
    });
  }

  /** Refuse an address that points at a sector we do not have. */
  private async districtFor(sectorId: number): Promise<number> {
    const districtId = await this.repo.districtForSector(sectorId);
    if (districtId === null) {
      throw new BadRequestException(
        'That sector does not exist. Pick one from the list.',
      );
    }
    return districtId;
  }

  private toSummary(
    row: PropertyRow,
    counts: { roomTypeCount: number; sellableRoomCount: number } | undefined,
  ): OperatorPropertySummary {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      address: {
        provinceId: row.provinceId,
        provinceName: row.provinceName,
        districtId: row.districtId,
        districtName: row.districtName,
        sectorId: row.sectorId,
        sectorName: row.sectorName,
        street: row.addressText,
      },
      listingStatus: row.listingStatus,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      roomTypeCount: counts?.roomTypeCount ?? 0,
      sellableRoomCount: counts?.sellableRoomCount ?? 0,
    };
  }
}
