import {
  CreateHrCatalogItemRequest,
  HR_PERMISSIONS,
  HrCatalogKind,
  HrUploadPurpose,
  UpdateHrCatalogItemRequest,
  UpdateHrSettingsRequest,
  type HrCatalogItem,
  type HrCatalogList,
  type HrSettings,
  type HrUpload,
} from '@injishi/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { HrContentService } from '../../../modules/people/application/hr-content.service';
import { HrFilesService } from '../../../modules/people/application/hr-files.service';
import { MAX_HR_FILE_BYTES } from '../../../modules/storage/application/storage.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { UploadThrottlerGuard } from '../uploads/upload-throttler.guard';

/** The slice of the Fastify request the upload route touches (see `uploads.controller.ts`). */
interface MultipartRequest {
  isMultipart?: () => boolean;
  parts?: (options?: { limits?: { fileSize?: number } }) => AsyncIterableIterator<MultipartPart>;
}

type MultipartPart =
  | {
      type: 'file';
      fieldname: string;
      filename?: string;
      file?: { truncated?: boolean };
      toBuffer: () => Promise<Buffer>;
    }
  | { type: 'field'; fieldname: string; value: unknown };

/**
 * The business's HR set up -> /api/v1/ops/hr (ADR-058, 058-people-file): the
 * upload every HR file goes through, the catalogs (AC-PF11) and the HR
 * settings (AC-PF12).
 *
 * Reads of a catalog or the settings are open to any HR permission: a tag's
 * name or a job title is what every HR screen draws with. Every write is
 * `people.manage`'s.
 */
@Controller({ path: 'ops/hr', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsHrController {
  constructor(
    private readonly content: HrContentService,
    private readonly files: HrFilesService,
  ) {}

  /**
   * Upload one file, then attach it by key (058-people-file): a photo, a
   * document or an attachment, named by the `purpose` field beside the file.
   *
   * The object is stored against this workspace, private, and checked to be
   * what the purpose allows by its first bytes, never its name. Nothing points
   * at it until a write hangs it on a file, a document, a note, a policy or a
   * record, and that write checks again that the key is this workspace's and
   * of the right kind. Counted against the same per person upload budget as
   * every other upload route (`UploadThrottlerGuard`). Whoever decides leave
   * may upload an attachment, the sick note a request carries (058-leave
   * AC-LV6), and so may whoever runs pay, the receipt a claim carries
   * (058-payroll AC-PY9); a photo or a document stays `people.manage`'s.
   */
  @Post('files')
  @UseGuards(UploadThrottlerGuard)
  @SkipThrottle({ 'uploads-certificate': true })
  @RequireAnyPermission('people.manage', 'leave.approve', 'payroll.run')
  async upload(
    @Req() request: MultipartRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<HrUpload> {
    if (typeof request.isMultipart !== 'function' || !request.isMultipart() || typeof request.parts !== 'function') {
      throw new BadRequestException('Send the file as multipart/form-data.');
    }
    // Every part is walked, so the purpose may come before or after the file
    // (the reasoning is `UploadsController.attachment`'s). The parser enforces
    // the largest purpose's ceiling before buffering; the purpose's own is
    // checked by the storage service.
    let body: Buffer | null = null;
    let filename = 'file';
    let truncated = false;
    const fields: Record<string, string> = {};
    for await (const part of request.parts({ limits: { fileSize: MAX_HR_FILE_BYTES } })) {
      if (part.type === 'file') {
        const bytes = await part.toBuffer();
        if (body === null) {
          body = bytes;
          filename = part.filename || 'file';
          truncated = part.file?.truncated ?? false;
        }
        continue;
      }
      if (typeof part.value === 'string') fields[part.fieldname] = part.value.trim();
    }
    if (body === null) throw new BadRequestException('No file was sent.');
    if (truncated) throw new BadRequestException('A file must be 10 MB or smaller.');
    const purpose = HrUploadPurpose.safeParse(fields.purpose);
    if (!purpose.success) {
      throw new BadRequestException(`\`purpose\` must be one of: ${HrUploadPurpose.options.join(', ')}.`);
    }
    if (purpose.data !== 'attachment' && !ws.permissions.includes('people.manage')) {
      throw new ForbiddenException('Only someone who keeps the files uploads a photo or a document.');
    }
    return this.files.upload(ws, user.id, { body, filename, purpose: purpose.data });
  }

  @Get('catalog/:kind')
  @RequireAnyPermission(...HR_PERMISSIONS)
  catalog(
    @Param('kind', new ZodValidationPipe(HrCatalogKind)) kind: HrCatalogKind,
    @CurrentWorkspace() ws: ScopedWorkspace,
  ): Promise<HrCatalogList> {
    return this.content.catalog(ws, kind);
  }

  @Post('catalog/:kind')
  @RequirePermission('people.manage')
  addCatalogItem(
    @Param('kind', new ZodValidationPipe(HrCatalogKind)) kind: HrCatalogKind,
    @Body(new ZodValidationPipe(CreateHrCatalogItemRequest)) body: CreateHrCatalogItemRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<HrCatalogItem> {
    return this.content.addCatalogItem(ws, user.id, kind, body);
  }

  /** Rename, retone, archive or bring back; nothing in a catalog is deleted. */
  @Patch('catalog/:kind/:id')
  @RequirePermission('people.manage')
  changeCatalogItem(
    @Param('kind', new ZodValidationPipe(HrCatalogKind)) kind: HrCatalogKind,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateHrCatalogItemRequest)) body: UpdateHrCatalogItemRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<HrCatalogItem> {
    return this.content.changeCatalogItem(ws, user.id, kind, id, body);
  }

  @Get('settings')
  @RequireAnyPermission(...HR_PERMISSIONS)
  settings(@CurrentWorkspace() ws: ScopedWorkspace): Promise<HrSettings> {
    return this.content.settings(ws);
  }

  /** The files' prefix is people.manage's, the draft day and employer number payroll.run's (058-payroll). */
  @Patch('settings')
  @RequireAnyPermission('people.manage', 'payroll.run')
  updateSettings(
    @Body(new ZodValidationPipe(UpdateHrSettingsRequest)) body: UpdateHrSettingsRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<HrSettings> {
    return this.content.updateSettings(ws, user.id, body);
  }
}
