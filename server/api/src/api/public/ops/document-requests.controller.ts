import { CreateDocumentRequestRequest, type DocumentRequestList } from '@injishi/contracts';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

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
  RequireProduct,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Document requests -> /api/v1/ops/document-requests (058-people-file AC-PF4).
 *
 * A request is the template; each person named gets their own document row,
 * and `document.requested` goes to the outbox for each, so the automations can
 * tell them. The list counts only the documents of people in the caller's
 * branches.
 */
@Controller({ path: 'ops/document-requests', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('hr')
export class OpsDocumentRequestsController {
  constructor(private readonly peopleFile: PeopleFileService) {}

  @Get()
  @RequirePermission('people.manage')
  list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<DocumentRequestList> {
    return this.peopleFile.requests(workspace);
  }

  @Post()
  @RequirePermission('people.manage')
  create(
    @Body(new ZodValidationPipe(CreateDocumentRequestRequest)) body: CreateDocumentRequestRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<DocumentRequestList> {
    return this.peopleFile.request(workspace, user.id, body);
  }
}
