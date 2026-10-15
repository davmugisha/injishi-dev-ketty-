/**
 * The area modules of the interface seed, in the order they run. Each exports `seed(ctx)` and writes
 * only its own area's rows on top of the world (`world.mjs`). A wiring leaf adds its module here.
 */
import * as frontdesk from './frontdesk.mjs';
import * as platform from './platform.mjs';
import * as stays from './stays.mjs';

export const AREAS = [
  { area: 'platform', module: platform },
  // Bookings, stays and bills before the conversations about them (stays hangs threads off bookings).
  { area: 'frontdesk', module: frontdesk },
  { area: 'stays', module: stays },
];
