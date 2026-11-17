import type { Readable } from 'node:stream';

import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { PosMenuPhotoService } from '../../../modules/pos/application/pos-menu-photo.service';
import { MENU_PHOTO_MAX_BYTES } from '../../../modules/storage/application/menu-photo-storage';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { UploadThrottlerGuard } from '../uploads/upload-throttler.guard';

interface MultipartRequest {
  isMultipart?: () => boolean;
  parts?: (options?: {
    limits?: { fileSize?: number; files?: number };
    throwFileSizeLimit?: boolean;
  }) => AsyncIterableIterator<
    | { type: 'file'; fieldname: string; filename?: string; file: Readable & { truncated?: boolean }; toBuffer: () => Promise<Buffer> }
    | { type: 'field'; fieldname: string; value: unknown }
  >;
}

interface PhotoReply {
  header(key: string, value: string): PhotoReply;
  send(payload?: Buffer | string): PhotoReply;
}

/**
 * A menu item's own photo (Create recipe → Upload your own). The upload takes ONE picture as multipart/form-data,
 * checked by its bytes, re-encoded and stored (PosMenuPhotoService); the recipe is then saved with the
 * `upload:<id>` it returns. The read serves the photo an item holds, as a JPEG, to anyone who may see the till,
 * the menu or stock; its address carries a version, so it may be cached for good.
 */
@Controller({ path: 'ops/pos', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('pos')
export class OpsPosMenuPhotoController {
  constructor(private readonly photos: PosMenuPhotoService) {}

  @Post('outlets/:outletId/menu-photos')
  @UseGuards(UploadThrottlerGuard)
  @SkipThrottle({ 'uploads-certificate': true })
  @RequirePermission('menu.manage')
  async upload(
    @Param('outletId', ParseUUIDPipe) outletId: string,
    @Req() request: MultipartRequest,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<{ photo: string }> {
    if (typeof request.isMultipart !== 'function' || !request.isMultipart() || typeof request.parts !== 'function') {
      throw new BadRequestException('Send the photo as multipart/form-data.');
    }
    let file: { body: Buffer; filename: string } | null = null;
    let truncated = false;
    for await (const part of request.parts({
      limits: { fileSize: MENU_PHOTO_MAX_BYTES, files: 1 },
      throwFileSizeLimit: false,
    })) {
      if (part.type !== 'file') continue;
      const body = await part.toBuffer();
      if (file === null) {
        file = { body, filename: part.filename || 'photo' };
        truncated = part.file.truncated === true;
      }
    }
    if (!file) throw new BadRequestException('No photo was sent.');
    if (truncated) throw new BadRequestException('A photo must be 8 MB or smaller.');
    return this.photos.upload(ws, outletId, user.id, file);
  }

  @Get('menu-photos/:itemId')
  @RequireAnyPermission('pos.sell', 'pos.checkout', 'menu.manage', 'stock.manage')
  async photo(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentWorkspace() ws: ScopedWorkspace,
    @Res() reply: PhotoReply,
  ): Promise<void> {
    const bytes = await this.photos.read(ws, itemId);
    reply
      .header('Content-Type', 'image/jpeg')
      .header('Cache-Control', 'private, max-age=31536000, immutable')
      .header('X-Content-Type-Options', 'nosniff')
      .send(bytes);
  }
}
