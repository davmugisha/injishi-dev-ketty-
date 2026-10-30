import type { RoomStatus } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';

import { roomTypes, rooms } from '../../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../../shared/database/database.module';

export interface RoomRow {
  id: string;
  roomTypeId: string;
  propertyId: string;
  workspaceId: string;
  label: string | null;
  status: RoomStatus;
  housekeeping: 'clean' | 'dirty' | 'inspected' | 'out_of_order';
}

const ROOM_COLUMNS = {
  id: rooms.id,
  roomTypeId: rooms.roomTypeId,
  propertyId: rooms.propertyId,
  workspaceId: rooms.workspaceId,
  label: rooms.label,
  status: rooms.status,
  housekeeping: rooms.housekeepingStatus,
};

/**
 * The physical rooms and units, as setup writes them.
 *
 * **Nothing wrote a `rooms` row before this file.** `room_types.room_count` was
 * stored and "seeds nothing", so a property set up through the operator app had
 * no sellable room, could never publish, and showed an empty room status board.
 * The seeds wrote rooms directly, which is why every demo hotel looked fine.
 *
 * Same split as every operator repository: a LIST is scoped by its parent, a
 * SINGLE ROW is read unscoped so the service can answer 404 for somebody else's.
 */
@Injectable()
export class RoomsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listForRoomType(roomTypeId: string): Promise<RoomRow[]> {
    return this.db
      .select(ROOM_COLUMNS)
      .from(rooms)
      .where(eq(rooms.roomTypeId, roomTypeId))
      .orderBy(asc(rooms.createdAt), asc(rooms.label));
  }

  async find(roomId: string): Promise<RoomRow | null> {
    const [row] = await this.db
      .select(ROOM_COLUMNS)
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);
    return row ?? null;
  }

  /** Every label already on a door of this property, for the collision check. */
  async labelsOnProperty(
    propertyId: string,
    excludingRoomId?: string,
  ): Promise<(string | null)[]> {
    const rows = await this.db
      .select({ id: rooms.id, label: rooms.label })
      .from(rooms)
      .where(eq(rooms.propertyId, propertyId));
    return rows.filter((r) => r.id !== excludingRoomId).map((r) => r.label);
  }

  /**
   * Add rooms to a room type, and keep its `room_count` equal to what exists.
   *
   * One transaction, so the count a reader sees is never the count before a
   * half-finished insert. New rooms take the column defaults: `available` to
   * sell, and `clean`, because nobody has slept in them yet.
   */
  async add(input: {
    roomTypeId: string;
    propertyId: string;
    workspaceId: string;
    labels: readonly string[];
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await insertRooms(tx, input);
    });
  }

  async update(
    roomId: string,
    patch: { label?: string; status?: RoomStatus },
  ): Promise<void> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.label !== undefined) set.label = patch.label.trim();
    if (patch.status !== undefined) set.status = patch.status;
    await this.db.update(rooms).set(set).where(eq(rooms.id, roomId));
  }
}

/**
 * Insert rooms and resync the room type's count, on a transaction handle.
 *
 * Exported so the room type create writes its first rooms in ITS transaction:
 * a room type that committed and whose rooms then failed would be exactly the
 * unsellable state this file exists to end.
 */
export async function insertRooms(
  tx: Database,
  input: {
    roomTypeId: string;
    propertyId: string;
    workspaceId: string;
    labels: readonly string[];
  },
): Promise<void> {
  if (input.labels.length > 0) {
    await tx.insert(rooms).values(
      input.labels.map((label) => ({
        roomTypeId: input.roomTypeId,
        propertyId: input.propertyId,
        workspaceId: input.workspaceId,
        label: label.trim(),
      })),
    );
  }
  await tx
    .update(roomTypes)
    .set({
      roomCount: sql`greatest(1, (select count(*) from ${rooms} where ${rooms.roomTypeId} = ${input.roomTypeId}))`,
      updatedAt: new Date(),
    })
    .where(eq(roomTypes.id, input.roomTypeId));
}
