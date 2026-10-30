import {
  type AttachPropertyPhotoRequest,
  type PropertyPhoto,
  type ReorderPropertyPhotosRequest,
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
} from '../../../../shared/auth/branch-scope';
import { StorageService } from '../../../storage/application/storage.service';
import { assertContained } from '../domain/containment';
import { InventoryRepository } from '../infrastructure/inventory.repository';
import {
  PropertyPhotosRepository,
  type PropertyPhotoRow,
} from '../infrastructure/property-photos.repository';

/**
 * A property's photographs (ADR-053, AC-I3, AC-I7).
 *
 * Two steps, not one: the bytes went up at
 * `POST /api/v1/uploads/property-photo` and this attaches the KEY. That split is
 * the same one the certificate path already makes, for the same two reasons — a
 * large upload has no business inside a transaction, and a failed attach can be
 * retried without sending the file again.
 *
 * Every photograph comes back with a SHORT LIVED signed URL. The bucket is
 * private, so there is no permanent address to hand out; a caller that needs to
 * show the picture later asks again.
 */
@Injectable()
export class PropertyPhotosService {
  constructor(
    private readonly repo: PropertyPhotosRepository,
    private readonly properties: InventoryRepository,
    private readonly storage: StorageService,
  ) {}

  /** Every photograph on one of the caller's properties. */
  async list(
    workspace: ScopedWorkspace,
    propertyId: string,
  ): Promise<PropertyPhoto[]> {
    await this.assertOwnProperty(workspace, propertyId);
    return this.photosFor(propertyId);
  }

  /**
   * The photographs, signed, for a caller that has ALREADY proven containment.
   *
   * `InventoryService.getProperty` is the caller: it has just read and checked the
   * property, and going back through `list` above would read the same row twice to
   * ask a question it already has the answer to. Named so the missing check is
   * visible at the call site rather than implied.
   */
  async photosFor(propertyId: string): Promise<PropertyPhoto[]> {
    return this.withUrls(await this.repo.listForProperty(propertyId));
  }

  /** Attach an uploaded object. The first one on a property becomes the cover. */
  async attach(
    workspace: ScopedWorkspace,
    propertyId: string,
    request: AttachPropertyPhotoRequest,
  ): Promise<PropertyPhoto[]> {
    await this.assertOwnProperty(workspace, propertyId);

    // The object has to exist and has to be a property photograph. Without this,
    // an attach could point a property at a certificate's key and publish it.
    const stored = await this.storage.describe(request.objectKey);
    if (!stored || stored.kind !== 'property_photo') {
      throw new BadRequestException(
        'That upload is not a property photograph. Upload it again.',
      );
    }

    if (request.roomTypeId && !(await this.repo.roomTypeOnProperty(request.roomTypeId, propertyId))) {
      throw new BadRequestException('That room type is not on this property.');
    }

    await this.repo.attach({
      propertyId,
      objectKey: request.objectKey,
      position: request.position ?? null,
      isCover: request.isCover ?? false,
      caption: request.caption ?? null,
      roomTypeId: request.roomTypeId ?? null,
    });
    return this.withUrls(await this.repo.listForProperty(propertyId));
  }

  /** Apply a new order, captions, and the cover, in one call. */
  async reorder(
    workspace: ScopedWorkspace,
    propertyId: string,
    request: ReorderPropertyPhotosRequest,
  ): Promise<PropertyPhoto[]> {
    await this.assertOwnProperty(workspace, propertyId);

    const current = await this.repo.listForProperty(propertyId);
    const known = new Set(current.map((p) => p.id));
    for (const photo of request.photos) {
      if (!known.has(photo.id)) {
        // 404 rather than 422: naming a photograph that is not on this property is
        // the same probe as naming one that does not exist.
        throw new NotFoundException('No such photograph on this property.');
      }
    }

    const positions = new Set(request.photos.map((p) => p.position));
    if (positions.size !== request.photos.length) {
      throw new BadRequestException('Two photographs cannot share a position.');
    }
    if (request.photos.filter((p) => p.isCover === true).length > 1) {
      throw new ConflictException('Only one photograph can be the cover.');
    }

    await this.repo.reorder({ propertyId, photos: request.photos });
    return this.withUrls(await this.repo.listForProperty(propertyId));
  }

  /**
   * Remove a photograph, refusing the one that would break a published listing.
   *
   * **AC-I7.** The last photograph on a PUBLISHED property is a 409. Publishing
   * requires a photograph, so removing the last one would leave a live listing
   * that could not be published if it were drafted today — an invariant repaired
   * by refusing the write, never by a sweep afterwards.
   */
  async remove(
    workspace: ScopedWorkspace,
    propertyId: string,
    photoId: string,
  ): Promise<PropertyPhoto[]> {
    const property = await this.assertOwnProperty(workspace, propertyId);

    const photo = await this.repo.find(photoId);
    if (!photo || photo.propertyId !== propertyId) {
      throw new NotFoundException('No such photograph on this property.');
    }

    if (property.listingStatus === 'published') {
      const count = await this.repo.countForProperty(propertyId);
      if (count <= 1) {
        throw new ConflictException(
          'This is the only photograph on a published property. ' +
            'Unpublish the property first, or add another photograph.',
        );
      }
    }

    const removed = await this.repo.remove({ propertyId, photoId });
    if (!removed) throw new NotFoundException('No such photograph.');
    return this.withUrls(await this.repo.listForProperty(propertyId));
  }

  /** The property, proven to be the caller's, and its listing state with it. */
  private async assertOwnProperty(
    workspace: ScopedWorkspace,
    propertyId: string,
  ): Promise<{ listingStatus: 'draft' | 'published' }> {
    const property = await this.properties.findProperty(propertyId);
    assertContained(property, workspace.workspaceId, 'Property');
    assertInBranchScope(workspace, property.id, 'Property');
    return { listingStatus: property!.listingStatus };
  }

  /**
   * Sign every key, in parallel.
   *
   * Sequentially would be one round trip per photograph to the object store, on a
   * screen that shows all of them at once.
   */
  private async withUrls(rows: PropertyPhotoRow[]): Promise<PropertyPhoto[]> {
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        objectKey: row.objectKey,
        position: row.position,
        isCover: row.isCover,
        caption: row.caption,
        roomTypeId: row.roomTypeId,
        url: await this.storage.signedUrl(row.objectKey),
      })),
    );
  }
}
