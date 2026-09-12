import { Controller, Get, Inject, NotFoundException } from '@nestjs/common';
import type { DemoPersona, DemoSeat, DemoSurface } from '@injishi/contracts';
import { sql } from 'drizzle-orm';

import { users } from '../../../database/drizzle/auth';
import { WorkspaceService } from '../../../shared/auth/workspace.service';
import { PLATFORM, type Platform } from '../../../shared/config/platform';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

/**
 * The demo roster, so a presenter can sign in as any persona in two taps
 * (ADR-038 child 0, AC-S10).
 *
 * ## Why this is a route and not a constant in the app
 *
 * The picker has to agree with the switcher about what a persona holds. If the
 * app carried its own list, the two would drift the first time a seat changed
 * in the seed, and the drift would show up on stage as a persona whose tabs are
 * not the ones the picker promised. So the seats are derived HERE, from the
 * same `WorkspaceService.listForUser()` that `/me/workspaces` answers from, and
 * through the same derivation table the client uses for the switcher.
 *
 * ## Why a 404 rather than an empty list
 *
 * An empty list is information: it says the route exists and this is not a
 * demo. A 404 says nothing at all, and the absence is then indistinguishable
 * from the route never having been built. That matters less for security than
 * for honesty about what the surface is, and it costs nothing.
 *
 * The gate is `PLATFORM` (`shared/config/platform.ts`), the same value that
 * decides whether the fixed sign-in code can be issued at all, and it only says
 * demo in a process standing on a database that carries the sample marker
 * (ADR-043). So this route cannot list accounts from a real database.
 *
 * ## What it does and does not expose
 *
 * An email address and a display label, for accounts that exist only in a demo
 * database. No password, no token, and **not the sign-in code** — the client
 * knows `123456` because the demo environment publishes it, which is already
 * true of the web app. Adding it to this answer would put a live credential in
 * a response body for no gain.
 */

/*
 * The response shape is `DemoPersona` in `@injishi/contracts` (ADR-043), one
 * definition for this route, web's picker and mobile's. Every seat is listed,
 * never flattened: Samuel holds five and is the persona the picker most needs
 * to get right. `staff` is the admin console seat (AC-20), a staff grant rather
 * than a workspace, so it is not in the ADR-038 derivation table below.
 */

/**
 * Rows the demo seed owns.
 *
 * `seed-demo.mjs` mints every id it writes under this prefix precisely so
 * `--reset` can find exactly what it owns; this is the read half of that same
 * rule. Matching on the id rather than on the `@demo.injishi.rw` email domain
 * keeps the answer to "rows the seed wrote", which is the honest question, and
 * does not accidentally include a person who signed up with that domain.
 */
const SEED_ID_PREFIX = 'de300000-0000-4000-8000-%';

/**
 * The parent's derivation table, server side.
 *
 * `personal` is returned as `personal` rather than as `guest` or `tenant`,
 * because that row of the table reads "guest or tenant, by the stored domain
 * toggle" and the toggle lives on the device. The server answering `guest` here
 * would be the server having an opinion it does not hold. The client renders
 * the pair.
 */
function surfaceFor(seat: {
  kind: 'business' | 'broker' | 'personal';
  domain: 'hospitality' | 'residence' | null;
  orgRole: string | null;
}): DemoSurface {
  if (seat.kind === 'personal') return 'personal';
  if (seat.kind === 'broker') return 'broker';
  if (seat.domain === 'residence') return 'landlord';
  if (seat.domain === 'hospitality') {
    return seat.orgRole === 'housekeeper' ? 'work' : 'host';
  }
  // A business seat with no domain is not something the schema produces. It is
  // listed as personal rather than guessed into a surface nobody chose.
  return 'personal';
}

@Controller('demo/personas')
export class DemoPersonasController {
  constructor(
    @Inject(PLATFORM) private readonly platform: Platform,
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly workspaces: WorkspaceService,
  ) {}

  /**
   * The demo roster with each persona's seats, or a 404 off the demo.
   *
   * Unauthenticated on purpose: this is the list you read BEFORE you have a
   * session, and there is nothing behind it that a session would protect.
   */
  @Get()
  async list(): Promise<DemoPersona[]> {
    if (this.platform.environment !== 'demo') {
      throw new NotFoundException();
    }

    const roster = await this.db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(sql`${users.id}::text like ${SEED_ID_PREFIX}`)
      .orderBy(users.email);

    // Sequential rather than a `Promise.all` fan-out: this is the demo
    // answering a handful of rows once per sign-in screen, and a fan-out of one
    // query per person is a burst on a database somebody is also presenting
    // from. Readability wins over a few milliseconds nobody sees.
    const personas: DemoPersona[] = [];
    for (const person of roster) {
      const held = await this.workspaces.listForUser(person.id);
      const staff = await this.workspaces.staffAccessForUser(person.id);
      const seats: DemoSeat[] = held.map((seat) => ({
        label: seat.orgName ?? 'Personal',
        surface: surfaceFor(seat),
      }));
      // The admin console is a staff grant, not a workspace, so it is read from
      // the same answer `GET /api/v1/me/staff` gives and listed as a seat of
      // its own. Without it the staff persona would have no seat and drop out.
      if (staff.isStaff) {
        seats.push({ label: `Injishi staff · ${staff.roles.join(', ')}`, surface: 'staff' });
      }
      personas.push({ email: person.email, name: person.name ?? person.email, seats });
    }

    // A persona with no seat at all cannot demonstrate anything and would read
    // as a broken row on the picker, so it is left out rather than shown empty.
    return personas.filter((p) => p.seats.length > 0);
  }
}

/**
 * Exported for the test that asserts this derivation and the client's
 * `surfaceFor()` in `apps/mobile/src/domain.tsx` still agree on every row of
 * the parent's table. Two copies of one table is the drift worth a test.
 */
export const __testing = { surfaceFor, SEED_ID_PREFIX };
