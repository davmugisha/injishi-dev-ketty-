import { UpdatePayAccountRequest, type PayAccount } from '@injishi/contracts';
import { Body, Controller, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';

import { PeopleFileService } from '../../../modules/hr/application/people-file.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequireProduct,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * One pay account -> /api/v1/ops/pay-accounts/:id (058-people-file AC-PF3).
 *
 * An account is never edited in place: it is retired, or made the primary
 * one. A person's accounts are read and added under their file
 * (`/ops/employees/:id/pay-accounts`); this is the one route that names an
 * account by itself. Changing the primary account writes
 * `pay_account.changed`, so a salary is never redirected in silence.
 */
@Controller({ path: 'ops/pay-accounts', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequireProduct('hr')
export class OpsPayAccountsController {
  constructor(private readonly peopleFile: PeopleFileService) {}

  @Patch(':id')
  @RequireAnyPermission('people.manage', 'payroll.run')
  change(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePayAccountRequest)) body: UpdatePayAccountRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PayAccount> {
    return this.peopleFile.changePayAccount(workspace, user.id, id, body);
  }
}
