import { Inject, Injectable } from '@nestjs/common';

import { PLATFORM, type Platform } from '../../../../shared/config/platform';
import { EBM_LIVE, type EbmLive } from '../domain/ebm-live';
import { EbmConnectionRepository } from '../infrastructure/ebm-connection.repository';

/**
 * What a sale is told about its taxpayer's fiscal setup (ADR-050 D-b, value
 * sourcing "which EBM connection signs").
 *
 * Null `declare` is the demo environment: nothing is ever declared, because a
 * demo business is fictional (ADR-041 D-p).
 */
export interface DeclarationPlan {
  declare: null | {
    adapterMode: 'mock' | 'live';
    /** The taxpayer holds a connected EBM account. */
    connected: boolean;
    tin: string | null;
    rraBranchId: string;
  };
}

/**
 * WHO SIGNS A SALE, AND WHETHER THEY CAN, in one place.
 *
 * A folio's close and a pay now order's settlement ask the same question of the
 * same facts: the environment, the adapter mode, and the taxpayer's own
 * connection. Two copies of the answer would be two chances for one of them to
 * declare a demo sale, so both read it here. No connection is never an error:
 * the plan says so and the sale is written `failed` with `no_connection`.
 *
 * The branch is the one the connected account reported, else `00`, because no
 * outlet or property carries a branch id yet.
 */
@Injectable()
export class DeclarationPlanService {
  constructor(
    private readonly connections: EbmConnectionRepository,
    @Inject(PLATFORM) private readonly platform: Platform,
    @Inject(EBM_LIVE) private readonly live: EbmLive | null,
  ) {}

  async forOrg(orgId: string | null): Promise<DeclarationPlan> {
    if (this.platform.environment === 'demo') return { declare: null };

    const connection = orgId ? await this.connections.findByOrg(orgId) : null;
    const connected = connection?.status === 'connected';
    const identity =
      !connected && orgId ? await this.connections.orgIdentity(orgId) : null;

    return {
      declare: {
        adapterMode: this.live ? 'live' : 'mock',
        connected,
        tin: connected ? connection!.tin : (identity?.tin ?? null),
        rraBranchId: (connected && connection!.branchId) || '00',
      },
    };
  }
}
