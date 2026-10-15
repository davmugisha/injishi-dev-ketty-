/**
 * The area modules of the interface seed, in the order they run. Each exports `seed(ctx)` and writes
 * only its own area's rows on top of the world (`world.mjs`). A wiring leaf adds its module here.
 */
import * as operations from './operations.mjs';
import * as platform from './platform.mjs';

export const AREAS = [
  { area: 'platform', module: platform },
  // After platform: the housekeeping board refers to Jeanne's tasks, which platform.mjs writes.
  { area: 'operations', module: operations },
];
