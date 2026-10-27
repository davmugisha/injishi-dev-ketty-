import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import type { AuthRegistry } from '../../auth/auth.module';

/** What Better Auth's context offers for passwords: its own verify, whatever hasher it was set up with. */
interface PasswordContext {
  password?: { verify?: (input: { hash: string; password: string }) => Promise<boolean> };
}

/**
 * Checks a signer's password against the hash Better Auth keeps for them
 * (ported from feat/rentals), through Better Auth's own `password.verify`, so
 * a signature confirmed with a password is checked exactly as signing in is.
 * Nothing is hashed here.
 *
 * Passwords are for tenants who came through an invitation (WP 1.8); until an
 * account has one, signing takes the emailed code. The auth registry is looked
 * up when a password is first checked, not injected: the auth package is ESM,
 * and the signing service and its tests should not have to load it to exist.
 */
@Injectable()
export class SignerPasswordVerifier {
  private readonly log = new Logger(SignerPasswordVerifier.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      const { AUTH_REGISTRY } = await import('../../auth/auth.module');
      const registry = this.moduleRef.get<AuthRegistry>(AUTH_REGISTRY, { strict: false });
      const instance = registry.for('marketplace') as unknown as { $context?: Promise<PasswordContext> };
      const ctx = await instance.$context;
      if (!ctx?.password?.verify) {
        this.log.error('Better Auth offered no password check; the signature is refused.');
        return false;
      }
      return await ctx.password.verify({ hash, password });
    } catch (cause) {
      this.log.warn(`Password check failed: ${cause instanceof Error ? cause.message : 'unknown'}`);
      return false;
    }
  }
}
