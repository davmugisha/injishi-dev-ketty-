import type {
  AssignDepartmentMemberRequest,
  CreateDepartmentRequest,
  OperatorDepartment,
  OperatorDepartmentMember,
  UpdateDepartmentRequest,
  WorkspaceAccess,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import {
  type DepartmentMemberRow,
  type DepartmentRow,
  DepartmentsRepository,
} from '../infrastructure/departments.repository';

/**
 * The USALI department spine (ADR-016 slice 1, D14).
 *
 * A department is two things at once and both matter: the bucket departmental
 * revenue is reported in, and the queue an order or a message routes to. That
 * is why `department.manage` is owner and manager only (D-p): a receptionist
 * who could rename one could quietly move a restaurant's takings into Rooms.
 *
 * Commands copy the reservations thread exactly (ADR-012): the guard proves the
 * caller holds the workspace, the service reads its subject unscoped and hands
 * it to `assertOwned`, and the answer for someone else's id is 404 rather than
 * 403.
 */
@Injectable()
export class DepartmentsService {
  constructor(private readonly departments: DepartmentsRepository) {}

  /**
   * Every department in this workspace.
   *
   * No permission beyond holding the workspace. A charge screen has to show the
   * department picker before anybody can post anything, and gating the read on
   * `department.manage` would leave a receptionist with an empty list.
   */
  async list(ws: WorkspaceAccess): Promise<OperatorDepartment[]> {
    const rows = await this.departments.list(ws.workspaceId);
    return rows.map((row) => this.present(row));
  }

  async create(
    ws: WorkspaceAccess,
    body: CreateDepartmentRequest,
  ): Promise<OperatorDepartment> {
    const property = assertOwned(
      await this.departments.findProperty(body.propertyId),
      ws,
    );

    const id = await this.departments.create({
      orgId: property.orgId,
      workspaceId: ws.workspaceId,
      request: body,
    });
    if (!id) {
      throw new ConflictException(
        `This property already has a ${body.departmentCategory.replace('_', ' ')} department. Rename that one rather than adding a second.`,
      );
    }

    const created = await this.departments.find(id);
    if (!created) throw this.vanished();
    return this.present(created);
  }

  /**
   * Rename, reorder, or retire.
   *
   * The CATEGORY is not changeable and the request shape does not carry it. It
   * decides which revenue account the charges post to, so moving it would
   * silently re-attribute every shilling already booked here.
   */
  async update(
    ws: WorkspaceAccess,
    id: string,
    body: UpdateDepartmentRequest,
  ): Promise<OperatorDepartment> {
    const department = assertOwned(await this.departments.find(id), ws);
    await this.departments.update(department.id, body);

    const updated = await this.departments.find(id);
    if (!updated) throw this.vanished();
    return this.present(updated);
  }

  /**
   * The revenue centre a room charge attributes to (AC-14).
   *
   * Used by the folio when it posts a room charge, which is the one charge with
   * no department in the request: the guest bought a room, so the department is
   * a fact about the property rather than a choice the desk makes.
   */
  async roomsDepartmentFor(propertyId: string): Promise<DepartmentRow> {
    const row = await this.departments.findRoomsDepartment(propertyId);
    if (!row) {
      throw new ConflictException(
        'This property has no Rooms department, so a room charge has nowhere to post. Seed its departments first.',
      );
    }
    return row;
  }

  // --- Department staff (D17) ----------------------------------------------

  /**
   * Who works in this department.
   *
   * Removed rows are returned too, marked `removed`, so a roster screen can
   * show who used to be here without a second call. A department's history is
   * the thing a soft removal exists to keep.
   */
  async listMembers(
    ws: WorkspaceAccess,
    departmentId: string,
  ): Promise<OperatorDepartmentMember[]> {
    const department = assertOwned(
      await this.departments.find(departmentId),
      ws,
    );
    const rows = await this.departments.listMembers(department.id);
    return rows.map((row) => this.presentMember(row));
  }

  /**
   * Put somebody on the roster.
   *
   * This decides whose BOARD a task appears on. It never decides what they may
   * do: permission scope stays on `org_memberships.org_role`, so a department
   * head with a receptionist's role still cannot move money (D17).
   */
  async assignMember(
    ws: WorkspaceAccess,
    departmentId: string,
    body: AssignDepartmentMemberRequest,
  ): Promise<OperatorDepartmentMember> {
    const department = assertOwned(
      await this.departments.find(departmentId),
      ws,
    );
    if (!ws.orgId) {
      throw new ConflictException(
        'Only a business workspace has departments to staff.',
      );
    }

    const membership = await this.departments.findOrgMembership({
      orgId: ws.orgId,
      userId: body.userId,
    });
    if (!membership) {
      throw new ConflictException(
        'That person is not on this business yet. Invite them first.',
      );
    }

    const id = await this.departments.assignMember({
      departmentId: department.id,
      orgMembershipId: membership.id,
      userId: body.userId,
      workspaceId: ws.workspaceId,
      request: body,
    });
    if (!id) throw this.vanished();

    const created = await this.departments.findMember(id);
    if (!created) throw this.vanished();
    return this.presentMember(created);
  }

  /** Take somebody off the roster. Soft, so the history survives. */
  async removeMember(
    ws: WorkspaceAccess,
    departmentId: string,
    memberId: string,
  ): Promise<OperatorDepartmentMember> {
    const department = assertOwned(
      await this.departments.find(departmentId),
      ws,
    );
    const member = assertOwned(await this.departments.findMember(memberId), ws);
    if (member.departmentId !== department.id) {
      throw new ConflictException('That person is not on this department.');
    }

    if (member.status === 'active') {
      await this.departments.removeMember(member.id);
    }

    const updated = await this.departments.findMember(memberId);
    if (!updated) throw this.vanished();
    return this.presentMember(updated);
  }

  private presentMember(row: DepartmentMemberRow): OperatorDepartmentMember {
    return {
      id: row.id,
      departmentId: row.departmentId,
      userId: row.userId,
      name: row.name,
      email: row.email,
      departmentPosition: row.departmentPosition,
      isPrimary: row.isPrimary,
      status: row.status,
    };
  }

  private present(row: DepartmentRow): OperatorDepartment {
    return {
      id: row.id,
      propertyId: row.propertyId,
      name: row.name,
      departmentType: row.departmentType,
      departmentCategory: row.departmentCategory,
      isRevenueCenter: row.isRevenueCenter,
      guestRequestable: row.guestRequestable,
      sortOrder: row.sortOrder,
      status: row.status,
    };
  }

  private vanished(): BadRequestException {
    return new BadRequestException(
      'That record changed while we were writing it. Refresh and try again.',
    );
  }
}
