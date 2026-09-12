import { Injectable, Logger } from '@nestjs/common';

/**
 * RRA TIN verification (F-S03, EXT). Mocked until RRA grants API access.
 *
 * The seam matters more than the implementation. `adapter_mode` rides on every
 * `tin_verifications` row so a figure produced by the mock can never be mistaken
 * for one produced by RRA — that is the whole point of the mock/live column
 * (D-adapter seams), and it is why this returns the mode rather than hiding it.
 *
 * "Down" is a first-class outcome, distinct from "rejected": an RRA outage
 * holds the org at `submitted` and retries, while a rejection moves it to
 * `rejected`. Collapsing the two would tell a legitimate business it failed a
 * check that never ran.
 */
export type TinCheckOutcome =
  | { result: 'verified'; latencyMs: number; adapterMode: 'mock' | 'live'; raw: unknown }
  | { result: 'failed'; reason: string; latencyMs: number; adapterMode: 'mock' | 'live'; raw: unknown }
  | { result: 'pending'; reason: 'adapter_unavailable'; latencyMs: number; adapterMode: 'mock' | 'live'; raw: unknown };

@Injectable()
export class RraTinAdapter {
  private readonly log = new Logger(RraTinAdapter.name);

  /** `live` only once a real endpoint is configured; absent means mock. */
  private get mode(): 'mock' | 'live' {
    return process.env.RRA_TIN_ADAPTER_MODE === 'live' ? 'live' : 'mock';
  }

  async verify(tin: string): Promise<TinCheckOutcome> {
    const startedAt = Date.now();

    if (this.mode === 'live') {
      // Intentionally unimplemented rather than faked: returning `verified`
      // from a "live" adapter that called nothing would put an unverified
      // business into the pipeline wearing a verified badge. Once RRA grants
      // API access the real call goes HERE, and only the `live` branch changes.
      this.log.warn('RRA_TIN_ADAPTER_MODE=live but no endpoint is wired.');
      return {
        result: 'pending',
        reason: 'adapter_unavailable',
        latencyMs: Date.now() - startedAt,
        adapterMode: 'live',
        raw: { note: 'live adapter not implemented' },
      };
    }

    // DEMO RULE: the mock always verifies.
    //
    // RRA has not granted API access yet, so there is no register to disagree
    // with. Any synthetic rejection rule the mock invented would be a fiction
    // stopping a real business at a gate that never ran — the exact failure the
    // `pending` outcome exists to avoid. Every row is still stamped
    // `adapter_mode = 'mock'`, so no mock verdict can be read as an RRA one, and
    // rejection is still fully demoable at the two HUMAN gates
    // (`field-verify` / `approve`), which is where a demo rejection belongs.
    return {
      result: 'verified',
      latencyMs: Date.now() - startedAt,
      adapterMode: 'mock',
      raw: {
        tin,
        note: 'mock adapter: auto-verified, RRA API access pending',
      },
    };
  }
}
