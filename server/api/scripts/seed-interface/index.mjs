/**
 * The area modules of the interface seed, in the order they run. Each exports `seed(ctx)` and writes
 * only its own area's rows on top of the world (`world.mjs`). A wiring leaf adds its module here.
 */
import * as owner from './owner.mjs';
import * as operations from './operations.mjs';
import * as people from './people.mjs';
import * as platform from './platform.mjs';
import * as staff from './staff.mjs';

export const AREAS = [
  { area: 'platform', module: platform },
  { area: 'owner', module: owner },
  // After platform: the housekeeping board refers to Jeanne's tasks, which platform.mjs writes.
  { area: 'operations', module: operations },
  { area: 'people', module: people },
  // After platform and people: the phone's ticks name platform's tasks, its papers name people's files.
  { area: 'staff', module: staff },
];
