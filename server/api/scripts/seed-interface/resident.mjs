/**
 * resident.*: what Olivier Habineza's phone reads that the residence module does not already hold.
 * His tenancy (L-KC-014, B-07), its rent, the leaking sink (WO-345), his renewal offer and his two
 * visitor codes are the building's records and live in `residence.mjs`; this adds what only he sees:
 *
 *   notices          the three in-app notices on his home screen (resident.notices)
 *   repairs          his two older repairs, fixed and closed (resident.repairs)
 *   visitors         the guest who came on the 4th, whose code is used (resident.visitors)
 *
 * Runs after `residence.mjs`, whose rows it hangs off.
 */
import { iid, kigaliAt, parseFixtureDate, shiftDate, userId } from './lib.mjs';
import { leaseId, ticketId, unitRoom, upsert } from './residence.mjs';
import { rentalsRebuilt, skipRentalsNote } from '../rentals-rebuilt.mjs';
import { ORG, PROPERTY, WORKSPACE } from './world.mjs';

const WS = WORKSPACE.residences;
const MINE = { column: 'workspace_id', values: [WS] };
const OLIVIER = userId('resident');
const LEASE = leaseId('L-KC-014');

/** Notice category and when each was sent, beyond what resident.notices prints. */
const NOTICES = {
  'water-block-b': { category: 'announcement', sent: ['11 Oct', '17:00'], read: null },
  'renewal-ready': { category: 'lease', sent: ['1 Oct', '10:05'], read: ['2 Oct', '18:40'] },
  'visitor-codes': { category: 'announcement', sent: ['28 Sep', '09:00'], read: ['28 Sep', '20:15'] },
};

/** His closed repairs: "WO-322 · fixed 2 Sep · you confirmed it works". */
const CLOSED = {
  'WO-322': { category: 'doors_windows', reported: '28 Aug', fixed: '2 Sep' },
  'WO-301': { category: 'plumbing', reported: '1 Jul', fixed: '4 Jul' },
};

const story = (text) => shiftDate(parseFixtureDate(text));
const at = (iso, time) => new Date(`${iso}T${time}:00+02:00`);

export async function seed({ c, fx, keep, log }) {
  // Olivier's notices, repairs and visits hang off his lease, which the residence area no longer
  // seeds after the rentals rebuild (../rentals-rebuilt.mjs).
  if (await rentalsRebuilt(c)) {
    log(skipRentalsNote('resident', "Olivier Habineza's notices, repairs and visits"));
    return;
  }
  // ── The notices on his home screen ───────────────────────────────────────────────────────────────
  const noticeRows = fx('resident.notices').map((n) => {
    const plan = NOTICES[n.id];
    if (!plan) throw new Error(`resident.notices ${n.id} has no seed plan`);
    const sent = at(story(plan.sent[0]), plan.sent[1]);
    return {
      id: iid('resident-notice', `kacyiru:${n.id}`), user_id: OLIVIER, workspace_id: WS, category: plan.category,
      channel: 'in_app', title: n.id === 'water-block-b' ? waterTitle() : n.title, body: noticeBody(n), deep_link: null,
      is_transactional: false, delivery_status: 'sent', read_at: n.isNew ? null : at(story(plan.read[0]), plan.read[1]),
      created_at: sent,
    };
  });
  keep('notifications', await upsert(c, 'notifications', noticeRows), MINE);

  // ── His repairs that are done ────────────────────────────────────────────────────────────────────
  const ticketRows = [];
  const eventRows = [];
  for (const r of fx('resident.repairs').filter((x) => x.state === 'Closed')) {
    const plan = CLOSED[r.id];
    if (!plan) throw new Error(`resident.repairs ${r.id} has no seed plan`);
    const reported = at(parseFixtureDate(plan.reported), '19:00');
    const fixed = at(parseFixtureDate(plan.fixed), '11:00');
    ticketRows.push({
      id: ticketId(r.id), workspace_id: WS, org_id: ORG.residences, property_id: PROPERTY.kacyiru, room_id: unitRoom('B-07'),
      space_id: null, lease_id: LEASE, reference: r.id, title: r.title, description: r.title, category: plan.category,
      status: 'closed', priority: 'normal', staff_may_enter: true, raised_by_user_id: OLIVIER, raised_by_role: 'tenant',
      raised_via: 'resident app', assigned_contractor: 'Fidèle Ntawukuriryayo', scheduled_for: parseFixtureDate(plan.fixed),
      visit_window: null, cost_bearer: 'landlord', cost_note: null, photo_object_keys: JSON.stringify([]),
      resolved_at: fixed, created_at: reported,
    });
    eventRows.push(
      { id: iid('residence-ticket-event', `${r.id}:reported`), ticket_id: ticketId(r.id), author_user_id: OLIVIER, kind: 'reported', note: null, created_at: reported },
      { id: iid('residence-ticket-event', `${r.id}:fixed`), ticket_id: ticketId(r.id), author_user_id: null, kind: 'fixed', note: null, created_at: fixed },
      { id: iid('residence-ticket-event', `${r.id}:verified`), ticket_id: ticketId(r.id), author_user_id: OLIVIER, kind: 'verified', note: 'Resident confirmed it works', created_at: new Date(fixed.getTime() + 6 * 3_600_000) },
    );
  }
  const ticketIds = await upsert(c, 'maintenance_tickets', ticketRows);
  keep('maintenance_tickets', ticketIds, MINE);
  keep('maintenance_events', await upsert(c, 'maintenance_events', eventRows), { column: 'ticket_id', values: ticketIds });

  // ── The guest who came on the 4th ────────────────────────────────────────────────────────────────
  const visited = fx('resident.visitors').filter((v) => v.state === 'Visited');
  const passRows = visited.map((v) => {
    const m = v.desc.match(/^(\d{1,2} [A-Z][a-z]{2}) · arrived (\d{2}:\d{2}) · left (\d{2}:\d{2})$/);
    if (!m) throw new Error(`resident.visitors ${v.id}: cannot read "${v.desc}"`);
    const on = story(m[1]);
    return {
      id: iid('visitor-pass', `kacyiru:resident:${v.id}`), workspace_id: WS, property_id: PROPERTY.kacyiru, room_id: unitRoom('B-07'),
      lease_id: LEASE, maintenance_ticket_id: null, kind: 'guest', visitor_name: v.name,
      // A used code is history; it may come round again, so it needs no reservation.
      code: '2716', valid_from: at(on, '14:00'), valid_to: at(on, '20:00'), overnight: false, status: 'used',
      created_by_user_id: OLIVIER, by_tenant: true, used_at: at(on, m[2]), left_at: at(on, m[3]),
    };
  });
  keep('visitor_passes', await upsert(c, 'visitor_passes', passRows), MINE);

  log(`resident: ${noticeRows.length} notices, ${ticketRows.length} closed repairs and ${passRows.length} past visit for Olivier Habineza`);
}

/** "Water off in Block B on Wednesday": the weekday of the day the notice names, wherever the seed lands. */
function waterTitle() {
  const weekday = new Date(`${story('14 Oct')}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  return `Water off in Block B on ${weekday}`;
}

/** A notice's body with its dates moved onto the seed's calendar. */
function noticeBody(n) {
  return n.desc.replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (whole) => {
    const iso = story(whole);
    const d = new Date(`${iso}T12:00:00Z`);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  });
}
