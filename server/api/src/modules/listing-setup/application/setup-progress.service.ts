import type { PropertySetupProgress, WorkspaceAccess } from '@injishi/contracts';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { SetupProgressRepository } from '../infrastructure/setup-progress.repository';

/**
 * How far an approved business has got with setting up (2026-09-13).
 *
 * Read behind `listing.manage`, like every inventory route, so the checklist is
 * closed to a business the approver has not activated (D20, and the user's
 * ruling that nothing is editable before approval). A property named in the
 * query must belong to the workspace; any other is a 404, never a count of
 * somebody else's rooms.
 */
@Injectable()
export class SetupProgressService {
  constructor(private readonly repo: SetupProgressRepository) {}

  async progress(
    workspace: WorkspaceAccess,
    propertyId: string | undefined,
  ): Promise<PropertySetupProgress> {
    if (!workspace.orgId) {
      throw new BadRequestException('Only a business workspace has a property to set up.');
    }
    const business = await this.repo.business(workspace.orgId);
    if (!business) throw new NotFoundException('Business not found.');

    const properties = await this.repo.propertiesIn(workspace.workspaceId);
    const property = propertyId
      ? properties.find((p) => p.id === propertyId)
      : properties[0];
    if (propertyId && !property) throw new NotFoundException('Property not found.');

    const counts = await this.repo.counts({
      orgId: business.orgId,
      workspaceId: workspace.workspaceId,
      propertyId: property?.id ?? null,
      propertyCount: properties.length,
    });

    return {
      orgId: business.orgId,
      legalName: business.legalName,
      domain: business.domain,
      accommodationClass: business.accommodationClass,
      propertyId: property?.id ?? null,
      propertyName: property?.name ?? null,
      counts,
    };
  }
}
