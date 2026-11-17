import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { serviceItems } from '../../../database/drizzle/schema';
import { inBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { uploadedKey } from '../../outlets/domain/menu-photo';
import { MenuPhotoStorage } from '../../storage/application/menu-photo-storage';
import { outletInScope } from '../infrastructure/pos-support';

/**
 * A menu item's own photo: uploaded from Create recipe, then shown by the till, the bill lines, the menu and stock.
 *
 * The upload is stored and recorded first and named `upload:<storedObjectId>`; it reaches an item only when the
 * recipe is saved with it (the catalogue checks the file is this workspace's). A photo picked and then abandoned stays
 * stored and unused, like any upload never attached. Reading serves the bytes of the photo an item holds now, to
 * anyone the item's branch is open to; the address carries a version, so a replaced photo is fetched afresh.
 */
@Injectable()
export class PosMenuPhotoService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly photos: MenuPhotoStorage,
  ) {}

  async upload(
    ws: ScopedWorkspace,
    outletId: string,
    userId: string,
    file: { body: Buffer; filename: string },
  ): Promise<{ photo: string }> {
    await outletInScope(this.db, ws, outletId);
    const stored = await this.photos.putPhoto({
      body: file.body,
      filename: file.filename,
      uploadedByUserId: userId,
      workspaceId: ws.workspaceId,
    });
    return { photo: `upload:${stored.id}` };
  }

  async read(ws: ScopedWorkspace, itemId: string): Promise<Buffer> {
    const [item] = await this.db
      .select({ photoObjectKeys: serviceItems.photoObjectKeys })
      .from(serviceItems)
      .where(
        and(
          eq(serviceItems.id, itemId),
          eq(serviceItems.workspaceId, ws.workspaceId),
          inBranchScope(serviceItems.propertyId, ws.branchScope),
        ),
      )
      .limit(1);
    const key = item ? uploadedKey(item.photoObjectKeys) : null;
    if (!key) throw new NotFoundException('This product has no uploaded photo.');
    try {
      return await this.photos.read(key);
    } catch {
      throw new NotFoundException('This product has no uploaded photo.');
    }
  }
}
