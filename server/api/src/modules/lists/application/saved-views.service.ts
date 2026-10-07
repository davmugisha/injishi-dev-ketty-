import {
  isListKey,
  LIST_READ,
  SavedViewConfig,
  type CreateSavedViewRequest,
  type ListKey,
  type SavedView,
  type SavedViewList,
  type UpdateSavedViewRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { SavedViewsRepository, type SavedViewRow } from '../infrastructure/saved-views.repository';

/**
 * Saved list views (058-list-framework AC-LF5).
 *
 * A view is configuration only. Saving or reading one needs the permission that
 * list's own route declares (`LIST_READ`), checked here because the route serves
 * every list and so can only declare their union. Opening a shared view gives
 * nothing: its rows still come from the list route, through the viewer's own
 * permissions and branch limits.
 */
@Injectable()
export class SavedViewsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly views: SavedViewsRepository,
  ) {}

  async list(ws: ScopedWorkspace, userId: string, listKey: string): Promise<SavedViewList> {
    const key = this.readable(ws, listKey);
    const rows = await this.views.visible(this.orgOf(ws), userId, key);
    return { views: rows.map((r) => present(r, userId)) };
  }

  async create(ws: ScopedWorkspace, userId: string, body: CreateSavedViewRequest): Promise<SavedView> {
    const key = this.readable(ws, body.listKey);
    const orgId = this.orgOf(ws);
    let id: string;
    try {
      id = await this.db.transaction(async (tx) => {
        if (body.isDefault) await this.views.clearDefault(tx, orgId, userId, key);
        return this.views.insert(tx, {
          orgId,
          userId,
          listKey: key,
          name: body.name.trim(),
          config: body.config,
          shared: body.shared,
          isDefault: body.isDefault,
        });
      });
    } catch (error) {
      throw this.translate(error, body.name);
    }
    return this.presentById(id, userId);
  }

  async update(ws: ScopedWorkspace, userId: string, id: string, body: UpdateSavedViewRequest): Promise<SavedView> {
    const row = await this.ownView(ws, userId, id);
    try {
      await this.db.transaction(async (tx) => {
        if (body.isDefault) await this.views.clearDefault(tx, row.orgId, userId, row.listKey);
        await this.views.update(tx, row.id, {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.config !== undefined ? { config: body.config } : {}),
          ...(body.shared !== undefined ? { shared: body.shared } : {}),
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        });
      });
    } catch (error) {
      throw this.translate(error, body.name ?? row.name);
    }
    return this.presentById(row.id, userId);
  }

  async remove(ws: ScopedWorkspace, userId: string, id: string): Promise<void> {
    const row = await this.ownView(ws, userId, id);
    await this.views.delete(row.id);
  }

  // --- Helpers -------------------------------------------------------------

  private orgOf(ws: ScopedWorkspace): string {
    if (!ws.orgId) throw new NotFoundException('Only a business has saved views.');
    return ws.orgId;
  }

  /** The list key, if it exists and the caller may read that list. */
  private readable(ws: ScopedWorkspace, listKey: string): ListKey {
    if (!isListKey(listKey)) throw new NotFoundException('There is no such list.');
    const needed: readonly string[] = LIST_READ[listKey];
    if (!needed.some((p) => ws.permissions.includes(p as never))) {
      throw new ForbiddenException('Your role does not open this list.');
    }
    return listKey;
  }

  /** A view only its author may change; anyone else gets 404, so ids are not a directory. */
  private async ownView(ws: ScopedWorkspace, userId: string, id: string): Promise<SavedViewRow> {
    const row = await this.views.find(id);
    if (!row || row.orgId !== ws.orgId || row.userId !== userId) throw new NotFoundException();
    this.readable(ws, row.listKey);
    return row;
  }

  private async presentById(id: string, userId: string): Promise<SavedView> {
    const row = await this.views.find(id);
    if (!row) throw new NotFoundException();
    return present(row, userId);
  }

  private translate(error: unknown, name: string): unknown {
    const e = (error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } }) ?? {};
    const code = e.code ?? e.cause?.code;
    const constraint = e.constraint ?? e.cause?.constraint;
    if (code === '23505' && constraint === 'list_saved_views_name_uk') {
      return new ConflictException(`You already have a view called "${name.trim()}" for this list.`);
    }
    return error;
  }
}

/** A stored config is parsed on every read; one that no longer parses opens as the default view. */
function present(row: SavedViewRow, userId: string): SavedView {
  const parsed = SavedViewConfig.safeParse(row.config);
  return {
    id: row.id,
    listKey: row.listKey,
    name: row.name,
    config: parsed.success ? parsed.data : SavedViewConfig.parse({}),
    shared: row.shared,
    isDefault: row.isDefault,
    mine: row.userId === userId,
    authorName: row.authorName,
    updatedAt: row.updatedAt.toISOString(),
  };
}
