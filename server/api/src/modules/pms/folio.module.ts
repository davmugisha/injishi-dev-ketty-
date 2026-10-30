import { Module } from '@nestjs/common';

import { FolioPort } from './application/folio-port';
import { FolioRepository } from './infrastructure/folio.repository';

/**
 * The folio's port for other products (ADR-074 stage 4): `OperationsModule`
 * imports it so Outlets' ordering and menu reach the folio without the PMS
 * module, which itself imports `OperationsModule` (for departments and the pay
 * now order settlement). Its own repository instance stays private; PMS's
 * services use the one `BookingModule` provides. Both are stateless over the
 * one database pool, so two instances share nothing that could disagree.
 */
@Module({
  providers: [FolioRepository, FolioPort],
  exports: [FolioPort],
})
export class FolioModule {}
