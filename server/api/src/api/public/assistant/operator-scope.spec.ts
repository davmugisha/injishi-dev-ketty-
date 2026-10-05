// TwoFactorService imports @injishi/auth, which ships as ESM Jest does not
// transform. The service is stood in below; the package is mocked the way
// `upload-throttler.guard.spec.ts` mocks it.
jest.mock('@injishi/auth', () => ({
  DEMO_OTP_CODE: '123456',
  DEMO_COOKIE_PREFIX: 'injishi-demo',
  OTP_EXPIRY_SECONDS: 300,
  OTP_LENGTH: 6,
  createAuth: (config: unknown) => ({ config }),
}));

import { BadRequestException, ForbiddenException } from '@nestjs/common';

import type { TwoFactorService } from '../../../shared/auth/two-factor.service';
import type { WorkspaceService } from '../../../shared/auth/workspace.service';
import { OperatorScopeResolver } from './operator-scope';

const USER = 'user-1';
const SESSION = 'session-1';
const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const BRANCH_A = '22222222-2222-4222-8222-222222222222';
const BRANCH_B = '33333333-3333-4333-8333-333333333333';

const access = { workspaceId: WORKSPACE, kind: 'business', permissions: ['stay.checkin'] };

function resolver(overrides: {
  stepUp?: () => Promise<void>;
  resolveForUser?: () => Promise<unknown>;
  coverage?: { coverage: 'all' | 'limited'; propertyIds: string[] };
} = {}): { resolver: OperatorScopeResolver; calls: string[] } {
  const calls: string[] = [];
  const twoFactor = {
    assertSatisfied: jest.fn(async () => {
      calls.push('step-up');
      return overrides.stepUp ? overrides.stepUp() : undefined;
    }),
  } as unknown as TwoFactorService;
  const workspaces = {
    resolveForUser: jest.fn(async () => {
      calls.push('membership');
      return overrides.resolveForUser ? overrides.resolveForUser() : access;
    }),
    coveredProperties: jest.fn(async () => {
      calls.push('coverage');
      return overrides.coverage ?? { coverage: 'limited', propertyIds: [BRANCH_A] };
    }),
  } as unknown as WorkspaceService;
  return { resolver: new OperatorScopeResolver(workspaces, twoFactor), calls };
}

const input = { userId: USER, sessionId: SESSION, workspaceId: WORKSPACE, branchHeader: undefined };

describe('OperatorScopeResolver (ADR-061 D-f)', () => {
  it('runs the step up, then membership, then coverage, in WorkspaceGuard order', async () => {
    const { resolver: r, calls } = resolver();
    const scope = await r.resolve(input);
    expect(calls).toEqual(['step-up', 'membership', 'coverage']);
    expect(scope.stepUpNeeded).toBe(false);
    expect(scope.workspace).toMatchObject({ workspaceId: WORKSPACE, branchScope: { coverage: 'limited', propertyIds: [BRANCH_A] } });
  });

  it('stops at the step up, reports it, and resolves no workspace', async () => {
    const { resolver: r, calls } = resolver({ stepUp: () => Promise.reject(new ForbiddenException({ code: 'two_factor_required' })) });
    await expect(r.resolve(input)).resolves.toEqual({ workspace: null, stepUpNeeded: true });
    expect(calls).toEqual(['step-up']);
  });

  it('resolves nothing for a workspace the caller does not hold', async () => {
    const { resolver: r } = resolver({ resolveForUser: () => Promise.resolve(null) });
    await expect(r.resolve(input)).resolves.toEqual({ workspace: null, stepUpNeeded: false });
  });

  it('resolves nothing for a branch the member does not cover, never a wider scope', async () => {
    const { resolver: r } = resolver();
    await expect(r.resolve({ ...input, branchHeader: BRANCH_B })).resolves.toEqual({ workspace: null, stepUpNeeded: false });
  });

  it('narrows to the branch named in the header when the member covers it', async () => {
    const { resolver: r } = resolver({ coverage: { coverage: 'all', propertyIds: [BRANCH_A, BRANCH_B] } });
    const scope = await r.resolve({ ...input, branchHeader: BRANCH_B });
    expect(scope.workspace?.branchScope).toMatchObject({ selectedPropertyId: BRANCH_B, propertyIds: [BRANCH_B] });
  });

  it('asks nothing of a guest or of a turn that names no workspace', async () => {
    const { resolver: r, calls } = resolver();
    await expect(r.resolve({ ...input, userId: null })).resolves.toEqual({ workspace: null, stepUpNeeded: false });
    await expect(r.resolve({ ...input, workspaceId: undefined })).resolves.toEqual({ workspace: null, stepUpNeeded: false });
    expect(calls).toEqual([]);
  });

  it('lets an unexpected failure through rather than hiding it as "no workspace"', async () => {
    const { resolver: r } = resolver({ stepUp: () => Promise.reject(new Error('database down')) });
    await expect(r.resolve(input)).rejects.toThrow('database down');
    const { resolver: r2 } = resolver({ resolveForUser: () => Promise.reject(new BadRequestException()) });
    await expect(r2.resolve(input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
