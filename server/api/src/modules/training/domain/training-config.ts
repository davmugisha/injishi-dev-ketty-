import type { ConfigService } from '@nestjs/config';

/**
 * The three settings this feature reads (ADR-049, Configuration required).
 *
 * Read in ONE place, like every other configuration seam in this service, so
 * that "what does training read from the environment" has one answer and a
 * default cannot be spelled differently in two files.
 */

export const TRAINING_CONFIG = Symbol('TRAINING_CONFIG');

export interface TrainingConfig {
  /**
   * The absolute origin a QR payload is built from.
   *
   * Baked per environment, so a demo certificate can never point at
   * production. There is no safe default for this in a deployed environment,
   * and the fallback below is a localhost one for a laptop.
   */
  readonly verifyBaseUrl: string;
  /** Requests per IP per minute on the public verification endpoint. */
  readonly verifyRateLimit: number;
  /** How long a verification answer is cached. Purged on revocation regardless. */
  readonly verifyCacheTtlSeconds: number;
}

/** Defaults, named once. The ADR fixes the last two at 30 and 60. */
const DEFAULT_VERIFY_BASE_URL = 'http://localhost:3000';
const DEFAULT_RATE_LIMIT = 30;
const DEFAULT_CACHE_TTL_SECONDS = 60;

export function readTrainingConfig(config: ConfigService): TrainingConfig {
  return {
    // `WEB_URL` before `NEXT_PUBLIC_WEB_URL` (demo-comms, 2026-09-14). The
    // deployed API and worker are given `WEB_URL` and never the frontend's
    // public variable, so a demo certificate's QR and verify link pointed at
    // http://localhost:3000.
    verifyBaseUrl:
      config.get<string>('TRAINING_VERIFY_BASE_URL')?.trim() ||
      config.get<string>('WEB_URL')?.trim() ||
      config.get<string>('NEXT_PUBLIC_WEB_URL')?.trim() ||
      DEFAULT_VERIFY_BASE_URL,
    verifyRateLimit: positiveInt(
      config.get<string>('TRAINING_VERIFY_RATE_LIMIT'),
      DEFAULT_RATE_LIMIT,
    ),
    verifyCacheTtlSeconds: positiveInt(
      config.get<string>('TRAINING_VERIFY_CACHE_TTL_SECONDS'),
      DEFAULT_CACHE_TTL_SECONDS,
    ),
  };
}

/**
 * A positive integer, or the default.
 *
 * A misspelled number falls back rather than throwing, and rather than
 * becoming `NaN`. `NaN` as a rate limit refuses every request, which is a
 * denial of service delivered by a typo in an env file; `NaN` as a cache TTL
 * caches forever, which is how a revoked certificate keeps reading valid.
 * Neither failure announces itself, so neither is allowed to happen.
 */
function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw?.trim() ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
