import { Injectable } from '@nestjs/common';

import { FolioRepository } from '../infrastructure/folio.repository';

/**
 * The folio, as other products reach it (ADR-074 stage 4).
 *
 * PMS owns the folio, and Outlets writes to it: a room service order posts its
 * bill line in the same transaction as the move to `delivered`, and the menu
 * prices a dish at the tax rates and under the revenue department the folio
 * reads. So the folio is the one part of PMS another product's module needs,
 * and this is all of what it needs: two reads, and the posting a transaction
 * already in flight runs (`postChargesTx`, with the shape it takes and the
 * account code a line books to). `FolioModule` provides this and nothing else,
 * so a module that imports it can never reach the folio's repository, as
 * ADR-074's import rules ask (one module reaches another only through an
 * exported application service, a port or an event contract).
 */
@Injectable()
export class FolioPort {
  constructor(private readonly folios: FolioRepository) {}

  /** The tax rates in force at `at`, by tax code; null when no rate row applies. */
  effectiveTaxRates(at: Date): ReturnType<FolioRepository['effectiveTaxRates']> {
    return this.folios.effectiveTaxRates(at);
  }

  /** A department, to check that a charge's revenue centre is this workspace's and takes revenue. */
  findDepartment(id: string): ReturnType<FolioRepository['findDepartment']> {
    return this.folios.findDepartment(id);
  }
}

export { type ChargeDraft, NO_CONNECTION, postChargesTx } from '../infrastructure/folio.repository';
export { accountCodeFor } from '../infrastructure/ledger-posting';
