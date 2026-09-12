import type {
  AddAmenityRequest,
  OperatorAmenity,
  WorkspaceAccess,
} from '@injishi/contracts';
import { BadRequestException, Injectable } from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import { AmenitiesRepository } from '../infrastructure/amenities.repository';

/**
 * What a property offers (ADR-012 step 4, `amenity.manage`).
 *
 * Scoped to a PROPERTY, not to the workspace, because a workspace can hold
 * several properties and "the amenities of this workspace" is not a question
 * anyone asks. The property is proved to belong to the caller's workspace on
 * every call, read and write alike: a read that skipped it would let a caller
 * enumerate a competitor's offering one property id at a time.
 */
@Injectable()
export class AmenitiesService {
  constructor(private readonly amenities: AmenitiesRepository) {}

  async list(
    ws: WorkspaceAccess,
    propertyId: string,
  ): Promise<OperatorAmenity[]> {
    const property = assertOwned(
      await this.amenities.findProperty(propertyId),
      ws,
    );
    return this.amenities.listForProperty(property.id);
  }

  async add(
    ws: WorkspaceAccess,
    body: AddAmenityRequest,
  ): Promise<OperatorAmenity[]> {
    const property = assertOwned(
      await this.amenities.findProperty(body.propertyId),
      ws,
    );

    // Checked against the catalog before the insert so the refusal names the
    // problem. The foreign key would also stop it, with a message about a
    // constraint that means nothing to whoever is standing at the desk.
    if (!(await this.amenities.catalogHas(body.amenityCode))) {
      throw new BadRequestException(
        `There is no amenity called "${body.amenityCode}" in the catalog.`,
      );
    }

    await this.amenities.add(property.id, body.amenityCode);
    return this.amenities.listForProperty(property.id);
  }

  /**
   * Stop offering an amenity.
   *
   * Removing one that was never offered is not an error: the caller asked for a
   * state, and that state is already true. Refusing would make a retry after a
   * dropped connection look like a mistake.
   */
  async remove(
    ws: WorkspaceAccess,
    propertyId: string,
    amenityCode: string,
  ): Promise<OperatorAmenity[]> {
    const property = assertOwned(
      await this.amenities.findProperty(propertyId),
      ws,
    );
    await this.amenities.remove(property.id, amenityCode);
    return this.amenities.listForProperty(property.id);
  }
}
