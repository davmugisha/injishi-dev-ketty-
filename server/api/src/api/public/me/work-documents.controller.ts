import {
  UploadEmployeeDocumentRequest,
  type EmployeeDocument,
  type EmployeeDocumentList,
  type MyUpload,
} from '@injishi/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { MyDocumentsService } from '../../../modules/hr/application/my-documents.service';
import { MAX_HR_FILE_BYTES } from '../../../modules/storage/application/storage.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { UploadThrottlerGuard } from '../uploads/upload-throttler.guard';

interface MultipartPart {
  type: string;
  filename?: string;
  file?: { truncated?: boolean };
  toBuffer: () => Promise<Buffer>;
}
interface MultipartRequest {
  isMultipart?: () => boolean;
  parts?: (options?: { limits?: { fileSize?: number } }) => AsyncIterableIterator<MultipartPart>;
}

/**
 * A person's own documents -> /api/v1/me/work/:employeeId/documents (ADR-058,
 * 058-self-service; 058-people-file AC-PF4).
 *
 * `SessionGuard` only, as every `me/work` route: ownership is the guard, any
 * id that is not the caller's answers 404, and a file the person has left is
 * read only (409). A document is handed in in two steps, as a claim's receipt
 * is: the file goes to `documents/files` and answers a key, then `documents`
 * names the key, with the requested document it answers or a title of its own.
 * What arrives waits for the office to check it.
 */
@Controller({ path: 'me/work', version: '1' })
@UseGuards(SessionGuard)
export class MeWorkDocumentsController {
  constructor(private readonly documents: MyDocumentsService) {}

  /**
   * Everything the person has handed in, with where each stands. At
   * `documents/handed-in` since the staff phone's own `GET documents`
   * (work-staff.controller, merged from main 2026-10-26) took the bare path.
   */
  @Get(':employeeId/documents/handed-in')
  list(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: SessionUser): Promise<EmployeeDocumentList> {
    return this.documents.list(user.id, employeeId);
  }

  @Post(':employeeId/documents')
  handIn(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body(new ZodValidationPipe(UploadEmployeeDocumentRequest)) body: UploadEmployeeDocumentRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<EmployeeDocument> {
    return this.documents.handIn(user.id, employeeId, body);
  }

  /**
   * Upload the file of a document, then name its key on `documents`. Checked
   * by its first bytes, never its name, and counted against the same per
   * person budget as every other upload (`UploadThrottlerGuard`).
   */
  @Post(':employeeId/documents/files')
  @UseGuards(UploadThrottlerGuard)
  @SkipThrottle({ 'uploads-certificate': true })
  async upload(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Req() request: MultipartRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<MyUpload> {
    if (typeof request.isMultipart !== 'function' || !request.isMultipart() || typeof request.parts !== 'function') {
      throw new BadRequestException('Send the file as multipart/form-data.');
    }
    let body: Buffer | null = null;
    let filename = 'file';
    let truncated = false;
    for await (const part of request.parts({ limits: { fileSize: MAX_HR_FILE_BYTES } })) {
      if (part.type !== 'file') continue;
      const bytes = await part.toBuffer();
      if (body === null) {
        body = bytes;
        filename = part.filename || 'file';
        truncated = part.file?.truncated ?? false;
      }
    }
    if (body === null) throw new BadRequestException('No file was sent.');
    if (truncated) throw new BadRequestException('A file must be 10 MB or smaller.');
    return this.documents.uploadFile(user.id, employeeId, { body, filename });
  }
}
