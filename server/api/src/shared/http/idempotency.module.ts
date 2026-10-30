import { Module } from '@nestjs/common';

import { isWorkerProcess } from '../process/process-role';
import { IdempotencySweepProcessor } from './idempotency-sweep.processor';

/**
 * The shared idempotency store's worker side (mobile spec 0003, D-r). The
 * interceptor itself needs no module: `@Idempotent()` names it, and Nest builds
 * it in the controller's own module from the global database handle.
 */
@Module({
  providers: [...(isWorkerProcess() ? [IdempotencySweepProcessor] : [])],
})
export class IdempotencyModule {}
