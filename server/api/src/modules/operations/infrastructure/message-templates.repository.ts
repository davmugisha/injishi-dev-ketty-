import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';

import { messageTemplates } from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

export interface MessageTemplateRow {
  id: string;
  key: string;
  label: string;
  bodyEn: string;
  bodyRw: string | null;
  bodyFr: string | null;
}

/** The business's desk reply templates (`message_templates`), scoped in the query to one workspace. */
@Injectable()
export class MessageTemplatesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listActive(workspaceId: string): Promise<MessageTemplateRow[]> {
    return this.db
      .select({
        id: messageTemplates.id,
        key: messageTemplates.key,
        label: messageTemplates.label,
        bodyEn: messageTemplates.bodyEn,
        bodyRw: messageTemplates.bodyRw,
        bodyFr: messageTemplates.bodyFr,
      })
      .from(messageTemplates)
      .where(and(eq(messageTemplates.workspaceId, workspaceId), eq(messageTemplates.active, true)))
      .orderBy(asc(messageTemplates.sortOrder), asc(messageTemplates.label));
  }
}
