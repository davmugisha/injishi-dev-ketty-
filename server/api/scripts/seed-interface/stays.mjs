/**
 * stays.*: the guest conversations on the desk's Messages screen (`/messages`), as the reservation
 * threads and messages `GET /api/v1/ops/threads` serves, plus the questions three guests sent with
 * their requests to book (read on the Requests tab from the same threads).
 *
 * Each conversation hangs off a booking `frontdesk.mjs` writes (a thread is about exactly one booking,
 * stay or lease). The fixture's conversations name stays from other boards' days; here each guest's
 * conversation is on their booking of THIS day. Only what the platform can store is written: guest and
 * staff text lines. Internal notes and order cards have no body type yet (`message_body_type` is text,
 * image, voice, system), so those lines are left out rather than stored as something they are not.
 * Grace Achieng checked out yesterday, so her conversation is archived (read only), as the fixture says.
 */
import { day, FIXTURE_TODAY, iid, kigaliAt, userId } from './lib.mjs';
import { bookingId, guestUserId } from './frontdesk.mjs';
import { ORG, WORKSPACE } from './world.mjs';

/** Which booking each fixture conversation is about, in this seeded day. */
const THREAD_BOOKING = {
  'Thomas Weber': 'BK-20433',
  'Sarah Kimani': 'BK-20431',
  'Daniel Okafor': 'BK-20436',
  'Yuki Tanaka': 'BK-20438',
  'Aisha Mohammed': 'BK-20440',
  'Pierre Laurent': 'BK-20443',
  'Grace Achieng': 'BK-20411',
};

/** The questions sent with the requests to book (frontdesk.bookingRequests' messages). */
const REQUEST_MESSAGES = [
  { ref: 'BK-20447', name: 'Meera Shah', minutesAgo: 70 },
  { ref: 'BK-20450', name: 'Olivia Grant', minutesAgo: 13 * 60 },
  { ref: 'BK-20448', name: 'Ngozi Okoro', minutesAgo: 2 * 60 },
];

const MONTHS = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };

/** "Today" → 0; "Sunday 11 October" → days from the fixture's prototype day. */
function dayOffset(text) {
  if (/^today$/i.test(text.trim())) return 0;
  if (/^yesterday$/i.test(text.trim())) return -1;
  const m = text.match(/(\d{1,2}) ([A-Z][a-z]+)/);
  if (!m || !MONTHS[m[2]]) throw new Error(`stays.threads: cannot read the day "${text}"`);
  const iso = `${FIXTURE_TODAY.slice(0, 4)}-${String(MONTHS[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return Math.round((Date.parse(`${iso}T12:00:00Z`) - Date.parse(`${FIXTURE_TODAY}T12:00:00Z`)) / 86_400_000);
}

export async function seed({ c, fx, log, keep }) {
  const eric = userId('frontdesk');
  const threads = [];
  const messages = [];

  for (const t of fx('stays.threads')) {
    const ref = THREAD_BOOKING[t.name];
    if (!ref) throw new Error(`stays.threads ${t.id}: no booking for ${t.name}`);
    const guest = guestUserId(t.name);
    let offset = 0;
    const lines = [];
    for (const m of t.messages) {
      if (m.t === 'day') {
        offset = dayOffset(m.text);
        continue;
      }
      if (m.t !== 'guest' && m.t !== 'staff') continue; // notes and cards: no body type for them yet
      const time = m.meta.match(/(\d{2}:\d{2})/)?.[1] ?? '09:00';
      lines.push({ from: m.t === 'guest' ? guest : eric, body: m.text, at: kigaliAt(time, offset) });
    }
    threads.push({
      id: iid('thread', `booking:${ref}`),
      bookingId: bookingId(ref),
      status: t.closed ? 'archived' : 'active',
      lines,
    });
  }
  for (const r of REQUEST_MESSAGES) {
    const message = fx('frontdesk.bookingRequests').find((b) => b.id === r.ref)?.message;
    if (!message) throw new Error(`frontdesk.bookingRequests has no message for ${r.ref}`);
    threads.push({
      id: iid('thread', `booking:${r.ref}`),
      bookingId: bookingId(r.ref),
      status: 'active',
      lines: [{ from: guestUserId(r.name), body: message, at: new Date(Date.now() - r.minutesAgo * 60_000) }],
    });
  }

  // The story's clock is the prototype's morning; a conversation never ends in the future. When the seed
  // runs before its last line, the whole conversation moves back, keeping its spacing.
  const now = Date.now();
  for (const t of threads) {
    const last = Math.max(...t.lines.map((l) => l.at.getTime()));
    const shift = last > now - 2 * 60_000 ? last - (now - 2 * 60_000) : 0;
    if (shift) for (const l of t.lines) l.at = new Date(l.at.getTime() - shift);
  }

  for (const t of threads) {
    const newest = t.lines.reduce((max, l) => (l.at > max ? l.at : max), new Date(0));
    await c.query(
      `INSERT INTO threads (id, workspace_id, booking_id, thread_kind, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'reservation', $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
      [t.id, WORKSPACE.hotel, t.bookingId, t.status, t.lines[0]?.at ?? kigaliAt('08:00', -1), newest],
    );
    for (const [i, l] of t.lines.entries()) {
      const mid = iid('message', `${t.id}:${i}`);
      await c.query(
        `INSERT INTO messages (id, thread_id, sender_user_id, body_type, body, created_at)
         VALUES ($1, $2, $3, 'text', $4, $5)
         ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body, created_at = EXCLUDED.created_at`,
        [mid, t.id, l.from, l.body, l.at],
      );
      messages.push(mid);
    }
  }

  // Converge: a thread a demo day or a flow added goes on the next seed (its lines go with it, by
  // cascade), and so does a line added to one of these conversations. Messages carry no workspace, so
  // they are scoped through the threads this module owns, never another area's.
  // The replies the business keeps ready for its desk (stays.messageTemplates), in EN, RW and FR.
  const templates = [];
  for (const [i, t] of fx('stays.messageTemplates').entries()) {
    const id = iid('message-template', `amahoro-hospitality:${t.id}`);
    await c.query(
      `INSERT INTO message_templates (id, org_id, workspace_id, key, label, body_en, body_rw, body_fr, sort_order, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, body_en = EXCLUDED.body_en, body_rw = EXCLUDED.body_rw,
         body_fr = EXCLUDED.body_fr, sort_order = EXCLUDED.sort_order, active = true, updated_at = now()`,
      [id, ORG.hotel, WORKSPACE.hotel, t.id, t.label, t.EN, t.RW || null, t.FR || null, i],
    );
    templates.push(id);
  }
  keep('message_templates', templates);

  keep('threads', threads.map((t) => t.id));
  keep('messages', messages, { column: 'thread_id', values: threads.map((t) => t.id) });
  log(`stays: ${threads.length} guest conversations with ${messages.length} messages at Isangano (as of ${day(0)}), ${templates.length} reply templates`);
}
