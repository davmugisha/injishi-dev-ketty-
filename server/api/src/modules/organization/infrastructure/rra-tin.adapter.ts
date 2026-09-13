import { Injectable } from '@nestjs/common';

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

/**
 * The MOCK adapter. The only one that exists.
 *
 * **It used to carry a `live` branch that called nothing** and answered
 * `pending` with a logged warning (ADR-049, AC-R4). That made
 * `RRA_TIN_ADAPTER_MODE=live` a silent no op: a deployment could switch it on and
 * every registration would stop at `submitted` with nobody told. The mode is now
 * resolved once, at boot, in `organization.module.ts`, and `live` with no live
 * adapter registered refuses to boot, exactly as `PAYMENT_ADAPTER_MODE` does
 * (ADR-020). When RRA grants API access, the real adapter is a class of its own
 * registered there, not a branch in here.
 */
@Injectable()
export class RraTinAdapter {
  async verify(tin: string): Promise<TinCheckOutcome> {
    const startedAt = Date.now();

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
