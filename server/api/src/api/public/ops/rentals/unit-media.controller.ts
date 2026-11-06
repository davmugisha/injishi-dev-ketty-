import type { Readable } from 'node:stream';

import {
  ReorderUnitPhotosRequest,
  UNIT_PHOTO_MAX_BYTES,
  UNIT_VIDEO_MAX_BYTES,
  UNIT_VIDEO_POSTER_MAX_BYTES,
  UnitVideoFields,
  type UnitMediaView,
  type UnitPhotoView,
  type UnitVideoView,
} from '@injishi/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { UnitMediaService, type UploadedPhoto } from '../../../../modules/rentals/application/unit-media.service';
import { UnitMediaStorage, type StagedFile } from '../../../../modules/storage/application/unit-media-storage';
import type { ScopedWorkspace } from '../../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../../shared/validation/zod-validation.pipe';
import { UploadThrottlerGuard } from '../../uploads/upload-throttler.guard';

/** The slice of the Fastify request the upload routes touch (see `uploads.controller.ts`). */
interface MultipartRequest {
  isMultipart?: () => boolean;
  parts?: (options?: {
    limits?: { fileSize?: number; files?: number };
    throwFileSizeLimit?: boolean;
  }) => AsyncIterableIterator<MultipartPart>;
}

type MultipartPart =
  | {
      type: 'file';
      fieldname: string;
      filename?: string;
      file: Readable & { truncated?: boolean };
      toBuffer: () => Promise<Buffer>;
    }
  | { type: 'field'; fieldname: string; value: unknown };

const mb = (bytes: number): number => Math.round(bytes / (1024 * 1024));

function partsOf(request: MultipartRequest): NonNullable<MultipartRequest['parts']> {
  if (typeof request.isMultipart !== 'function' || !request.isMultipart() || typeof request.parts !== 'function') {
    throw new BadRequestException('Send the file as multipart/form-data.');
  }
  return request.parts.bind(request);
}

/**
 * A unit's photos and video tour → /api/v1/ops/units/:id/{media,photos,video}
 * (blueprint 2.3, WP 2.3). Residence businesses only.
 *
 * Read by whoever reads units; changed with `unit.manage`. Uploads count
 * against the same per person budget as every other upload route
 * (`UploadThrottlerGuard`). A photo is one multipart file (`file`), at most
 * 10 MB, stored re-encoded. A video is one multipart file (`file`) of at most
 * 100 MB, on this route alone, beside `durationS` (read by the browser),
 * optional `width` and `height`, and an optional `poster` still; it is
 * streamed to a temporary file, never held in memory.
 */
@Controller({ path: 'ops/units', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('residence')
export class OpsUnitMediaController {
  constructor(
    private readonly media: UnitMediaService,
    private readonly files: UnitMediaStorage,
  ) {}

  @Get(':id/media')
  @RequireAnyPermission('unit.manage', 'lease.manage', 'money.view')
  view(@Param('id', ParseUUIDPipe) id: string, @CurrentWorkspace() workspace: ScopedWorkspace): Promise<UnitMediaView> {
    return this.media.view(workspace, id);
  }

  @Post(':id/photos')
  @UseGuards(UploadThrottlerGuard)
  @SkipThrottle({ 'uploads-certificate': true })
  @RequirePermission('unit.manage')
  async addPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: MultipartRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<UnitPhotoView> {
    const parts = partsOf(request);
    await this.media.assertChangeable(workspace, id);
    let photo: UploadedPhoto | null = null;
    let truncated = false;
    for await (const part of parts({ limits: { fileSize: UNIT_PHOTO_MAX_BYTES, files: 1 }, throwFileSizeLimit: false })) {
      if (part.type !== 'file') continue;
      const body = await part.toBuffer();
      if (photo === null) {
        photo = { body, filename: part.filename || 'photo' };
        truncated = part.file.truncated === true;
      }
    }
    if (!photo) throw new BadRequestException('No photo was sent.');
    if (truncated) throw new BadRequestException(`A photo must be ${mb(UNIT_PHOTO_MAX_BYTES)} MB or smaller.`);
    return this.media.addPhoto(workspace, user.id, id, photo);
  }

  @Patch(':id/photos/order')
  @RequirePermission('unit.manage')
  reorder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReorderUnitPhotosRequest)) body: ReorderUnitPhotosRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<UnitMediaView> {
    return this.media.reorderPhotos(workspace, user.id, id, body.photoIds);
  }

  @Delete(':id/photos/:photoId')
  @RequirePermission('unit.manage')
  removePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<UnitMediaView> {
    return this.media.removePhoto(workspace, user.id, id, photoId);
  }

  @Put(':id/video')
  @UseGuards(UploadThrottlerGuard)
  @SkipThrottle({ 'uploads-certificate': true })
  @RequirePermission('unit.manage')
  async setVideo(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: MultipartRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<UnitVideoView> {
    const parts = partsOf(request);
    await this.media.assertChangeable(workspace, id);
    const fields: Record<string, string> = {};
    let staged: StagedFile | null = null;
    let filename = 'video';
    let poster: UploadedPhoto | null = null;
    let posterTooLarge = false;
    try {
      // Every part is walked, so the fields may come before or after the files. The parser stops a file
      // at the video's ceiling; the poster's own is checked here.
      for await (const part of parts({ limits: { fileSize: UNIT_VIDEO_MAX_BYTES, files: 2 }, throwFileSizeLimit: false })) {
        if (part.type === 'field') {
          if (typeof part.value === 'string') fields[part.fieldname] = part.value.trim();
          continue;
        }
        if (part.fieldname === 'poster') {
          const body = await part.toBuffer();
          if (body.byteLength > UNIT_VIDEO_POSTER_MAX_BYTES || part.file.truncated) posterTooLarge = true;
          else poster = { body, filename: part.filename || 'poster' };
          continue;
        }
        if (staged !== null) {
          await part.toBuffer();
          continue;
        }
        const stream = part.file;
        filename = part.filename || 'video';
        staged = await this.files.stageVideo({
          stream,
          truncated: () => stream.truncated === true,
          maxBytes: UNIT_VIDEO_MAX_BYTES,
        });
      }
      if (!staged) throw new BadRequestException('No video was sent.');
      if (posterTooLarge) {
        throw new BadRequestException(`The poster still must be ${mb(UNIT_VIDEO_POSTER_MAX_BYTES)} MB or smaller.`);
      }
      const parsed = UnitVideoFields.safeParse(fields);
      if (!parsed.success) {
        throw new BadRequestException({
          message: 'Validation failed',
          issues: parsed.error.issues.map((i) => ({ code: i.code, path: i.path, message: i.message })),
        });
      }
      return await this.media.setVideo(workspace, user.id, id, { staged, filename, poster, fields: parsed.data });
    } finally {
      await this.files.discard(staged);
    }
  }

  @Delete(':id/video')
  @RequirePermission('unit.manage')
  removeVideo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<UnitMediaView> {
    return this.media.removeVideo(workspace, user.id, id);
  }
}
