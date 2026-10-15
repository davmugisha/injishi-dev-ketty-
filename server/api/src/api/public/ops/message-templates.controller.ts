import type { DeskMessageTemplateList } from '@injishi/contracts';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { MessageTemplatesRepository } from '../../../modules/operations/infrastructure/message-templates.repository';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';

/**
 * The business's desk reply templates → `GET /api/v1/ops/message-templates` (interface real-data).
 *
 * `message.send`, the permission of the inbox they are inserted into: a template is only ever text
 * the desk puts in a draft and then sends as an ordinary reply, so whoever may reply may read them.
 * Read only for now; editing them belongs to the business's settings.
 */
@Controller({ path: 'ops/message-templates', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsMessageTemplatesController {
  constructor(private readonly templates: MessageTemplatesRepository) {}

  @Get()
  @RequirePermission('message.send')
  async list(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<DeskMessageTemplateList> {
    const rows = await this.templates.listActive(workspace.workspaceId);
    return {
      templates: rows.map((r) => ({
        id: r.id,
        key: r.key,
        label: r.label,
        bodies: { en: r.bodyEn, rw: r.bodyRw, fr: r.bodyFr },
      })),
    };
  }
}
