import { ForbiddenException, HttpException, Injectable } from '@nestjs/common';

import { resolveBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { TwoFactorService } from '../../../shared/auth/two-factor.service';
import { WorkspaceService } from '../../../shared/auth/workspace.service';

export interface OperatorScope {
  workspace: ScopedWorkspace | null;
  stepUpNeeded: boolean;
}

const NONE: OperatorScope = { workspace: null, stepUpNeeded: false };

/**
 * The operator workspace for one assistant turn (ADR-061 D-f, slice D).
 *
 * The same steps, in the same order, as `WorkspaceGuard`: this session's
 * emailed step up, then membership of the named workspace, then the branch
 * scope from the member's coverage and the `x-branch-id` header. Where the
 * guard would REFUSE, this returns no workspace instead, so the turn still
 * answers help questions and simply has no operator tool. Permissions are
 * checked per tool, against the grant returned here.
 */
@Injectable()
export class OperatorScopeResolver {
  constructor(
    private readonly workspaces: WorkspaceService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  async resolve(input: {
    userId: string | null;
    sessionId: string | null;
    workspaceId: string | undefined;
    branchHeader: string | string[] | undefined;
  }): Promise<OperatorScope> {
    if (!input.userId || !input.workspaceId) return NONE;

    if (input.sessionId) {
      try {
        await this.twoFactor.assertSatisfied(input.userId, input.sessionId);
      } catch (error) {
        if (error instanceof ForbiddenException) return { workspace: null, stepUpNeeded: true };
        throw error;
      }
    }

    const access = await this.workspaces.resolveForUser(input.userId, input.workspaceId);
    if (!access) return NONE;

    try {
      const branchScope = resolveBranchScope(
        await this.workspaces.coveredProperties(input.userId, access),
        input.branchHeader,
      );
      return { workspace: { ...access, branchScope }, stepUpNeeded: false };
    } catch (error) {
      // A branch the member does not cover: the guard refuses with a 4xx, so
      // the assistant gets no workspace rather than a wider one.
      if (error instanceof HttpException && error.getStatus() < 500) return NONE;
      throw error;
    }
  }
}
