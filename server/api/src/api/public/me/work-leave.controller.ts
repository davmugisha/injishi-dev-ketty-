import {
  CreateMyLeaveAllocationRequest,
  CreateMyLeaveRequestRequest,
  type LeaveAllocationRequest,
  type LeaveRequest,
  type MyLeaveAllocationList,
  type MyLeaveBalances,
  type MyLeaveRequestList,
  type MyLeaveTypeList,
  type MyUpload,
} from '@injishi/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

import { MyLeaveService } from '../../../modules/hr/application/my-leave.service';
import { MAX_HR_FILE_BYTES } from '../../../modules/storage/application/storage.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { UploadThrottlerGuard } from '../uploads/upload-throttler.guard';

/** The slice of the Fastify request the upload route touches (see `uploads.controller.ts`). */
interface MultipartRequest {
  isMultipart?: () => boolean;
  parts?: (options?: { limits?: { fileSize?: number } }) => AsyncIterableIterator<MultipartPart>;
}

type MultipartPart =
  | { type: 'file'; fieldname: string; filename?: string; file?: { truncated?: boolean }; toBuffer: () => Promise<Buffer> }
  | { type: 'field'; fieldname: string; value: unknown };

/**
 * A person's own leave -> /api/v1/me/work/:employeeId/leave (ADR-058,
 * 058-self-service AC-SS6, the routes marked 5; 058-leave AC-LV6, AC-LV8).
 *
 * `SessionGuard` only, as every `me/work` route: ownership is the guard, any
 * id that is not the caller's answers 404, and a file the person has left is
 * read only (409). A sick note is uploaded first, to `files`, and the request
 * names its key: the one shape the office's own upload has. A manager reads a
 * request routed to them under `team/requests`, and decides it, if at all, on
 * the operator side.
 */
@Controller({ path: 'me/work', version: '1' })
@UseGuards(SessionGuard)
export class MeWorkLeaveController {
  constructor(private readonly leave: MyLeaveService) {}

  @Get(':employeeId/leave/types')
  types(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: SessionUser): Promise<MyLeaveTypeList> {
    return this.leave.types(user.id, employeeId);
  }

  @Get(':employeeId/leave/balances')
  balances(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: SessionUser): Promise<MyLeaveBalances> {
    return this.leave.balances(user.id, employeeId);
  }

  @Get(':employeeId/leave/requests')
  requests(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: SessionUser): Promise<MyLeaveRequestList> {
    return this.leave.requests(user.id, employeeId);
  }

  @Post(':employeeId/leave/requests')
  createRequest(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body(new ZodValidationPipe(CreateMyLeaveRequestRequest)) body: CreateMyLeaveRequestRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveRequest> {
    return this.leave.createRequest(user.id, employeeId, body);
  }

  @Post(':employeeId/leave/requests/:id/cancel')
  @HttpCode(200)
  cancelRequest(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveRequest> {
    return this.leave.cancelRequest(user.id, employeeId, id);
  }

  @Get(':employeeId/leave/requests/:id/attachment')
  attachment(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    return this.leave.attachment(user.id, employeeId, id);
  }

  @Get(':employeeId/leave/allocation-requests')
  allocationRequests(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<MyLeaveAllocationList> {
    return this.leave.allocationRequests(user.id, employeeId);
  }

  @Post(':employeeId/leave/allocation-requests')
  createAllocation(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body(new ZodValidationPipe(CreateMyLeaveAllocationRequest)) body: CreateMyLeaveAllocationRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveAllocationRequest> {
    return this.leave.createAllocation(user.id, employeeId, body);
  }

  @Post(':employeeId/leave/allocation-requests/:id/cancel')
  @HttpCode(200)
  cancelAllocation(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveAllocationRequest> {
    return this.leave.cancelAllocation(user.id, employeeId, id);
  }

  /**
   * Upload one attachment, then name its key on a request. Checked by its first
   * bytes, never its name, and counted against the same per person budget as
   * every other upload (`UploadThrottlerGuard`).
   */
  @Post(':employeeId/files')
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
    return this.leave.upload(user.id, employeeId, { body, filename });
  }

  // --- A reporting manager's team, read only ------------------------------------------

  @Get(':employeeId/team/requests/leave/:id')
  teamLeave(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveRequest> {
    return this.leave.teamLeave(user.id, employeeId, id);
  }

  @Get(':employeeId/team/requests/allocation/:id')
  teamAllocation(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveAllocationRequest> {
    return this.leave.teamAllocation(user.id, employeeId, id);
  }
}
