// Seed the shift roster and attendance with a believable month (HR module,
// Phase 5 — first pass, no ADR yet).
//
// The Roster, Attendance and My time screens are drawn from three tables that
// start empty, and an empty timesheet proves nothing. This writes, for every
// workspace that has employees:
//
//   work_shifts         Morning, Evening and Night, if the business has none
//   shift_assignments   two weeks back, this week and next week: five days on,
//                       two off, each person mostly on one shift
//   attendance_entries  a clock in and out for the days already gone, with the
//                       things a real month has: people a few minutes early,
//                       some late, a shift nobody came in for, somebody who
//                       stayed on, somebody who left early
//
// TODAY IS LEFT HALF DONE ON PURPOSE. A shift that has finished gets both
// times, one that is running gets a clock in only, and one person on a running
// shift is left out, so the board has an "At work", a "Finished" and a "Not
// in" to show. The business's OWNER is never clocked in for today: that is the
// account a demo is given from, and the button is theirs to press.
//
// Every figure comes from a seeded generator keyed on the person and the day,
// so running this twice writes the same month, and `on conflict do nothing`
// keeps anything already there: a day somebody really clocked is never
// replaced by an invented one.
//
// SAFETY. Invented attendance must never land beside real records. This writes
// into DATABASE_URL and refuses, as its first act, any database that does not
// carry the sample marker (ADR-043, `sample-database.mjs`). There is no flag to
// override it.
//
// Run with:
//   pnpm --filter @injishi/api exec node scripts/seed-hr-time-demo.mjs
//   pnpm --filter @injishi/api exec node scripts/seed-hr-time-demo.mjs --reset
//
// `--reset` first removes every shift, roster day and clock record of the
// workspaces it is about to seed, then writes them again.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

const KIGALI_OFFSET_MS = 2 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const USUAL_SHIFTS = [
  { name: 'Morning', start: '07:00', end: '15:00', grace: 10, slot: 1 },
  { name: 'Evening', start: '15:00', end: '23:00', grace: 10, slot: 3 },
  { name: 'Night', start: '23:00', end: '07:00', grace: 10, slot: 5 },
];

const kigaliDay = (at) => new Date(at.getTime() + KIGALI_OFFSET_MS).toISOString().slice(0, 10);
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const atKigali = (day, clock) => new Date(`${day}T${clock.slice(0, 5)}:00+02:00`);
const mondayOf = (day) => addDays(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));
const addMinutes = (at, minutes) => new Date(at.getTime() + minutes * 60_000);

/** When a shift on a day really starts and ends: an end at or before the start is the next morning. */
function shiftWindow(day, shift) {
  const start = atKigali(day, shift.start);
  const end = atKigali(shift.end.slice(0, 5) <= shift.start.slice(0, 5) ? addDays(day, 1) : day, shift.end);
  return { start, end };
}

/** A generator that gives the same numbers for the same person and day, every run. */
function seeded(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
const between = (random, low, high) => low + Math.floor(random() * (high - low + 1));

async function seedWorkspace(client, workspace, now) {
  const today = kigaliDay(now);
  const first = addDays(mondayOf(today), -14);
  const last = addDays(mondayOf(today), 13);

  const { rows: members } = await client.query(
    `select dm.id, dm.user_id, coalesce(u.name, dm.display_name) as name, om.org_role
       from department_members dm
       left join users u on u.id = dm.user_id
       left join org_memberships om on om.id = dm.org_membership_id
      where dm.workspace_id = $1 and dm.status = 'active'
      order by 3`,
    [workspace.id],
  );
  if (members.length === 0) return null;
  // Whoever writes a record for somebody with no login: the owner, or failing that anyone with one.
  const recorder = members.find((m) => m.org_role === 'owner')?.user_id ?? members.find((m) => m.user_id)?.user_id ?? null;

  let { rows: shifts } = await client.query(
    `select id, name, start_time::text as start, end_time::text as "end", grace_minutes as grace
       from work_shifts where workspace_id = $1 and is_active order by start_time`,
    [workspace.id],
  );
  if (shifts.length === 0) {
    for (const s of USUAL_SHIFTS) {
      await client.query(
        `insert into work_shifts (workspace_id, name, start_time, end_time, grace_minutes, color_slot)
         values ($1, $2, $3, $4, $5, $6)`,
        [workspace.id, s.name, s.start, s.end, s.grace, s.slot],
      );
    }
    ({ rows: shifts } = await client.query(
      `select id, name, start_time::text as start, end_time::text as "end", grace_minutes as grace
         from work_shifts where workspace_id = $1 and is_active order by start_time`,
      [workspace.id],
    ));
  }

  const { rows: leave } = await client.query(
    `select department_member_id, start_date::text as start_date, end_date::text as end_date
       from leave_requests
      where workspace_id = $1 and status = 'approved' and start_date <= $3 and end_date >= $2`,
    [workspace.id, first, last],
  );
  const onLeave = (memberId, day) =>
    leave.some((l) => l.department_member_id === memberId && l.start_date <= day && day <= l.end_date);

  let rostered = 0;
  let clocked = 0;
  // One person on a running shift is left without a clock in, so "Not in" has a row.
  let leftOutToday = false;

  for (const [index, member] of members.entries()) {
    const isOwner = member.org_role === 'owner';
    for (let day = first; day <= last; day = addDays(day, 1)) {
      if (onLeave(member.id, day)) continue;
      const random = seeded(`${member.id}|${day}`);
      const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
      // Two days off a week, a different pair for each person, so every day is covered.
      const off = [(index * 2) % 7, (index * 2 + 1) % 7];
      if (off.includes(weekday)) continue;

      // Mostly their own shift; now and then they cover another.
      let shift = shifts[(index + (random() < 0.12 ? 1 : 0)) % shifts.length];
      if (isOwner && day === today) {
        // The demo account: on whichever shift is running, so its button is worth pressing.
        shift = shifts.find((s) => now >= shiftWindow(day, s).start && now < shiftWindow(day, s).end) ?? shift;
      }

      const assigned = await client.query(
        `insert into shift_assignments (workspace_id, department_member_id, shift_id, work_date, assigned_by_user_id)
         values ($1, $2, $3, $4, $5)
         on conflict (department_member_id, work_date) do nothing`,
        [workspace.id, member.id, shift.id, day, recorder],
      );
      rostered += assigned.rowCount;

      // The clock: only for a shift that has started, and never for a day the roster already held.
      if (assigned.rowCount === 0) continue;
      const { start, end } = shiftWindow(day, shift);
      if (now <= start) continue;
      const running = now < end;
      if (day === today && isOwner) continue;
      if (running && !leftOutToday && index > 0) {
        leftOutToday = true;
        continue;
      }
      // About one shift in sixteen, nobody came in for.
      if (!running && random() < 0.06) continue;

      const late = random() < 0.18;
      const arrival = addMinutes(start, late ? between(random, shift.grace + 2, 38) : between(random, -9, 6));
      let departure = null;
      if (!running) {
        const kind = random();
        departure = addMinutes(
          end,
          kind < 0.1 ? -between(random, 20, 45) : kind < 0.22 ? between(random, 30, 75) : between(random, -3, 12),
        );
      }
      const past = Math.floor((arrival.getTime() - start.getTime()) / 60_000);
      // Somebody with no login cannot press the button: HR writes their day.
      const manual = member.user_id === null || (!running && random() < 0.05);

      const written = await client.query(
        `insert into attendance_entries
           (workspace_id, department_member_id, work_date, clock_in_at, clock_out_at, shift_id,
            scheduled_start, scheduled_end, late_minutes, source, note, recorded_by_user_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         on conflict (department_member_id, work_date) do nothing`,
        [
          workspace.id,
          member.id,
          day,
          arrival,
          departure,
          shift.id,
          start,
          end,
          past > shift.grace ? past : 0,
          manual ? 'manual' : 'self',
          manual ? (member.user_id === null ? 'No login: written from the sign in sheet' : 'Forgot to clock out') : null,
          manual ? recorder : member.user_id,
        ],
      );
      clocked += written.rowCount;
    }
  }
  return { people: members.length, shifts: shifts.length, rostered, clocked, first, last };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile(path.join(here, '..', '.env'));
    } catch {
      // No .env beside the API: DATABASE_URL has to come from the environment.
    }
  }
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL is not set.');
  const reset = process.argv.includes('--reset');

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await assertSampleDatabase(client, 'seed-hr-time-demo.mjs');
    const { rows: workspaces } = await client.query(
      `select w.id, o.legal_name as name
         from workspaces w
         left join orgs o on o.id = w.org_id
        where exists (select 1 from department_members dm where dm.workspace_id = w.id and dm.status = 'active')
        order by 2`,
    );
    if (workspaces.length === 0) {
      console.log('No workspace has employees yet. Run the demo seed first, or add employees in HR.');
      return;
    }
    const now = new Date();
    for (const workspace of workspaces) {
      await client.query('begin');
      try {
        if (reset) {
          await client.query('delete from attendance_entries where workspace_id = $1', [workspace.id]);
          await client.query('delete from shift_assignments where workspace_id = $1', [workspace.id]);
          await client.query('delete from work_shifts where workspace_id = $1', [workspace.id]);
        }
        const result = await seedWorkspace(client, workspace, now);
        await client.query('commit');
        if (result) {
          console.log(
            `${workspace.name ?? workspace.id}: ${result.people} people, ${result.shifts} shifts, ` +
              `${result.rostered} roster days and ${result.clocked} clock records written (${result.first} to ${result.last}).`,
          );
        }
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(`\n${err.message}`);
    process.exit(1);
  });
}
