import {
  BRANCH_ARCHIVE_BLOCKER_LABEL,
  type BranchArchiveReason,
  type CreatePropertyRequest,
  type OperatorProperty,
  type OperatorPropertySummary,
  policiesFromRow,
  PUBLISH_BLOCKER_LABEL,
  type PublishBlocker,
  type StarGradeStatus,
  type UpdatePropertyRequest,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  assertCoversEveryBranch,
  assertInBranchScope,
  type ScopedWorkspace,
} from '../../../../shared/auth/branch-scope';
import { assertContained } from '../domain/containment';
import {
  BranchesRepository,
  type BranchMoveResult,
} from '../infrastructure/branches.repository';
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
    private readonly branches: BranchesRepository,
    private readonly photos: PropertyPhotosService,
  ) {}

  /**
   * Every property in the caller's workspace. Archived branches only when asked
   * for, because only the Branches screen shows them (ADR-054).
   */
  async listProperties(
    workspace: ScopedWorkspace,
    includeArchived = false,
  ): Promise<OperatorPropertySummary[]> {
    const [rows, counts] = await Promise.all([
      this.repo.findPropertiesInWorkspace(
        workspace.workspaceId,
        workspace.branchScope,
        includeArchived,
      ),
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
    workspace: ScopedWorkspace,
    request: CreatePropertyRequest,
    actorUserId: string,
  ): Promise<OperatorProperty> {
    if (!workspace.orgId) {
      // A personal or broker workspace has no org to hang a property on. The
      // guard cannot express this, because holding such a workspace is normal.
      throw new BadRequestException(
        'Properties belong to a business workspace.',
      );
    }

    // Adding a branch reshapes the whole business, so a member limited to some
    // branches may not (ADR-054 AC-M6). No fee and no review: a branch created
    // here is usable at once (AC-M1).
    assertCoversEveryBranch(workspace);

    const districtId = await this.districtFor(request.sectorId);
    if (request.villageId != null) await this.assertVillageIn(request.villageId, request.sectorId);

    const propertyId = await this.repo.createProperty({
      orgId: workspace.orgId,
      workspaceId: workspace.workspaceId,
      districtId,
      actorUserId,
      request,
    });
    // The branch scope was resolved by the guard before this branch existed,
    // so its list of covered properties cannot name it, and reading it back
    // through that scope answered "Property not found." for a branch that had
    // just been created. The caller covers every branch (asserted above), so
    // the new one is theirs: read it back with it added to the scope.
    const scope = workspace.branchScope;
    return this.getProperty(
      { ...workspace, branchScope: { ...scope, propertyIds: [...scope.propertyIds, propertyId] } },
      propertyId,
    );
  }

  /**
   * Edit a property, replacing only the fields that were sent.
   *
   * Setting the RRA branch id changes where this branch's sales are declared, so
   * it needs `ebm.manage` as well as the route's `listing.manage`, and it is
   * refused when another branch of the org, archived ones included, holds the
   * same id (ADR-054 AC-M2, invariant 3).
   */
  async updateProperty(
    workspace: ScopedWorkspace,
    propertyId: string,
    request: UpdatePropertyRequest,
    actorUserId: string,
  ): Promise<OperatorProperty> {
    const existing = await this.repo.findProperty(propertyId);
    assertContained(existing, workspace.workspaceId, 'Property');
    assertInBranchScope(workspace, existing.id, 'Property');

    if (request.rraBranchId !== undefined) {
      if (!workspace.permissions.includes('ebm.manage')) {
        throw new ForbiddenException(
          'Setting the RRA branch id needs the power to connect the RRA EBM account.',
        );
      }
      if (
        request.rraBranchId !== null &&
        (await this.branches.rraBranchIdTaken(
          existing.orgId,
          request.rraBranchId,
          propertyId,
        ))
      ) {
        throw this.rraTaken(request.rraBranchId);
      }
    }

    // The derived district moves with the sector, or an edit would leave the
    // property filed under the district it used to be in.
    const districtId =
      request.sectorId === undefined
        ? null
        : await this.districtFor(request.sectorId);
    if (request.villageId != null) {
      await this.assertVillageIn(request.villageId, request.sectorId ?? existing.sectorId);
    }
    if ((request.latitude === undefined) !== (request.longitude === undefined)) {
      throw new BadRequestException('Send the map point whole: its latitude and its longitude.');
    }

    const outcome = await this.repo.updateProperty({
      propertyId,
      districtId,
      actorUserId,
      request,
    });
    if (outcome === 'rra_taken') throw this.rraTaken(request.rraBranchId ?? '');
    return this.getProperty(workspace, propertyId);
  }

  /**
   * Archive a branch (ADR-054 AC-M3), or refuse with every reason that holds.
   *
   * The 409 carries `reasons` so the screen lists them all at once; `message`
   * is the first, because a toast shows one sentence.
   */
  async archiveBranch(
    workspace: ScopedWorkspace,
    propertyId: string,
    actorUserId: string,
  ): Promise<OperatorProperty> {
    await this.containedBranch(workspace, propertyId);
    const result = await this.branches.archive(propertyId, actorUserId);
    this.throwUnlessDone(result, 'That branch is already archived.');
    return this.getProperty(workspace, propertyId);
  }

  /** Bring an archived branch back. Its listing stays a draft (AC-M4). */
  async restoreBranch(
    workspace: ScopedWorkspace,
    propertyId: string,
    actorUserId: string,
  ): Promise<OperatorProperty> {
    await this.containedBranch(workspace, propertyId);
    const result = await this.branches.restore(propertyId, actorUserId);
    this.throwUnlessDone(result, 'That branch is already archived.');
    return this.getProperty(workspace, propertyId);
  }

  /**
   * Make this branch the head office (AC-M5). Answers with every active branch,
   * because two rows changed and the screen redraws both.
   */
  async makeHeadOffice(
    workspace: ScopedWorkspace,
    propertyId: string,
    actorUserId: string,
  ): Promise<OperatorPropertySummary[]> {
    await this.containedBranch(workspace, propertyId);
    const result = await this.branches.makeHeadOffice(propertyId, actorUserId);
    this.throwUnlessDone(
      result,
      'An archived branch cannot be the head office. Restore it first.',
    );
    return this.listProperties(workspace);
  }

  /** The org wide moves need every branch (AC-M6), and the row must be ours. */
  private async containedBranch(
    workspace: ScopedWorkspace,
    propertyId: string,
  ): Promise<void> {
    const existing = await this.repo.findProperty(propertyId);
    assertContained(existing, workspace.workspaceId, 'Property');
    assertInBranchScope(workspace, existing.id, 'Property');
    assertCoversEveryBranch(workspace);
  }

  private throwUnlessDone(result: BranchMoveResult, stateMessage: string): void {
    switch (result.kind) {
      case 'done':
        return;
      case 'missing':
        throw new NotFoundException('No such property.');
      case 'archived':
        throw new ConflictException(stateMessage);
      case 'not_archived':
        throw new ConflictException('That branch is not archived.');
      case 'not_hospitality':
        throw new ConflictException(
          'Only a hospitality business has a head office.',
        );
      case 'refused':
        throw this.archiveRefusal(result.reasons);
    }
  }

  private archiveRefusal(reasons: BranchArchiveReason[]): ConflictException {
    const first = reasons[0];
    const label = BRANCH_ARCHIVE_BLOCKER_LABEL[first.code];
    return new ConflictException({
      message:
        first.members && first.members.length > 0
          ? `${label} (${first.members.join(', ')})`
          : label,
      reasons,
    });
  }

  private rraTaken(rraBranchId: string): ConflictException {
    return new ConflictException(
      `Another branch of this business already uses RRA branch id ${rraBranchId}. Each branch needs its own.`,
    );
  }

  /** One property in full, draft or published. */
  async getProperty(
    workspace: ScopedWorkspace,
    propertyId: string,
  ): Promise<OperatorProperty> {
    const row = await this.repo.findProperty(propertyId);
    assertContained(row, workspace.workspaceId, 'Property');
    assertInBranchScope(workspace, row.id, 'Property');

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
      ...policiesFromRow(row as PropertyRow),
      locationPrivacy: (row as PropertyRow).locationPrivacy,
      timezone: (row as PropertyRow).timezone,
      contactPhone: (row as PropertyRow).contactPhone,
      contactEmail: (row as PropertyRow).contactEmail,
      latitude: (row as PropertyRow).latitude === null ? null : Number((row as PropertyRow).latitude),
      longitude: (row as PropertyRow).longitude === null ? null : Number((row as PropertyRow).longitude),
      photos,
      roomTypes,
    };
  }

  /** 0118: the business's star grade, as its owner sees it: the grade and whether an officer confirmed it. */
  async starGrade(workspace: ScopedWorkspace): Promise<StarGradeStatus> {
    const row = await this.repo.starGradeFor(workspace.workspaceId);
    if (!row) throw new NotFoundException('No business behind this workspace.');
    return { grade: row.grade, verifiedAt: row.verifiedAt?.toISOString() ?? null };
  }

  /**
   * 0118: say the business's star grade. It is the owner's word until an officer checks it against RDB's
   * grading certificate, so saying it again, even the same grade, withdraws the confirmation.
   */
  async setStarGrade(workspace: ScopedWorkspace, grade: number | null): Promise<StarGradeStatus> {
    // The grade is the whole business's, so a member who covers only some branches may not change it.
    assertCoversEveryBranch(workspace);
    await this.repo.setStarGrade(workspace.workspaceId, grade);
    return this.starGrade(workspace);
  }

  /**
   * Put a property on the marketplace (ADR-053, AC-I4, AC-I5, AC-I10).
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
    workspace: ScopedWorkspace,
    propertyId: string,
  ): Promise<OperatorProperty> {
    const existing = await this.repo.findProperty(propertyId);
    assertContained(existing, workspace.workspaceId, 'Property');
    assertInBranchScope(workspace, existing.id, 'Property');

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
   * What would stop `publish` today, without publishing (ADR-061 slice D).
   *
   * The same containment, branch scope and blocker rule `publish` applies, in
   * the same order, so the support assistant's answer to "why can't I publish"
   * is exactly what pressing Publish would refuse with. Writes nothing. An
   * empty list means publishing would pass its checks now.
   */
  async publishBlockers(
    workspace: ScopedWorkspace,
    propertyId: string,
  ): Promise<PublishBlocker[]> {
    const existing = await this.repo.findProperty(propertyId);
    assertContained(existing, workspace.workspaceId, 'Property');
    assertInBranchScope(workspace, existing.id, 'Property');

    const facts = await this.repo.publishFactsFor(propertyId);
    if (!facts) throw new NotFoundException('No such property.');
    return publishBlockersFor(facts);
  }

  /**
   * Take it back off the marketplace, keeping the address (ADR-053, AC-I6).
   *
   * The slug survives, so a republished property keeps every bookmark and search
   * result already pointing at it. Nothing is checked beyond containment: an
   * operator may always withdraw their own listing.
   */
  async unpublish(
    workspace: ScopedWorkspace,
    propertyId: string,
  ): Promise<OperatorProperty> {
    const existing = await this.repo.findProperty(propertyId);
    assertContained(existing, workspace.workspaceId, 'Property');
    assertInBranchScope(workspace, existing.id, 'Property');

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

  /** Refuse a village that does not exist or lies outside the property's sector. */
  private async assertVillageIn(villageId: number, sectorId: number | null): Promise<void> {
    const villageSector = await this.repo.sectorForVillage(villageId);
    if (villageSector === null) {
      throw new BadRequestException('That village does not exist. Pick one from the list.');
    }
    if (villageSector !== sectorId) {
      throw new BadRequestException('That village is not in the sector the property is in.');
    }
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
        cellId: row.cellId,
        cellName: row.cellName,
        villageId: row.villageId,
        villageName: row.villageName,
        street: row.addressText,
      },
      listingStatus: row.listingStatus,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      roomTypeCount: counts?.roomTypeCount ?? 0,
      sellableRoomCount: counts?.sellableRoomCount ?? 0,
      isHeadOffice: row.isHeadOffice,
      rraBranchId: row.rraBranchId,
      branchCode: row.branchCode,
      archivedAt: row.archivedAt?.toISOString() ?? null,
    };
  }
}
