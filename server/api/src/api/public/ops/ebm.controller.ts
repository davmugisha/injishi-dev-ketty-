import {
  type EbmCatalogItemList,
  type EbmConnection,
  type EbmConnectStart,
  type EbmCustomerOptionList,
  EbmItemMappingInput,
  EbmSearchQuery,
  type WorkspaceAccess,
} from '@injishi/contracts';
import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { EbmConnectionService } from '../../../modules/platform/fiscal/application/ebm-connection.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireEveryBranch,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The business's RRA EBM account → /api/v1/ops/ebm (ADR-041).
 *
 * `ebm.manage` on the CLASS, reads included. The catalog and the customer list
 * are the taxpayer's own records at the provider, read with the taxpayer's own
 * credential; a receptionist has no reason to browse them, and the connection
 * screen shows the TIN every sale is declared under.
 *
 * The org is the WORKSPACE's org, never a parameter. A connection is keyed by
 * org, and taking the org id from the request would let a manager of one
 * business point another business's sales at their EBM account.
 */
@Controller({ path: 'ops/ebm', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
@RequirePermission('ebm.manage')
export class OpsEbmController {
  constructor(private readonly ebm: EbmConnectionService) {}

  @Get('connection')
  async connection(
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<EbmConnection> {
    return this.ebm.status(orgOf(workspace));
  }

  /** Where to send the taxpayer to consent. The screen performs the redirect. */
  @Post('connect')
  @RequireEveryBranch()
  async connect(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<EbmConnectStart> {
    return this.ebm.start(orgOf(workspace), user.id);
  }

  @Get('items')
  async items(
    @Query(new ZodValidationPipe(EbmSearchQuery)) query: EbmSearchQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<EbmCatalogItemList> {
    return { items: await this.ebm.catalog(orgOf(workspace), query.search) };
  }

  @Get('customers')
  async customers(
    @Query(new ZodValidationPipe(EbmSearchQuery)) query: EbmSearchQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<EbmCustomerOptionList> {
    return { customers: await this.ebm.customers(orgOf(workspace), query.search) };
  }

  @Put('mapping')
  @RequireEveryBranch()
  async mapping(
    @Body(new ZodValidationPipe(EbmItemMappingInput)) body: EbmItemMappingInput,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<EbmConnection> {
    return this.ebm.saveMapping(orgOf(workspace), body);
  }

  /**
   * Stop certifying through this account. Sales confirmed afterwards wait as
   * held until the business connects again; nothing is dropped.
   */
  @Delete('connection')
  @RequireEveryBranch()
  async disconnect(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<EbmConnection> {
    return this.ebm.disconnect(orgOf(workspace), user.id);
  }
}

function orgOf(workspace: WorkspaceAccess): string {
  if (!workspace.orgId) {
    throw new ConflictException('Only a business workspace has an RRA EBM account.');
  }
  return workspace.orgId;
}
