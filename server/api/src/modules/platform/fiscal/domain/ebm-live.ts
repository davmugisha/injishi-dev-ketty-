import type { EbmApiClient } from '../infrastructure/ebm-api.client';
import type { EbmLiveConfig } from '../infrastructure/ebm-live-config';

/**
 * Nest token for everything live invoicing needs: the resolved configuration
 * and the one HTTP client built from it.
 *
 * Bound to `null` in mock mode, not to a stub. A service that asks for it and
 * gets null knows it is running without an RRA connection and must say so to
 * its caller; a stub that answered plausibly would let an operator "connect" an
 * account in a deployment that can never certify anything.
 */
export const EBM_LIVE = 'EBM_LIVE';

export interface EbmLive {
  config: EbmLiveConfig;
  client: EbmApiClient;
}
