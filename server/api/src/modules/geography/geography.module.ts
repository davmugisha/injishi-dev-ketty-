import { Module } from '@nestjs/common';

import { GeographyService } from './application/geography.service';
import { GeographyRepository } from './infrastructure/geography.repository';

/**
 * Layering: domain/ (entities, rules) - application/ (use cases) -
 * infrastructure/ (persistence, adapters). Never import another domain module
 * directly; communicate via events or application services.
 *
 * Exports only the application service (GeographyService) — the repository and
 * Drizzle stay private to the module.
 */
@Module({
  providers: [GeographyRepository, GeographyService],
  exports: [GeographyService],
})
export class GeographyModule {}
