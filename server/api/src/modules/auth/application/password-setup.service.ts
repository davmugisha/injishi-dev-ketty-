import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';

import { PasswordHolders } from '../infrastructure/password-holders';

/**
 * A tenant's first password, right after the invitation's code (2026-10-23).
 *
 * Passwords are for tenants only. The invitation screen offers one the moment
 * the emailed code is accepted, so the next sign in skips the code. This is
 * the ONE route that sets a password from a session alone, so it asks three
 * things first:
 *
 * - the person is a tenant (`PasswordHolders.isTenant`; Better Auth's account
 *   hook checks the same thing again on the insert);
 * - they have no password yet (changing one needs the current one, on Better
 *   Auth's own `/change-password`);
 * - this session was made by an emailed code within the last
 *   `FRESH_CODE_MS`, so a laptop left signed in for a week cannot have a
 *   password added to it. Later, the account screen sets one with a code.
 */
export const FRESH_CODE_MS = 30 * 60 * 1000;

/** A clock, for tests. */
export const PASSWORD_SETUP_CLOCK = Symbol('PASSWORD_SETUP_CLOCK');

export interface PasswordStatus {
  /** This person may hold a password (a tenant). */
  offered: boolean;
  /** They have one. */
  set: boolean;
}

/** Better Auth's server-only `setPassword`, through the request's instance. */
export type SetPassword = (newPassword: string) => Promise<void>;

@Injectable()
export class PasswordSetupService {
  constructor(
    @Inject(PasswordHolders) private readonly holders: PasswordHolders,
    @Optional() @Inject(PASSWORD_SETUP_CLOCK) private readonly now: () => Date = () => new Date(),
  ) {}

  async status(userId: string): Promise<PasswordStatus> {
    const [offered, set] = await Promise.all([this.holders.isTenant(userId), this.holders.hasPassword(userId)]);
    return { offered: offered || set, set };
  }

  async create(userId: string, sessionId: string, password: string, setPassword: SetPassword): Promise<PasswordStatus> {
    if (!(await this.holders.isTenant(userId))) {
      throw new ForbiddenException('Passwords are only for tenants. Sign in with an email code.');
    }
    if (await this.holders.hasPassword(userId)) {
      throw new ConflictException('You already have a password. Change it from your account.');
    }
    const session = await this.holders.session(sessionId);
    const provedAt = session?.twoFactorVerifiedAt ?? null;
    const fresh =
      session !== null &&
      provedAt !== null &&
      this.now().getTime() - session.createdAt.getTime() <= FRESH_CODE_MS;
    if (!fresh) {
      throw new ForbiddenException('Set a password from your account, with a code we email you.');
    }
    try {
      await setPassword(password);
    } catch (error) {
      const code = (error as { body?: { code?: unknown } })?.body?.code;
      if (code === 'PASSWORD_ALREADY_SET') {
        throw new ConflictException('You already have a password. Change it from your account.');
      }
      if (code === 'PASSWORD_NOT_OFFERED') {
        throw new ForbiddenException('Passwords are only for tenants. Sign in with an email code.');
      }
      if (code === 'PASSWORD_TOO_SHORT' || code === 'PASSWORD_TOO_LONG') {
        throw new BadRequestException('Use 8 to 128 characters.');
      }
      throw error;
    }
    return { offered: true, set: true };
  }
}
