import { Module } from '@nestjs/common';

import { HrFeatureGuard } from './application/hr-feature.guard';
import { HrFeaturesService } from './application/hr-features.service';

/**
 * HR's optional features on their own, so the admin API (which switches them) and the public API (whose
 * routes refuse work through one that is off) take them without the whole HR module. `DRIZZLE` is global.
 */
@Module({
  providers: [HrFeaturesService, HrFeatureGuard],
  exports: [HrFeaturesService, HrFeatureGuard],
})
export class HrFeaturesModule {}
