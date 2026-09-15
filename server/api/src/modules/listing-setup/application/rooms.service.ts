import type {
  CreateRoomsRequest,
  InventoryRoom,
  UpdateRoomRequest,
} from '@injishi/contracts';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  assertInBranchScope,
  type ScopedWorkspace,
} from '../../../shared/auth/branch-scope';
import { assertContained } from '../domain/containment';
import { collidingLabels } from '../domain/room-labels';
import {
  type RoomRow,
  RoomsRepository,
} from '../infrastructure/rooms.repository';
import { RoomTypesRepository } from '../infrastructure/room-types.repository';

/**
 * The physical rooms and units behind a room type (setup after approval).
 *
 * The same two controls as every inventory write: `WorkspaceGuard` proves the
 * caller holds the workspace and `listing.manage`, which a business that is not
 * `active` never holds (D20), and `assertContained` proves the row is theirs,
 * answering 404 for somebody else's.
 *
 * Cleanliness is NOT written here. A new room is `clean` by the column default,
 * and after that it is housekeeping's, on the route housekeeping already owns.
 */
@Injectable()
export class RoomsService {
  constructor(
    private readonly rooms: RoomsRepository,
    private readonly roomTypes: RoomTypesRepository,
  ) {}

  async list(
    workspace: ScopedWorkspace,
    roomTypeId: string,
  ): Promise<InventoryRoom[]> {
    const roomType = await this.roomTypes.find(roomTypeId);
    assertContained(roomType, workspace.workspaceId, 'Room type');
    assertInBranchScope(workspace, roomType.propertyId, 'Room type');
    const rows = await this.rooms.listForRoomType(roomTypeId);
    return rows.map(present);
  }

  /** Add rooms, each by the label on its door. */
  async add(
    workspace: ScopedWorkspace,
    roomTypeId: string,
    request: CreateRoomsRequest,
  ): Promise<InventoryRoom[]> {
    const roomType = await this.roomTypes.find(roomTypeId);
    assertContained(roomType, workspace.workspaceId, 'Room type');
    assertInBranchScope(workspace, roomType.propertyId, 'Room type');
    if (roomType.status === 'archived') {
      throw new ConflictException(
        'That room type is archived. Restore it before adding rooms to it.',
      );
    }

    const labels = request.labels.map((l) => l.trim());
    this.refuseCollisions(
      collidingLabels(labels, await this.rooms.labelsOnProperty(roomType.propertyId)),
    );

    await this.rooms.add({
      roomTypeId,
      propertyId: roomType.propertyId,
      workspaceId: workspace.workspaceId,
      labels,
    });
    return this.list(workspace, roomTypeId);
  }

  /** Renumber a room, or change whether it can be sold. */
  async update(
    workspace: ScopedWorkspace,
    roomId: string,
    request: UpdateRoomRequest,
  ): Promise<InventoryRoom> {
    const room = await this.rooms.find(roomId);
    assertContained(room, workspace.workspaceId, 'Room');
    assertInBranchScope(workspace, room.propertyId, 'Room');

    if (request.label !== undefined) {
      this.refuseCollisions(
        collidingLabels(
          [request.label],
          await this.rooms.labelsOnProperty(room.propertyId, room.id),
        ),
      );
    }

    await this.rooms.update(roomId, {
      label: request.label,
      status: request.status,
    });
    const updated = await this.rooms.find(roomId);
    if (!updated) throw new NotFoundException('Room not found.');
    return present(updated);
  }

  private refuseCollisions(clashes: string[]): void {
    if (clashes.length === 0) return;
    throw new ConflictException(
      `${clashes.length === 1 ? 'This name is' : 'These names are'} already used on this property: ${clashes.join(', ')}. Every room needs its own.`,
    );
  }
}

function present(row: RoomRow): InventoryRoom {
  return {
    id: row.id,
    roomTypeId: row.roomTypeId,
    label: row.label,
    status: row.status,
    housekeeping: row.housekeeping,
  };
}
