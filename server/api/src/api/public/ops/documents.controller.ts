import {
  DecideDocumentRequest,
  DocumentStatus,
  UpdateDocumentDatesRequest,
  type EmployeeDocument,
  type EmployeeDocumentList,
  type FileLink,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { PeopleFileService } from '../../../modules/hr/application/people-file.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Staff documents -> /api/v1/ops/documents (058-people-file AC-PF4, AC-PF5).
 *
 * Every route is `people.manage`'s alone, whatever the file view (AC-PF2): an
 * ID scan or a medical certificate is not a work field. The list is the
 * Documents lens, every document of the caller's branches; one person's are
 * under their file (`/ops/employees/:id/documents`). A file is never served
 * from here: `GET :id/file` answers a five minute link and records the fetch.
 */
@Controller({ path: 'ops/documents', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsDocumentsController {
  constructor(private readonly peopleFile: PeopleFileService) {}

  @Get()
  @RequirePermission('people.manage')
  list(
    @Query('status', new ZodValidationPipe(DocumentStatus.optional())) status: DocumentStatus | undefined,
    @Query('requestId', new ParseUUIDPipe({ optional: true })) requestId: string | undefined,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<EmployeeDocumentList> {
    return this.peopleFile.documentsInScope(workspace, { status, requestId });
  }

  /** The dates; moving the expiry or the lead clears the reminder, so the new date is reminded once. */
  @Patch(':id')
  @RequirePermission('people.manage')
  updateDates(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateDocumentDatesRequest)) body: UpdateDocumentDatesRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<EmployeeDocument> {
    return this.peopleFile.updateDates(workspace, user.id, id, body);
  }

  /** Approve the newest upload, or refuse it with a reason; a refused one is uploaded again as a new version. */
  @Post(':id/decide')
  @HttpCode(200)
  @RequirePermission('people.manage')
  decide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DecideDocumentRequest)) body: DecideDocumentRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<EmployeeDocument> {
    return this.peopleFile.decide(workspace, user.id, id, body);
  }

  @Get(':id/file')
  @RequirePermission('people.manage')
  file(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FileLink> {
    return this.peopleFile.fileLink(workspace, user.id, id);
  }
}
