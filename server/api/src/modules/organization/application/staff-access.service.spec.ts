import { describe, expect, it, type Mock, vi } from 'vitest';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { type GrantEmployeeAccessRequest, type Permission, permissionsForRole } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { AccessFile, AccessRequestRow, StaffAccessRepository } from '../infrastructure/staff-access.repository';
import type { StaffInvitationRepository } from '../infrastructure/staff-invitation.repository';
import type { RolePermissionsService } from './role-permissions.service';
import { StaffAccessService } from './staff-access.service';
import type { StaffInvitationService } from './staff-invitation.service';
import type { TeamService } from './team.service';

/**
 * HR onboarding: who may give a login, and what waits for the owner.
 *
 * The rule under test is the security boundary of the feature: with `team.invite` alone, a role
 * that reaches money, staff files or payroll is REQUESTED (no invitation exists until the owner
 * approves), a front-line role is sent at once, and the owner (`team.manage`) sends any role.
 */

const ORG = '11111111-1111-4111-8111-111111111111';
const FILE = '22222222-2222-4222-8222-222222222222';
const BRANCH_A = '33333333-3333-4333-8333-333333333333';
const BRANCH_B = '44444444-4444-4444-8444-444444444444';
const INVITE = '55555555-5555-4555-8555-555555555555';
const REQUEST = '66666666-6666-4666-8666-666666666666';
const ACTOR = '77777777-7777-4777-8777-777777777777';

function workspace(role: 'owner' | 'hr', coverage: 'all' | 'limited' = 'all'): ScopedWorkspace {
  return {
    workspaceId: '88888888-8888-4888-8888-888888888888',
    kind: 'business',
    orgId: ORG,
    orgName: 'Amahoro Hospitality Ltd',
    domain: 'hospitality',
    orgRole: role,
    registrationStatus: 'active',
    permissions: permissionsForRole(role),
    departments: [],
    propertyName: null,
    branches: [
      { id: BRANCH_A, name: 'Isangano', districtName: null, isHeadOffice: true },
      ...(coverage === 'all' ? [{ id: BRANCH_B, name: 'Ishyamba', districtName: null, isHeadOffice: false }] : []),
    ],
    branchCoverage: coverage,
    psfMembership: null,
    branchScope: {
      coverage,
      selectedPropertyId: null,
      propertyIds: coverage === 'all' ? [BRANCH_A, BRANCH_B] : [BRANCH_A],
      includesUnbranched: coverage === 'all',
    },
  } as unknown as ScopedWorkspace;
}

const file = (over: Partial<AccessFile> = {}): AccessFile => ({
  id: FILE,
  name: 'Claudine Uwimana',
  employeeNumber: 'EMP-0094',
  email: null,
  jobTitle: 'Accounts assistant',
  status: 'active',
  workPropertyId: BRANCH_A,
  memberUserId: null,
  ...over,
});

const pending = (over: Partial<AccessRequestRow> = {}): AccessRequestRow => ({
  id: REQUEST,
  employeeId: FILE,
  employeeName: 'Claudine Uwimana',
  employeeNumber: 'EMP-0094',
  jobTitle: 'Accounts assistant',
  email: 'claudine@amahoro.rw',
  orgRole: 'finance',
  branchIds: null,
  status: 'pending',
  note: null,
  requestedAt: new Date('2026-10-18T08:00:00Z'),
  requestedByName: 'Diane Ingabire',
  decidedAt: null,
  decidedByName: null,
  decisionNote: null,
  ...over,
});

interface Setup {
  service: StaffAccessService;
  repo: Record<'file' | 'fillFileEmail' | 'latestFor' | 'liveInvitationFor' | 'insert' | 'decide' | 'byId' | 'listForOrg', Mock>;
  invitations: Record<'invite' | 'revoke', Mock>;
}

function setup(options: { file?: AccessFile; latest?: AccessRequestRow | null } = {}): Setup {
  const repo = {
    file: vi.fn().mockResolvedValue(options.file ?? file()),
    fillFileEmail: vi.fn().mockResolvedValue(undefined),
    latestFor: vi.fn().mockResolvedValue(options.latest ?? null),
    liveInvitationFor: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockResolvedValue(REQUEST),
    decide: vi.fn().mockResolvedValue(true),
    byId: vi.fn().mockResolvedValue(pending()),
    listForOrg: vi.fn().mockResolvedValue([]),
  };
  const invitationRows = { branchRefusal: vi.fn().mockResolvedValue(null) };
  const invitations = {
    invite: vi.fn().mockResolvedValue({ id: INVITE }),
    revoke: vi.fn().mockResolvedValue(undefined),
  };
  const roles = {
    list: vi.fn().mockResolvedValue({
      roles: (['owner', 'manager', 'receptionist', 'finance', 'hr', 'housekeeper'] as const).map((orgRole) => ({
        orgRole,
        permissions: permissionsForRole(orgRole) as Permission[],
      })),
      areas: [],
    }),
  };
  const team = { list: vi.fn().mockResolvedValue({ members: [] }) };
  const service = new StaffAccessService(
    repo as unknown as StaffAccessRepository,
    invitationRows as unknown as StaffInvitationRepository,
    invitations as unknown as StaffInvitationService,
    roles as unknown as RolePermissionsService,
    team as unknown as TeamService,
  );
  return { service, repo, invitations };
}

const login = (
  orgRole: 'receptionist' | 'finance' | 'manager' | 'housekeeper' | 'hr',
  branchIds: string[] | null = null,
): GrantEmployeeAccessRequest => ({
  email: 'claudine@amahoro.rw',
  orgRole,
  branchIds,
  note: null,
});

describe('StaffAccessService.grant', () => {
  it('sends a front desk login at once with HR rights', async () => {
    const { service, repo, invitations } = setup();
    const result = await service.grant(workspace('hr'), ACTOR, FILE, login('receptionist'));
    expect(result.outcome).toBe('invited');
    expect(invitations.invite).toHaveBeenCalledWith(
      expect.anything(),
      ACTOR,
      expect.objectContaining({ email: 'claudine@amahoro.rw', orgRole: 'receptionist', name: 'Claudine Uwimana' }),
    );
    expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ invitationId: INVITE }));
  });

  it.each(['finance', 'manager', 'hr'] as const)(
    'asks the owner for a %s login with HR rights, and sends nothing',
    async (role) => {
      const { service, repo, invitations } = setup();
      const result = await service.grant(workspace('hr'), ACTOR, FILE, login(role));
      expect(result.outcome).toBe('requested');
      expect(invitations.invite).not.toHaveBeenCalled();
      expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ orgRole: role, invitationId: null }));
    },
  );

  it('lets the owner send a finance login at once', async () => {
    const { service, invitations } = setup();
    const result = await service.grant(workspace('owner'), ACTOR, FILE, login('finance'));
    expect(result.outcome).toBe('invited');
    expect(invitations.invite).toHaveBeenCalled();
  });

  it('writes the login address on a file that had none', async () => {
    const { service, repo } = setup();
    await service.grant(workspace('hr'), ACTOR, FILE, login('housekeeper'));
    expect(repo.fillFileEmail).toHaveBeenCalledWith(FILE, 'claudine@amahoro.rw');
  });

  it('refuses a file that already has a login: re-roling is the owner\'s, on Team', async () => {
    const { service, invitations } = setup({ file: file({ memberUserId: ACTOR }) });
    await expect(service.grant(workspace('hr'), ACTOR, FILE, login('receptionist'))).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(invitations.invite).not.toHaveBeenCalled();
  });

  it('refuses a person who has left', async () => {
    const { service } = setup({ file: file({ status: 'offboarded' }) });
    await expect(service.grant(workspace('hr'), ACTOR, FILE, login('receptionist'))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refuses a second ask while one waits for the owner', async () => {
    const { service } = setup({ latest: pending() });
    await expect(service.grant(workspace('hr'), ACTOR, FILE, login('finance'))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('keeps a limited HR officer to their own branches', async () => {
    const { service, invitations } = setup();
    const ws = workspace('hr', 'limited');
    await expect(service.grant(ws, ACTOR, FILE, login('receptionist'))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.grant(ws, ACTOR, FILE, login('receptionist', [BRANCH_B]))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(invitations.invite).not.toHaveBeenCalled();
    await expect(service.grant(ws, ACTOR, FILE, login('receptionist', [BRANCH_A]))).resolves.toMatchObject({
      outcome: 'invited',
    });
  });

  it('answers 404 for a file outside a limited officer\'s branches', async () => {
    const { service } = setup({ file: file({ workPropertyId: BRANCH_B }) });
    await expect(
      service.grant(workspace('hr', 'limited'), ACTOR, FILE, login('receptionist', [BRANCH_A])),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('StaffAccessService.approve and decline', () => {
  it('sends the invitation when the owner approves, and records it on the request', async () => {
    const { service, repo, invitations } = setup();
    await service.approve(workspace('owner'), ACTOR, REQUEST);
    expect(invitations.invite).toHaveBeenCalledWith(
      expect.anything(),
      ACTOR,
      expect.objectContaining({ orgRole: 'finance', email: 'claudine@amahoro.rw' }),
    );
    expect(repo.decide).toHaveBeenCalledWith(
      expect.objectContaining({ id: REQUEST, status: 'approved', invitationId: INVITE }),
    );
  });

  it('takes the link back when somebody else decided first', async () => {
    const { service, repo, invitations } = setup();
    repo.decide.mockResolvedValueOnce(false);
    await expect(service.approve(workspace('owner'), ACTOR, REQUEST)).rejects.toBeInstanceOf(ConflictException);
    expect(invitations.revoke).toHaveBeenCalledWith(expect.anything(), INVITE);
  });

  it('refuses to approve a request already decided', async () => {
    const { service, repo, invitations } = setup();
    repo.byId.mockResolvedValueOnce(pending({ status: 'declined' }));
    await expect(service.approve(workspace('owner'), ACTOR, REQUEST)).rejects.toBeInstanceOf(ConflictException);
    expect(invitations.invite).not.toHaveBeenCalled();
  });

  it('declines with the owner\'s reason and sends nothing', async () => {
    const { service, repo, invitations } = setup();
    await service.decline(workspace('owner'), ACTOR, REQUEST, '  Not until December.  ');
    expect(repo.decide).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'declined', decisionNote: 'Not until December.', invitationId: null }),
    );
    expect(invitations.invite).not.toHaveBeenCalled();
  });
});

describe('StaffAccessService.options', () => {
  it('marks the roles that wait for the owner, for HR only', async () => {
    const { service } = setup();
    const hr = await service.options(workspace('hr'));
    const needs = Object.fromEntries(hr.roles.map((r) => [r.orgRole, r.needsOwner]));
    expect(needs).toEqual({ manager: true, receptionist: false, finance: true, hr: true, housekeeper: false });
    expect(hr.canGrant).toBe(true);
    expect(hr.grantsEveryRole).toBe(false);
    const owner = await service.options(workspace('owner'));
    expect(owner.roles.every((r) => !r.needsOwner)).toBe(true);
    expect(owner.grantsEveryRole).toBe(true);
  });

  it('never offers the owner role', async () => {
    const { service } = setup();
    const { roles } = await service.options(workspace('owner'));
    expect(roles.map((r) => r.orgRole)).not.toContain('owner');
  });
});
