import { Controller, Get, Inject, NotFoundException } from '@nestjs/common';
import {
  ORG_ROLE_LABEL,
  OVERSIGHT_ROLE_LABEL,
  STAFF_ROLE_LABEL,
  type DemoPersona,
  type DemoSeat,
  type DemoSurface,
  type OversightConsoleGrant,
  type StaffRole,
  type WorkspaceAccess,
} from '@injishi/contracts';
import { and, eq, sql } from 'drizzle-orm';

import { users } from '../../../database/drizzle/auth';
import { departmentMembers, departments } from '../../../database/drizzle/operations';
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
 * An email address, a display label and the ROLE each seat carries, for
 * accounts that exist only in a demo database. No password, no token, and
 * **not the sign-in code** — the client knows `123456` because the demo
 * environment publishes it, which is already true of the web app. Adding it to
 * this answer would put a live credential in a response body for no gain.
 *
 * The role is on the answer because the demo is used to PRESENT access control:
 * a roster that reads "Beatha Mukeshimana, Amahoro Hospitality Group" does not
 * tell the room that Beatha is the housekeeper, which is the whole point of
 * signing in as her.
 */

/*
 * The response shape is `DemoPersona` in `@injishi/contracts` (ADR-043), one
 * definition for this route, web's picker and mobile's. Every seat is listed,
 * never flattened: Samuel holds five and is the persona the picker most needs
 * to get right. `staff` is the admin console seat (AC-20) and `oversight` a
 * government assignment; neither is a workspace, so neither is in the ADR-038
 * derivation table below.
 */

/**
 * Rows the demo seed owns.
 *
 * `seed-demo.mjs` mints every id it writes under this prefix precisely so
 * `--reset` can find exactly what it owns; this is the read half of that same
 * rule. Matching on the id rather than on the `@demo.injishi.com` email domain
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

/*
 * The words a role is read in come from `@injishi/contracts` (`ORG_ROLE_LABEL`,
 * `OVERSIGHT_ROLE_LABEL`, `STAFF_ROLE_LABEL`), the same words the team screen
 * and the invitation mail use. This route is the only producer of
 * `DemoSeat.role`, and every picker (web, mobile) renders the string as given.
 */

/**
 * The order seats are listed in inside one persona: government, then business
 * roles by authority, then platform staff, then the personal and broker seats
 * every account can hold. So Samuel reads "Owner, Owner, Housekeeper, Guest,
 * Broker" rather than in whatever order the joins returned.
 */
const ROLE_RANK: readonly string[] = [
  'business_approver',
  'business_field_verifier',
  'tax_compliance_officer',
  'owner',
  'manager',
  'receptionist',
  'housekeeper',
  'staff',
  'personal',
  'broker',
];

function rankOf(seat: DemoSeat): number {
  const i = ROLE_RANK.indexOf(seat.roleKey);
  return i === -1 ? ROLE_RANK.length : i;
}

/** `KIGALI` reads as `Kigali`: the geography seed stores province names upper case. */
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * A workspace seat with its role.
 *
 * `detail` carries what the role alone does not say: a department position
 * when the person holds one, and the registration gate when the business is
 * not yet active — an owner of an org still in the pipeline holds the role and
 * none of its powers (D20, D23), which a presenter must not discover on stage.
 */
function workspaceSeat(seat: WorkspaceAccess, positions: readonly string[]): DemoSeat {
  const surface = surfaceFor(seat);
  if (seat.kind === 'personal') {
    return { label: 'Personal', surface, role: 'Guest / tenant', roleKey: 'personal', detail: null };
  }
  if (seat.kind === 'broker') {
    return { label: 'Brokerage', surface, role: 'Broker', roleKey: 'broker', detail: null };
  }

  const notes = [...positions];
  if (seat.registrationStatus && seat.registrationStatus !== 'active') {
    notes.push(`Not yet approved (${seat.registrationStatus.replace(/_/g, ' ')})`);
  }
  return {
    label: seat.orgName ?? 'Business',
    surface,
    role: seat.orgRole ? ORG_ROLE_LABEL[seat.orgRole] : 'Member',
    roleKey: seat.orgRole ?? 'member',
    detail: notes.length > 0 ? notes.join(' · ') : null,
  };
}

/**
 * One seat per ACTIVE oversight assignment (revoked grants are already absent
 * from the service's answer).
 *
 * Identical role, body, title and region collapse to one seat: two rows that
 * read the same would look like a rendering bug, and they grant nothing more.
 * The label is WHERE the officer sits (body and region), the detail the
 * government's own title for the post.
 */
function oversightSeats(grants: readonly OversightConsoleGrant[]): DemoSeat[] {
  const seen = new Set<string>();
  const seats: DemoSeat[] = [];
  for (const grant of grants) {
    const key = [
      grant.oversightRole,
      grant.bodyCode,
      grant.title ?? '',
      grant.scopeLevel,
      grant.provinceId ?? '',
      grant.districtId ?? '',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);

    const region =
      grant.scopeLevel === 'district' && grant.districtId !== null
        ? `${titleCase(grant.scopeLabel)} district`
        : grant.scopeLevel === 'province' && grant.provinceId !== null
          ? `${titleCase(grant.scopeLabel)} province`
          : titleCase(grant.scopeLabel);

    seats.push({
      label: `${grant.bodyCode} · ${region}`,
      surface: 'oversight',
      role: OVERSIGHT_ROLE_LABEL[grant.oversightRole],
      roleKey: grant.oversightRole,
      detail: grant.title ?? grant.bodyName ?? null,
    });
  }
  return seats;
}

/** The admin console seat: a staff grant, listed with the roles it carries. */
function staffSeat(roles: readonly StaffRole[]): DemoSeat {
  const worded = roles.map((r) => STAFF_ROLE_LABEL[r] ?? r).join(', ');
  return {
    label: 'Admin console',
    surface: 'staff',
    role: worded ? `Platform staff · ${worded}` : 'Platform staff',
    roleKey: 'staff',
    detail: null,
  };
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
      const positions = held.some((seat) => seat.kind === 'business')
        ? await this.positionsByWorkspace(person.id)
        : new Map<string, string[]>();
      const seats: DemoSeat[] = held.map((seat) =>
        workspaceSeat(seat, positions.get(seat.workspaceId) ?? []),
      );

      // A government officer holds no workspace, so an officer read only
      // through `listForUser` had no seat and dropped off the roster — the
      // approver and every field verifier were missing from the demo.
      const grants = await this.workspaces.oversightConsoleGrantsForUser(person.id);
      seats.push(...oversightSeats(grants));

      // The admin console is a staff grant, not a workspace, so it is read from
      // the same answer `GET /api/v1/me/staff` gives and listed as a seat of
      // its own. Without it the staff persona would have no seat and drop out.
      const staff = await this.workspaces.staffAccessForUser(person.id);
      if (staff.isStaff) seats.push(staffSeat(staff.roles));

      // Stable sort: equal ranks keep the resolver's order.
      seats.sort((a, b) => rankOf(a) - rankOf(b));
      personas.push({ email: person.email, name: person.name ?? person.email, seats });
    }

    // A persona with no seat at all cannot demonstrate anything and would read
    // as a broken row on the picker, so it is left out rather than shown empty.
    return personas.filter((p) => p.seats.length > 0);
  }

  /**
   * Department positions per workspace, worded: `Head of Front Office`,
   * `Supervisor · Housekeeping`, or the department name for a plain member.
   * Board placement only — it never decides a permission (D17) — so it is
   * `detail`, never the role.
   */
  private async positionsByWorkspace(userId: string): Promise<Map<string, string[]>> {
    const rows = await this.db
      .select({
        workspaceId: departmentMembers.workspaceId,
        position: departmentMembers.departmentPosition,
        department: departments.name,
      })
      .from(departmentMembers)
      .innerJoin(departments, eq(departments.id, departmentMembers.departmentId))
      .where(
        and(
          eq(departmentMembers.userId, userId),
          eq(departmentMembers.status, 'active'),
          eq(departments.status, 'active'),
        ),
      )
      .orderBy(departments.name);

    const byWorkspace = new Map<string, string[]>();
    for (const row of rows) {
      const worded =
        row.position === 'department_head'
          ? `Head of ${row.department}`
          : row.position === 'supervisor'
            ? `Supervisor · ${row.department}`
            : row.department;
      const list = byWorkspace.get(row.workspaceId) ?? [];
      list.push(worded);
      byWorkspace.set(row.workspaceId, list);
    }
    return byWorkspace;
  }
}

/**
 * Exported for the test that asserts this derivation and the client's
 * `surfaceFor()` in `apps/mobile/src/domain.tsx` still agree on every row of
 * the parent's table. Two copies of one table is the drift worth a test.
 */
export const __testing = {
  surfaceFor,
  SEED_ID_PREFIX,
  workspaceSeat,
  oversightSeats,
  staffSeat,
};
