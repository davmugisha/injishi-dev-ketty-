import { Inject, Injectable, Optional } from '@nestjs/common';

import { PLATFORM, type Platform } from '../../../shared/config/platform';
import { registerBusiness, registerPerson } from '../../../shared/registry/demo-registers';

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
/**
 * The business as the company register holds it (ADR-060). Directors carry
 * their document numbers, which never leave the server: the service compares
 * them with the registrant's and sends the browser names only.
 */
export interface TinRegistryBusiness {
  legalName: string;
  registeredOn: string | null;
  companyType: 'cooperative' | 'ngo' | 'partly_state_owned' | 'private_company' | 'public_company' | 'sole_trader' | null;
  address: { provinceId: number; districtId: number; sectorId: number; street: string | null } | null;
  directors: { name: string; documentNumber: string | null }[];
  /** True when a mock made it up. */
  generated: boolean;
}

export type TinCheckOutcome =
  | {
      result: 'verified';
      latencyMs: number;
      adapterMode: 'mock' | 'live';
      raw: unknown;
      /** Null when the register returned no company details. */
      business: TinRegistryBusiness | null;
    }
  | { result: 'failed'; reason: string; latencyMs: number; adapterMode: 'mock' | 'live'; raw: unknown }
  | { result: 'pending'; reason: 'adapter_unavailable'; latencyMs: number; adapterMode: 'mock' | 'live'; raw: unknown };

/**
 * The MOCK adapter. The only one that exists.
 *
 * **It used to carry a `live` branch that called nothing** and answered
 * `pending` with a logged warning (ADR-053, AC-R4). That made
 * `RRA_TIN_ADAPTER_MODE=live` a silent no op: a deployment could switch it on and
 * every registration would stop at `submitted` with nobody told. The mode is now
 * resolved once, at boot, in `organization.module.ts`, and `live` with no live
 * adapter registered refuses to boot, exactly as `PAYMENT_ADAPTER_MODE` does
 * (ADR-020). When RRA grants API access, the real adapter is a class of its own
 * registered there, not a branch in here.
 */
@Injectable()
export class RraTinAdapter {
  /**
   * Company details are made up only over a sample database (ADR-060). Over a
   * real one the mock still verifies, as it always has, but fills nothing: a
   * made-up legal name locked onto a real business would be worse than none.
   * Optional so the spec can build the adapter bare, which reads as "real".
   */
  private readonly sampleData: boolean;

  constructor(@Optional() @Inject(PLATFORM) platform?: Pick<Platform, 'sampleData'>) {
    this.sampleData = platform?.sampleData ?? false;
  }

  async verify(tin: string): Promise<TinCheckOutcome> {
    const startedAt = Date.now();
    const known = this.sampleData ? registerBusiness(tin) : null;

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
        demoBusiness: known ? known.legalName : null,
      },
      // Company details only where the demo register holds them
      // (`registerBusiness` in `shared/registry/demo-registers.ts`); every other
      // TIN is known to the mock as valid but carries no details.
      business: known
        ? {
            legalName: known.legalName,
            registeredOn: known.registeredOn,
            companyType: known.companyType,
            address: known.address,
            directors: known.directorDocumentNumbers.map((documentNumber) => ({
              name: registerPerson(documentNumber)?.fullName ?? 'A director',
              documentNumber,
            })),
            generated: true,
          }
        : null,
    };
  }
}
