import { Injectable, UnprocessableEntityException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { StorageService, hrFileKind, type HrFilePurpose } from '../../storage/application/storage.service';

/** How long a link to a private HR file lives (058-people-file AC-PF4). */
export const HR_FILE_LINK_SECONDS = 300;

/**
 * Upload, then attach by key (058-people-file): the HR side of the storage seam.
 *
 * A key arrives in a JSON body the client wrote, so before anything hangs it
 * on a note, a document, a policy or a person it is checked to be an object
 * THIS workspace uploaded, of the kind the purpose stores. Without the check a
 * caller could attach another business's ID scan, or a document as a photo.
 */
@Injectable()
export class HrFilesService {
  constructor(private readonly storage: StorageService) {}

  upload(
    ws: Pick<ScopedWorkspace, 'workspaceId'>,
    userId: string,
    input: { body: Buffer; filename: string; purpose: HrFilePurpose },
  ): Promise<{ objectKey: string; purpose: HrFilePurpose; mime: string; sizeBytes: number }> {
    return this.storage.putHrFile({ ...input, uploadedByUserId: userId, workspaceId: ws.workspaceId });
  }

  /** Each key must be this workspace's object of the purpose's kind; answers what each is. */
  async assertOwn(
    ws: Pick<ScopedWorkspace, 'workspaceId'>,
    purpose: HrFilePurpose,
    keys: readonly string[],
  ): Promise<Map<string, { mime: string | null; sizeBytes: number | null }>> {
    const out = new Map<string, { mime: string | null; sizeBytes: number | null }>();
    for (const key of new Set(keys)) {
      const object = await this.storage.describe(key);
      if (!object || object.kind !== hrFileKind(purpose) || object.workspaceId !== ws.workspaceId) {
        throw new UnprocessableEntityException('A file is not one uploaded here for this.');
      }
      out.set(key, { mime: object.mime, sizeBytes: object.sizeBytes });
    }
    return out;
  }

  link(objectKey: string): Promise<string> {
    return this.storage.signedUrl(objectKey, HR_FILE_LINK_SECONDS);
  }
}
