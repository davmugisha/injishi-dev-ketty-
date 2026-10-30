import type {
  HousekeepingPhone,
  HousekeepingTaskCheck,
  LogPhoneFoundItemRequest,
  MinibarCount,
  PhoneFoundItem,
  SendMinibarCountRequest,
  SetHousekeepingCheckRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import { assertInBranchScope, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { type BoardTaskRow, HousekeepingBoardRepository } from '../infrastructure/housekeeping-board.repository';
import { kigaliDay } from '../infrastructure/room-events';
import {
  type MinibarCountRow,
  type PhoneFoundRow,
  StaffPhoneRepository,
  type TaskCheckRow,
} from '../infrastructure/staff-phone.repository';
import { iso } from './housekeeping-board.service';
import { LostFoundService } from './lost-found.service';

/** A task a cleaner is still working: its checklist and minibar are open. */
const WORKING = new Set(['pending', 'in_progress', 'blocked']);

/**
 * The housekeeping phone (real-data leaf 1.3.3): the checklist a cleaner ticks, the minibar count she
 * reports, the item she found in the room, and the read the phone draws them from.
 *
 * Every command acts on ONE task and is the work of whoever the task is assigned to; a supervisor who
 * assigns tasks (`task.assign`) may act for them. Nobody else ticks another person's room: the ticks
 * are what the inspector reads as "she says she did it". The inspection decision itself stays the
 * board's (`HousekeepingBoardService.inspect`), which writes the inspection checks in its own
 * transaction.
 */
@Injectable()
export class StaffPhoneService {
  constructor(
    private readonly board: HousekeepingBoardRepository,
    private readonly phone: StaffPhoneRepository,
    private readonly lostFound: LostFoundService,
  ) {}

  async read(ws: ScopedWorkspace, userId: string, requestedPropertyId?: string): Promise<HousekeepingPhone> {
    const property = await this.property(ws, requestedPropertyId);
    const today = kigaliDay();
    const [checklist, checks, minibarItems, minibarCounts, arrivals, myFloors, supervisor, found] = await Promise.all([
      this.phone.checklist(property.id),
      this.phone.checks(property.id, today),
      this.phone.minibarItems(property.id),
      this.phone.minibarCounts(property.id, today),
      this.phone.arrivals(property.id, today),
      this.phone.floorsOf(property.id, userId, today),
      this.phone.supervisor(property.id, today),
      this.phone.foundBy(ws.workspaceId, userId, ws.branchScope),
    ]);
    const places = await this.phone.spacesOn(property.id, myFloors);
    return {
      propertyId: property.id,
      checklist: checklist.map((i) => ({
        id: i.id,
        kind: i.kind,
        sectionCode: i.section_code,
        sectionTitle: i.section_title,
        code: i.code,
        label: i.label,
        requiresPhoto: i.requires_photo,
        sortOrder: Number(i.sort_order),
      })),
      checks: checks.map(presentCheck),
      minibarItems: minibarItems.map((m) => ({
        id: m.id,
        code: m.code,
        label: m.label,
        parLevel: Number(m.par_level),
        sortOrder: Number(m.sort_order),
      })),
      minibarCounts: minibarCounts.map(presentCount),
      arrivals: arrivals.map((a) => ({ roomId: a.room_id, guests: Number(a.guests) })),
      myFloors,
      places: places.map((p) => ({ spaceId: p.id, name: p.name, floor: p.floor === null ? null : Number(p.floor) })),
      supervisor: supervisor ? { userId: supervisor.user_id, name: supervisor.name } : null,
      foundItems: found.map(presentFound),
    };
  }

  /** Tick or untick one cleaning step of a room still being cleaned. */
  async setCheck(
    ws: ScopedWorkspace,
    taskId: string,
    body: SetHousekeepingCheckRequest,
    userId: string,
  ): Promise<HousekeepingTaskCheck[]> {
    const db = this.board.database;
    return db.transaction(async (tx) => {
      const task = await this.workable(tx, ws, taskId, userId);
      if (!WORKING.has(task.status)) {
        throw new ConflictException('This room is finished, so its checklist is closed.');
      }
      const item = await this.phone.item(tx, body.itemId);
      if (!item || item.property_id !== task.property_id || item.kind !== 'cleaning') {
        throw new UnprocessableEntityException('Tick a step of this property’s cleaning checklist.');
      }
      if (body.done) {
        await this.phone.tick(tx, { workspaceId: task.workspace_id, taskId: task.id, itemId: item.id, userId });
      } else {
        await this.phone.untick(tx, task.id, item.id);
      }
      return (await this.phone.checksOfTask(tx, task.id)).map(presentCheck);
    });
  }

  /**
   * Report what was used from the room's minibar. Replaces an earlier count of the same clean; the
   * desk decides any charge, so nothing here touches a folio.
   */
  async sendMinibar(
    ws: ScopedWorkspace,
    taskId: string,
    body: SendMinibarCountRequest,
    userId: string,
  ): Promise<MinibarCount[]> {
    const db = this.board.database;
    return db.transaction(async (tx) => {
      const task = await this.workable(tx, ws, taskId, userId);
      if (!WORKING.has(task.status) && task.status !== 'done') {
        throw new ConflictException('This clean has been inspected; its minibar count is with the front desk.');
      }
      const ids = [...new Set(body.counts.map((c) => c.itemId))];
      if (ids.length !== body.counts.length) throw new UnprocessableEntityException('Count each item once.');
      const items = await this.phone.minibarItemsByIds(tx, task.property_id, ids);
      if (items.length !== ids.length) throw new UnprocessableEntityException('Count the items this minibar is stocked with.');
      const byId = new Map(items.map((i) => [i.id, i]));
      for (const c of body.counts) {
        const item = byId.get(c.itemId);
        if (!item) continue;
        const par = Number(item.par_level);
        if (c.used > par) {
          throw new UnprocessableEntityException(`${item.label}: the minibar holds ${par}, so no more than ${par} can be used.`);
        }
        await this.phone.upsertMinibarCount(tx, {
          workspaceId: task.workspace_id,
          propertyId: task.property_id,
          taskId: task.id,
          roomId: task.room_id,
          itemId: item.id,
          parLevel: par,
          used: c.used,
          userId,
        });
      }
      return (await this.phone.minibarCountsOfTask(tx, task.id)).map(presentCount);
    });
  }

  /**
   * Log an item found in the task's room into the lost and found register: the cleaner is the finder
   * and holds it until she hands it to today's supervisor (the custodian named on the item). The
   * register's own rules (reference, retention, custody chain) are `LostFoundService.log`'s.
   */
  async logFoundItem(
    ws: ScopedWorkspace,
    taskId: string,
    body: LogPhoneFoundItemRequest,
    userId: string,
  ): Promise<PhoneFoundItem> {
    const task = await this.workable(this.board.database, ws, taskId, userId);
    if (!task.room_label) throw new UnprocessableEntityException('This task names no room.');
    const today = kigaliDay();
    const [finder, supervisor] = await Promise.all([
      this.phone.nameOf(userId),
      this.phone.supervisor(task.property_id, today),
    ]);
    const name = finder ?? 'Housekeeping';
    const item = await this.lostFound.log(
      ws,
      {
        propertyId: task.property_id,
        description: body.description,
        category: body.category ?? 'other',
        valuable: false,
        foundLocation: `Room ${task.room_label}`,
        foundSpot: body.spot,
        foundAt: new Date().toISOString(),
        foundByUserId: userId,
        foundByName: name,
        custodianUserId: supervisor && supervisor.user_id !== userId ? supervisor.user_id : undefined,
        photoCount: body.photoCount ?? 0,
      },
      userId,
    );
    return {
      id: item.id,
      reference: item.reference,
      description: item.description,
      roomLabel: task.room_label,
      foundLocation: item.foundLocation,
      foundSpot: item.foundSpot,
      foundAt: item.foundAt,
      category: item.category,
      photoCount: body.photoCount ?? 0,
      custodianName: item.custodianName,
      status: item.status,
    };
  }

  // --- helpers -----------------------------------------------------------------------------------

  /** The task, in this workspace and the caller's branches, and theirs to work (or they assign tasks). */
  private async workable(
    db: Parameters<HousekeepingBoardRepository['task']>[0],
    ws: ScopedWorkspace,
    taskId: string,
    userId: string,
  ): Promise<BoardTaskRow> {
    const row = await this.board.task(db, taskId, true);
    const task = assertOwned(row ? { ...row, workspaceId: row.workspace_id } : null, ws);
    assertInBranchScope(ws, task.property_id);
    if (task.task_type === 'inspection') {
      throw new UnprocessableEntityException('An inspection is recorded with the inspection decision, not ticked.');
    }
    if (task.assigned_to_user_id !== userId && !ws.permissions.includes('task.assign')) {
      throw new ForbiddenException('This room is on someone else’s list.');
    }
    return task;
  }

  private async property(ws: ScopedWorkspace, requested?: string): Promise<{ id: string; name: string }> {
    const scope = ws.branchScope;
    const candidates = requested
      ? scope.propertyIds.filter((p) => p.toLowerCase() === requested.toLowerCase())
      : scope.selectedPropertyId
        ? [scope.selectedPropertyId]
        : [...scope.propertyIds];
    const found = await this.board.pickProperty(ws.workspaceId, candidates);
    if (!found) throw new NotFoundException('That property is not available to you.');
    return found;
  }
}

function presentCheck(c: TaskCheckRow): HousekeepingTaskCheck {
  return {
    taskId: c.task_id,
    itemId: c.item_id,
    result: c.result,
    photoObjectKey: c.photo_object_key,
    checkedByName: c.checked_by_name,
    checkedAt: iso(c.checked_at) as string,
  };
}

function presentCount(m: MinibarCountRow): MinibarCount {
  return {
    taskId: m.task_id,
    itemId: m.item_id,
    parLevel: Number(m.par_level),
    used: Number(m.used),
    countedByName: m.counted_by_name,
    countedAt: iso(m.counted_at) as string,
  };
}

function presentFound(f: PhoneFoundRow): PhoneFoundItem {
  return {
    id: f.id,
    reference: f.reference,
    description: f.description,
    roomLabel: f.room_label,
    foundLocation: f.found_location,
    foundSpot: f.found_spot,
    foundAt: iso(f.found_at) as string,
    category: f.category,
    photoCount: Number(f.photo_count),
    custodianName: f.custodian_name,
    status: f.status,
  };
}
