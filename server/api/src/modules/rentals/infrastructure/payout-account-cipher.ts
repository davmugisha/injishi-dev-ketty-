import { createHash } from 'node:crypto';

import { isProduction } from '../../../shared/config/security.config';
import { TokenCipher, decodeTokenKey } from '../../platform/fiscal/infrastructure/token-cipher';

/** The cipher a bank account number is sealed with. */
export const PAYOUT_ACCOUNT_CIPHER = Symbol('PAYOUT_ACCOUNT_CIPHER');

/**
 * The key used where no `PAYOUT_ACCOUNT_ENCRYPTION_KEY` is set and none is
 * required: a laptop or the demo. Derived from a fixed phrase so it is the
 * same on every boot (a sealed number stays readable across restarts) and
 * worthless anywhere real people's accounts live.
 */
const DEV_KEY = createHash('sha256').update('injishi-dev-only-payout-account-key').digest();

/**
 * Resolve the payout account cipher once, at boot (blueprint 1.2: "encrypt
 * account numbers with the existing EBM token cipher").
 *
 * The cipher is the EBM one: AES-256-GCM with the context bound in as
 * additional data, so a sealed number moved onto another org's row fails to
 * open. Its key is its own, `PAYOUT_ACCOUNT_ENCRYPTION_KEY` (32 bytes,
 * base64), so the power to read bank account numbers and the power to
 * declare tax are never the same secret. A production process on the
 * production platform refuses to boot without a valid one, as it does without
 * `HR_PIN_PEPPER`; elsewhere a fixed development key stands in.
 */
export function resolvePayoutAccountCipher(env: {
  nodeEnv?: string;
  environment: 'production' | 'demo';
  key?: string;
}): TokenCipher {
  const raw = env.key?.trim();
  if (raw) return new TokenCipher(decodeKey(raw));
  if (isProduction(env.nodeEnv) && env.environment === 'production') {
    throw new Error(
      'PAYOUT_ACCOUNT_ENCRYPTION_KEY is required in production. Generate one with `openssl rand -base64 32`.',
    );
  }
  return new TokenCipher(DEV_KEY);
}

function decodeKey(raw: string): Buffer {
  try {
    return decodeTokenKey(raw);
  } catch {
    // `decodeTokenKey` names the EBM variable; this one is a different secret.
    throw new Error(
      'PAYOUT_ACCOUNT_ENCRYPTION_KEY must decode to exactly 32 bytes. Generate one with `openssl rand -base64 32`.',
    );
  }
}

/** What a sealed account number is bound to: its org and its own row. */
export function accountNumberContext(orgId: string, accountId: string): string {
  return `payout-account:${orgId}:${accountId}`;
}
