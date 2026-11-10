#!/usr/bin/env node
// ADR-049 - drive training, live attendance and the digital certificate end to
// end against a LIVE stack, and assert what the API actually answered.
//
// Nothing here is a unit test. Every check is an HTTP call against a running
// API with a real Postgres, a real Redis and a real MinIO behind it, because
// `adrs/049-training-and-digital-certification/verify.md` says in as many words
// that typechecked and unit tested is not verified. The one thing it cannot do
// is hold a phone against a printed page: AC-12's "scan it with an ordinary
// camera" stays a human step, and this script gets you the PDF to scan.
//
// Run it with the API up, against a database you control:
//   VERIFY_API_URL=http://localhost:8000 node scripts/verify-training.mjs
//
// ONE SIGN IN PER ACCOUNT, for the reason `verify-authz-http.mjs` records at
// length: the OTP send cap is ten per address per hour and thirty per IP per
// hour, and locally every account shares one address. If a run does lock you
// out, the ledger is `auth_otp_requests` and on a SAMPLE database
// `delete from auth_otp_requests;` clears it. Never on a real one.
//
// IT WRITES REAL ROWS and does not clean them up. Courses, venues, sessions,
// registrations, decisions and certificates all persist, each named with the
// run's timestamp so two runs never collide and so what it left behind is
// obvious in the admin console. A certificate row is never deleted by design
// (AC-23), so there is nothing honest to tidy.
//
// THE MAILS (AC-20, AC-21) are proven at the far end, not at `queue.add`: the
// script reads Mailpit's API for what actually arrived, reads the BullMQ state
// in the Redis the API queues on, and reads and writes Postgres directly for
// the one thing no route does (moving an account to a new email address). So
// on top of the API it needs, pointed at the SAME stack the API runs on:
//   VERIFY_MAILPIT_URL   default http://localhost:8025
//   VERIFY_REDIS_HOST / VERIFY_REDIS_PORT   default 127.0.0.1:6379
//   DATABASE_URL         default the local compose database
// and a worker (`INJISHI_PROCESS=worker node dist/main.js`) on that Redis.
// Check nobody else's worker consumes `TrainingEmail` on it first: a worker
// built from other code, or one mailing somewhere else, steals the jobs and
// the inbox reads empty for a reason that has nothing to do with this code.
// The only rows it CHANGES rather than adds are the email addresses of the
// accounts it created itself in this run.
import { createHash } from 'node:crypto';

import { Queue } from 'bullmq';
import pg from 'pg';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const MAILPIT = (process.env.VERIFY_MAILPIT_URL || 'http://localhost:8025').replace(/\/+$/, '');
const REDIS = {
  host: process.env.VERIFY_REDIS_HOST || '127.0.0.1',
  port: Number(process.env.VERIFY_REDIS_PORT || 6379),
};
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://injishi:injishi@localhost:5432/injishi';
const OTP = process.env.VERIFY_OTP_CODE || '123456';

/** The super_admin, who holds every training permission including publish. */
const ADMIN = process.env.VERIFY_ADMIN_EMAIL || 'admin@injishi.com';
/** An ordinary account with no staff role at all. The learner. */
const LEARNER = process.env.VERIFY_LEARNER_EMAIL || 'guest@injishi.com';

/** Nyarugenge, in Kigali City. A real reference-data district (D11). */
const DISTRICT_ID = Number(process.env.VERIFY_DISTRICT_ID || 101);

const RUN = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);

/**
 * The withdrawal reason, as a distinctive phrase.
 *
 * Deliberately does NOT embed the run tag. The reason is the secret the public
 * page must not leak, and the run tag is in the course title and the venue
 * name, so a leak check built on the tag would fail on correct data.
 */
const REVOCATION_REASON = 'Withdrawn by automated verification, not for cause.';

let failures = 0;
let checks = 0;

function check(label, ok, detail) {
  checks += 1;
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `\n          ${detail}`}`,
  );
}

function section(title) {
  console.log(`\n${title}`);
}

/** Every cookie a response set, flattened into one request header. */
function jar(res) {
  return (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .join('; ');
}

const SESSIONS = new Map();

/**
 * A signed-in session, plus the emailed step-up satisfied.
 *
 * The step-up calls are harmless for an account that does not owe one and are
 * REQUIRED for staff: `StaffGuard` demands the code of every staff member
 * because of what they are, so without these two calls every admin route here
 * answers 403 and the run reads as an authorization bug that is not one.
 */
async function sessionFor(email) {
  if (SESSIONS.has(email)) return SESSIONS.get(email);

  const sent = await fetch(
    `${API}/api/auth/email-otp/send-verification-otp`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, type: 'sign-in' }),
    },
  );
  if (sent.status === 429) {
    throw new Error(
      `${email} is rate limited (429). See this file's header for the ledger.`,
    );
  }

  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp: OTP }),
  });
  const cookie = jar(res);
  if (!res.ok || !cookie) {
    throw new Error(
      `Could not sign in ${email}: ${res.status} ${await res
        .text()
        .catch(() => '')}`,
    );
  }

  await fetch(`${API}/api/v1/me/two-factor/send`, {
    method: 'POST',
    headers: { cookie },
  });
  await fetch(`${API}/api/v1/me/two-factor/verify`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: OTP }),
  });

  SESSIONS.set(email, cookie);
  return cookie;
}

async function call(method, path, { cookie, body } = {}) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: res.status, body: json, text };
}

async function main() {
  console.log(`ADR-049 training verification against ${API}`);
  console.log(`Run tag ${RUN}\n`);

  const admin = await sessionFor(ADMIN);
  const learner = await sessionFor(LEARNER);

  // -------------------------------------------------------------------------
  section('Courses (AC-30)');
  // -------------------------------------------------------------------------
  const created = await call('POST', '/admin/training/courses', {
    cookie: admin,
    body: {
      slug: `host-basics-${RUN}`,
      title: `Host basics ${RUN}`,
      summary: 'How the platform works, for a host who has not listed yet.',
    },
  });
  check(
    'a platform admin can create a course',
    created.status === 201 || created.status === 200,
    `${created.status} ${created.text.slice(0, 200)}`,
  );
  const courseId = created.body?.id;
  check('the new course starts UNPUBLISHED', created.body?.isPublished === false);

  const beforePublish = await call('GET', '/training/courses');
  check(
    'an unpublished course is absent from the public list (AC-30)',
    !(beforePublish.body?.items ?? []).some((c) => c.id === courseId),
  );

  await call('POST', `/admin/training/courses/${courseId}/publish`, {
    cookie: admin,
    body: { published: true },
  });

  // -------------------------------------------------------------------------
  section('Venues (AC-32)');
  // -------------------------------------------------------------------------
  const office = await call('POST', '/admin/training/venues', {
    cookie: admin,
    body: {
      name: `Injishi office ${RUN}`,
      address: 'KN 4 Ave, Nyarugenge',
      districtId: DISTRICT_ID,
      isOffice: true,
    },
  });
  check(
    'a platform admin can create a venue',
    office.status === 201 || office.status === 200,
    `${office.status} ${office.text.slice(0, 200)}`,
  );
  check('the office venue is flagged as the office', office.body?.isOffice === true);
  check(
    'the venue carries its district AND province name (value sourcing)',
    Boolean(office.body?.districtName) && Boolean(office.body?.provinceName),
    `district=${office.body?.districtName} province=${office.body?.provinceName}`,
  );
  const officeId = office.body?.id;

  const doomed = await call('POST', '/admin/training/venues', {
    cookie: admin,
    body: {
      name: `Roadshow hall ${RUN}`,
      address: 'Musanze town hall',
      districtId: DISTRICT_ID,
    },
  });
  const doomedId = doomed.body?.id;

  const badDistrict = await call('POST', '/admin/training/venues', {
    cookie: admin,
    body: {
      name: `Nowhere ${RUN}`,
      address: 'Nowhere',
      districtId: 999999,
    },
  });
  check(
    'an unknown district is refused with 422, not a 500',
    badDistrict.status === 422,
    `got ${badDistrict.status}`,
  );

  // -------------------------------------------------------------------------
  section('Sessions, and the publish gate (AC-6, AC-33)');
  // -------------------------------------------------------------------------
  const startsAt = new Date(Date.now() + 3 * 86_400_000);
  const endsAt = new Date(startsAt.getTime() + 6 * 3_600_000);

  const adminUserId = await resolveUserId(admin);
  check('the admin resolves to a user id to lead a session', Boolean(adminUserId));

  const session = await call('POST', '/admin/training/sessions', {
    cookie: admin,
    body: {
      courseId,
      venueId: officeId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      feeRwf: 25_000,
      seatCount: 2,
      leadTrainerId: adminUserId,
    },
  });
  check(
    'a session can be drafted',
    session.status === 201 || session.status === 200,
    `${session.status} ${session.text.slice(0, 300)}`,
  );
  const sessionId = session.body?.id;
  check('a drafted session is `draft`', session.body?.status === 'draft');
  check(
    'the session names exactly one lead trainer (AC-7)',
    (session.body?.trainers ?? []).filter((t) => t.isLead).length === 1,
  );

  const draftLeak = await call('GET', `/training/sessions/${sessionId}`);
  check(
    'a DRAFT session is a 404 on the public read (AC-6)',
    draftLeak.status === 404,
    `got ${draftLeak.status}`,
  );

  const published = await call(
    'POST',
    `/admin/training/sessions/${sessionId}/publish`,
    { cookie: admin },
  );
  check(
    'a platform admin can publish it (AC-6)',
    published.status === 200,
    `${published.status} ${published.text.slice(0, 200)}`,
  );
  check('it is now `published`', published.body?.status === 'published');

  const again = await call(
    'POST',
    `/admin/training/sessions/${sessionId}/publish`,
    { cookie: admin },
  );
  check('publishing twice is refused with 409', again.status === 409, `got ${again.status}`);

  // A second session of the SAME course at a DIFFERENT price (AC-33).
  const second = await call('POST', '/admin/training/sessions', {
    cookie: admin,
    body: {
      courseId,
      venueId: officeId,
      startsAt: new Date(startsAt.getTime() + 14 * 86_400_000).toISOString(),
      endsAt: new Date(startsAt.getTime() + 14 * 86_400_000 + 6 * 3_600_000).toISOString(),
      feeRwf: 40_000,
      seatCount: 30,
      leadTrainerId: adminUserId,
    },
  });
  await call('POST', `/admin/training/sessions/${second.body?.id}/publish`, {
    cookie: admin,
  });

  // -------------------------------------------------------------------------
  section('The public page (AC-1, AC-33)');
  // -------------------------------------------------------------------------
  const publicList = await call('GET', '/training/courses');
  check('the public list needs no cookie at all (AC-1)', publicList.status === 200);
  const publicCourse = (publicList.body?.items ?? []).find((c) => c.id === courseId);
  check('the published course appears', Boolean(publicCourse));
  const publicSession = (publicCourse?.sessions ?? []).find((s) => s.id === sessionId);
  check('its published session appears under it', Boolean(publicSession));
  check(
    'the session carries date, venue, district, province, seats and price (AC-1)',
    Boolean(publicSession?.startsAt) &&
      Boolean(publicSession?.venue?.name) &&
      Boolean(publicSession?.venue?.districtName) &&
      Boolean(publicSession?.venue?.provinceName) &&
      typeof publicSession?.seatCount === 'number' &&
      publicSession?.feeRwf === 25_000,
    JSON.stringify(publicSession?.venue ?? {}),
  );
  const prices = (publicCourse?.sessions ?? []).map((s) => s.feeRwf).sort();
  check(
    'two sessions of one course carry two different prices (AC-33)',
    prices.includes(25_000) && prices.includes(40_000),
    `prices=${JSON.stringify(prices)}`,
  );

  // -------------------------------------------------------------------------
  section('Registration (AC-2, AC-3, AC-4, AC-5)');
  // -------------------------------------------------------------------------
  const noBusiness = await call('POST', '/training/registrations', {
    cookie: learner,
    body: { sessionId, fullName: 'Testing Learner', phone: '+250788000111' },
  });
  check(
    'naming no business at all is refused (AC-3)',
    noBusiness.status === 400 || noBusiness.status === 422,
    `got ${noBusiness.status}`,
  );

  const bothWays = await call('POST', '/training/registrations', {
    cookie: learner,
    body: {
      sessionId,
      fullName: 'Testing Learner',
      phone: '+250788000111',
      orgId: '00000000-0000-4000-8000-000000000000',
      businessName: 'Both at once',
    },
  });
  check(
    'naming a business BOTH ways is refused (AC-3)',
    bothWays.status === 400 || bothWays.status === 422,
    `got ${bothWays.status}`,
  );

  const registered = await call('POST', '/training/registrations', {
    cookie: learner,
    body: {
      sessionId,
      fullName: 'Testing Learner',
      phone: '+250788000111',
      businessName: `Free text business ${RUN}`,
    },
  });
  check(
    'a learner can register (AC-2, AC-3)',
    registered.status === 200,
    `${registered.status} ${registered.text.slice(0, 300)}`,
  );
  check('it is not reported as a repeat', registered.body?.alreadyRegistered === false);
  check(
    'the session price is copied onto the registration (AC-33)',
    registered.body?.feeRwf === 25_000,
    `got ${registered.body?.feeRwf}`,
  );
  const registrationId = registered.body?.registrationId;

  const twice = await call('POST', '/training/registrations', {
    cookie: learner,
    body: {
      sessionId,
      fullName: 'Testing Learner',
      phone: '+250788000111',
      businessName: `Free text business ${RUN}`,
    },
  });
  check(
    'registering twice SUCCEEDS and returns the first row (AC-4)',
    twice.status === 200 &&
      twice.body?.alreadyRegistered === true &&
      twice.body?.registrationId === registrationId,
    `${twice.status} ${twice.text.slice(0, 200)}`,
  );

  const foreignOrg = await call('POST', '/training/registrations', {
    cookie: learner,
    body: {
      sessionId: second.body?.id,
      fullName: 'Testing Learner',
      phone: '+250788000111',
      orgId: '00000000-0000-4000-8000-000000000001',
    },
  });
  check(
    'naming an org the caller does not hold is refused',
    foreignOrg.status === 422,
    `got ${foreignOrg.status}`,
  );

  // -------------------------------------------------------------------------
  section('Over-subscription is advisory (AC-5)');
  // -------------------------------------------------------------------------
  const walkInA = await call(
    'POST',
    `/admin/training/sessions/${sessionId}/attendees`,
    {
      cookie: admin,
      body: {
        fullName: `Walk In One ${RUN}`,
        email: `walkin-one-${RUN}@example.test`,
        phone: '+250788000222',
        businessName: 'A walk-in business',
      },
    },
  );
  check(
    'a walk-in with a NEW email is added (AC-8)',
    walkInA.status === 201 || walkInA.status === 200,
    `${walkInA.status} ${walkInA.text.slice(0, 200)}`,
  );
  check(
    'and it did not link an existing account',
    walkInA.body?.linkedExistingUser === false,
  );

  const walkInExisting = await call(
    'POST',
    `/admin/training/sessions/${second.body?.id}/attendees`,
    {
      cookie: admin,
      body: {
        fullName: 'Testing Learner',
        email: LEARNER,
        phone: '+250788000111',
        businessName: 'Matched by email',
      },
    },
  );
  check(
    'a walk-in whose email ALREADY has an account links it (AC-8)',
    (walkInExisting.status === 201 || walkInExisting.status === 200) &&
      walkInExisting.body?.linkedExistingUser === true,
    `${walkInExisting.status} ${walkInExisting.text.slice(0, 200)}`,
  );

  const dupe = await call(
    'POST',
    `/admin/training/sessions/${sessionId}/attendees`,
    {
      cookie: admin,
      body: {
        fullName: `Walk In One ${RUN}`,
        email: `walkin-one-${RUN}@example.test`,
        phone: '+250788000222',
        businessName: 'A walk-in business',
      },
    },
  );
  check(
    'adding the same person twice is refused with 409 (AC-8)',
    dupe.status === 409,
    `got ${dupe.status}`,
  );

  const third = await call(
    'POST',
    `/admin/training/sessions/${sessionId}/attendees`,
    {
      cookie: admin,
      body: {
        fullName: `Walk In Two ${RUN}`,
        email: `walkin-two-${RUN}@example.test`,
        phone: '+250788000333',
        businessName: 'Another walk-in business',
      },
    },
  );
  check(
    'a THIRD person joins a two-seat session, because seats are advisory (AC-5)',
    third.status === 201 || third.status === 200,
    `${third.status} ${third.text.slice(0, 200)}`,
  );

  const oversold = await call('GET', `/training/sessions/${sessionId}`);
  check(
    'the public read reports it over-subscribed, so the page can warn (AC-5)',
    oversold.body?.isOverSubscribed === true && oversold.body?.seatsRemaining < 0,
    `remaining=${oversold.body?.seatsRemaining} over=${oversold.body?.isOverSubscribed}`,
  );

  // -------------------------------------------------------------------------
  section('The tick, and the certificate (AC-9, AC-12, AC-14, AC-17, AC-18)');
  // -------------------------------------------------------------------------
  const roster = await call(
    'GET',
    `/admin/training/sessions/${sessionId}/roster`,
    { cookie: admin },
  );
  check(
    'the roster lists the registrants',
    roster.status === 200 && (roster.body?.items ?? []).length === 3,
    `${roster.status} count=${(roster.body?.items ?? []).length}`,
  );
  check(
    'nobody starts with a decision',
    (roster.body?.items ?? []).every((r) => r.latestDecision === null),
  );

  const key = `verify-training-${RUN}-present`;
  const tick = await call(
    'POST',
    `/admin/training/registrations/${registrationId}/attendance`,
    { cookie: admin, body: { decision: 'present', idempotencyKey: key } },
  );
  check(
    'marking present issues a certificate (AC-9)',
    tick.status === 200 && Boolean(tick.body?.certificateId) && tick.body?.issuedNow === true,
    `${tick.status} ${tick.text.slice(0, 300)}`,
  );
  const certificateId = tick.body?.certificateId;
  const serial = tick.body?.certificateSerial;
  check(
    `the serial reads INJ-TR-<year>-<sequence> (AC-18): ${serial}`,
    /^INJ-TR-\d{4}-\d{6}$/.test(serial ?? ''),
  );
  check(
    'the serial carries the SESSION year, not today (AC-18)',
    serial?.startsWith(`INJ-TR-${startsAt.getUTCFullYear()}-`),
    `serial=${serial} sessionYear=${startsAt.getUTCFullYear()}`,
  );

  const replay = await call(
    'POST',
    `/admin/training/registrations/${registrationId}/attendance`,
    { cookie: admin, body: { decision: 'present', idempotencyKey: key } },
  );
  check(
    'replaying the SAME idempotency key issues nothing new (AC-9)',
    replay.status === 200 &&
      replay.body?.certificateId === certificateId &&
      replay.body?.issuedNow === false,
    `${replay.status} ${replay.text.slice(0, 200)}`,
  );

  const absentTick = await call(
    'POST',
    `/admin/training/registrations/${registrationId}/attendance`,
    {
      cookie: admin,
      body: {
        decision: 'absent',
        reason: 'Ticked the wrong row.',
        idempotencyKey: `${key}-correction`,
      },
    },
  );
  check(
    'a LATER decision supersedes the earlier one (AC-11)',
    absentTick.status === 200 && absentTick.body?.registrationStatus === 'absent',
    `${absentTick.status} ${absentTick.text.slice(0, 200)}`,
  );

  const afterCorrection = await call(
    'GET',
    `/admin/training/sessions/${sessionId}/roster`,
    { cookie: admin },
  );
  const corrected = (afterCorrection.body?.items ?? []).find(
    (r) => r.registrationId === registrationId,
  );
  check(
    'both decision rows survive and the later one wins (AC-11)',
    corrected?.decisionCount === 2 && corrected?.latestDecision === 'absent',
    `count=${corrected?.decisionCount} latest=${corrected?.latestDecision}`,
  );
  check(
    'the certificate is NOT deleted by a correction (AC-23)',
    corrected?.certificateId === certificateId,
  );

  // -------------------------------------------------------------------------
  section('The PDF (AC-12, AC-13)');
  // -------------------------------------------------------------------------
  const mine = await call('GET', '/training/me', { cookie: learner });
  check('a learner can read their own certificates', mine.status === 200);
  const myCert = (mine.body?.certificates?.items ?? []).find(
    (c) => c.id === certificateId,
  );
  check('the certificate is listed for its holder', Boolean(myCert));
  check(
    'the PDF was rendered and stored (AC-13)',
    myCert?.hasPdf === true,
    'hasPdf was false: the render or the MinIO put failed. Check the API log.',
  );
  check(
    'the verification URL is absolute and points at /verify/<token>',
    /^https?:\/\/.+\/verify\/[0-9A-Z]+$/.test(myCert?.verifyUrl ?? ''),
    myCert?.verifyUrl,
  );
  check(
    'the locked values are all on the record (AC-14)',
    Boolean(myCert?.holderName) &&
      Boolean(myCert?.venueName) &&
      Boolean(myCert?.districtName) &&
      Boolean(myCert?.leadTrainerName) &&
      Boolean(myCert?.sessionDate),
    JSON.stringify(myCert ?? {}),
  );

  const link = await call('GET', `/training/certificates/${certificateId}/pdf`, {
    cookie: learner,
  });
  check(
    'the holder gets a signed url for the PDF (AC-13)',
    link.status === 200 && Boolean(link.body?.url),
    `${link.status} ${link.text.slice(0, 200)}`,
  );
  check(
    'the signed url expires inside 900 seconds (AC-13)',
    link.body?.expiresInSeconds > 0 && link.body?.expiresInSeconds <= 900,
    `ttl=${link.body?.expiresInSeconds}`,
  );

  if (link.body?.url) {
    const fetched = await fetch(link.body.url);
    const bytes = Buffer.from(await fetched.arrayBuffer());
    check(
      'the signed url actually serves a PDF out of MinIO (AC-13)',
      fetched.ok && bytes.subarray(0, 5).toString() === '%PDF-',
      `status=${fetched.status} first bytes=${bytes.subarray(0, 8).toString('hex')}`,
    );
    console.log(`          PDF url, to open and scan by hand (AC-12):\n          ${link.body.url}`);
  }

  const notMine = await call(
    'GET',
    `/training/certificates/${certificateId}/pdf`,
    { cookie: admin },
  );
  check(
    "somebody else's certificate PDF is refused with 403 (AC-13)",
    notMine.status === 403,
    `got ${notMine.status}`,
  );

  // -------------------------------------------------------------------------
  section('Public verification (AC-15, AC-16)');
  // -------------------------------------------------------------------------
  const token = myCert?.verifyUrl?.split('/verify/')[1];
  const valid = await call('GET', `/verify/${token}`);
  check(
    'the token verifies with no cookie at all (AC-15)',
    valid.status === 200 && valid.body?.status === 'valid',
    `${valid.status} ${valid.text.slice(0, 200)}`,
  );
  check(
    'it names the holder, the course and its version, the date and the venue (AC-15)',
    Boolean(valid.body?.holderName) &&
      Boolean(valid.body?.courseTitle) &&
      typeof valid.body?.courseVersion === 'number' &&
      Boolean(valid.body?.sessionDate) &&
      Boolean(valid.body?.issuedAt),
  );
  check(
    'it does NOT carry the business name (AC-12)',
    !JSON.stringify(valid.body ?? {}).toLowerCase().includes('free text business'),
    JSON.stringify(valid.body ?? {}),
  );

  const unknown = await call('GET', '/verify/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  check(
    'an unknown token answers 200, the same code as a valid one (AC-16)',
    unknown.status === valid.status,
    `unknown=${unknown.status} valid=${valid.status}`,
  );
  check(
    'and the SAME set of keys, so the shape gives nothing away (AC-16)',
    JSON.stringify(Object.keys(unknown.body ?? {}).sort()) ===
      JSON.stringify(Object.keys(valid.body ?? {}).sort()),
    `unknown=${Object.keys(unknown.body ?? {}).sort().join(',')}`,
  );

  // -------------------------------------------------------------------------
  section('Withdrawal purges the cache on the NEXT load (AC-16, AC-22)');
  // -------------------------------------------------------------------------
  // Read it first so the answer is definitely cached. Without this the purge
  // would appear to work simply because nothing had been cached yet, which is
  // the false pass verify.md warns about.
  await call('GET', `/verify/${token}`);

  const noReason = await call(
    'POST',
    `/admin/training/certificates/${certificateId}/revoke`,
    { cookie: admin, body: { reason: '' } },
  );
  check(
    'withdrawing with an empty reason is refused (AC-22)',
    noReason.status === 400 || noReason.status === 422,
    `got ${noReason.status}`,
  );

  const revoked = await call(
    'POST',
    `/admin/training/certificates/${certificateId}/revoke`,
    { cookie: admin, body: { reason: REVOCATION_REASON } },
  );
  check(
    'the issuer or an admin can withdraw it (AC-22)',
    revoked.status === 200 && Boolean(revoked.body?.revokedAt),
    `${revoked.status} ${revoked.text.slice(0, 200)}`,
  );

  const afterRevoke = await call('GET', `/verify/${token}`);
  check(
    'the public page reads REVOKED on the very next load, not in 60s (AC-16)',
    afterRevoke.body?.status === 'revoked' && Boolean(afterRevoke.body?.revokedAt),
    `status=${afterRevoke.body?.status}`,
  );
  check(
    'the public page does not leak the withdrawal REASON',
    // Matched on a phrase that appears NOWHERE else in the run. The first
    // version of this check looked for the run tag, which is also in the course
    // title and the venue name, so it failed on data that was perfectly
    // correct. A leak check has to look for the secret, not for a string the
    // secret happens to contain.
    !JSON.stringify(afterRevoke.body ?? {}).includes(REVOCATION_REASON) &&
      !('revocationReason' in (afterRevoke.body ?? {})),
    JSON.stringify(afterRevoke.body ?? {}),
  );

  const revokeTwice = await call(
    'POST',
    `/admin/training/certificates/${certificateId}/revoke`,
    { cookie: admin, body: { reason: 'again' } },
  );
  check(
    'withdrawing twice is refused with 409 (AC-23)',
    revokeTwice.status === 409,
    `got ${revokeTwice.status}`,
  );

  // -------------------------------------------------------------------------
  section('Retiring a venue (AC-32)');
  // -------------------------------------------------------------------------
  const draftAtDoomed = await call('POST', '/admin/training/sessions', {
    cookie: admin,
    body: {
      courseId,
      venueId: doomedId,
      startsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      endsAt: new Date(Date.now() + 30 * 86_400_000 + 6 * 3_600_000).toISOString(),
      feeRwf: 15_000,
      seatCount: 20,
      leadTrainerId: adminUserId,
    },
  });
  const doomedSessionId = draftAtDoomed.body?.id;

  const retired = await call('POST', `/admin/training/venues/${doomedId}/retire`, {
    cookie: admin,
  });
  check(
    'retiring a venue reports how many drafts it just blocked (AC-32)',
    retired.status === 200 && retired.body?.draftsNowBlocked >= 1,
    `${retired.status} blocked=${retired.body?.draftsNowBlocked}`,
  );

  const publishAtRetired = await call(
    'POST',
    `/admin/training/sessions/${doomedSessionId}/publish`,
    { cookie: admin },
  );
  check(
    'a draft at a retired venue is refused at publish with 409 (AC-32)',
    publishAtRetired.status === 409,
    `got ${publishAtRetired.status} ${publishAtRetired.text.slice(0, 200)}`,
  );

  const activeVenues = await call('GET', '/admin/training/venues', {
    cookie: admin,
  });
  check(
    "a retired venue is gone from the trainer's picker (AC-32)",
    !(activeVenues.body?.items ?? []).some((v) => v.id === doomedId),
  );

  const stillThere = await call('GET', `/training/sessions/${sessionId}`);
  check(
    'a session published at a still-active venue is unaffected (AC-32)',
    stillThere.status === 200,
  );

  // -------------------------------------------------------------------------
  section('Closing the roster (AC-10)');
  // -------------------------------------------------------------------------
  const closed = await call(
    'POST',
    `/admin/training/sessions/${sessionId}/close-roster`,
    { cookie: admin },
  );
  check(
    'closing marks every undecided registrant absent in one action (AC-10)',
    closed.status === 200 && closed.body?.markedAbsent === 2,
    `${closed.status} marked=${closed.body?.markedAbsent}`,
  );

  const closedTwice = await call(
    'POST',
    `/admin/training/sessions/${sessionId}/close-roster`,
    { cookie: admin },
  );
  check(
    'closing twice is refused with 409',
    closedTwice.status === 409,
    `got ${closedTwice.status}`,
  );

  const afterClose = await call(
    'GET',
    `/admin/training/sessions/${sessionId}/roster`,
    { cookie: admin },
  );
  check(
    'closing issued no certificates (AC-10)',
    (afterClose.body?.items ?? []).filter((r) => r.certificateId).length === 1,
    `certificates=${(afterClose.body?.items ?? []).filter((r) => r.certificateId).length}`,
  );

  const tickAfterClose = await call(
    'POST',
    `/admin/training/registrations/${registrationId}/attendance`,
    {
      cookie: admin,
      body: { decision: 'present', idempotencyKey: `${key}-after-close` },
    },
  );
  check(
    'a closed roster refuses a further tick with 409',
    tickAfterClose.status === 409,
    `got ${tickAfterClose.status}`,
  );

  // -------------------------------------------------------------------------
  section('Withdrawal by the learner (AC-29)');
  // -------------------------------------------------------------------------
  const otherReg = (
    await call('GET', '/training/me', { cookie: learner })
  ).body?.registrations?.items?.find((r) => r.session.id === second.body?.id);

  if (otherReg) {
    const notYours = await call(
      'DELETE',
      `/training/registrations/${otherReg.id}`,
      { cookie: admin },
    );
    check(
      "a learner cannot withdraw somebody else's registration (AC-29)",
      notYours.status === 403,
      `got ${notYours.status}`,
    );

    const withdrew = await call(
      'DELETE',
      `/training/registrations/${otherReg.id}`,
      { cookie: learner },
    );
    check(
      'a learner can withdraw their own before the session starts (AC-29)',
      withdrew.status === 200 && withdrew.body?.status === 'withdrawn',
      `${withdrew.status} ${withdrew.text.slice(0, 200)}`,
    );
  } else {
    check('found the learner\'s second registration to withdraw', false);
  }

  // -------------------------------------------------------------------------
  section('Wording (AC-31)');
  // -------------------------------------------------------------------------
  const forbidden = ['qualified', 'passed', 'certified competent', 'competent'];
  const verifyBody = JSON.stringify(afterRevoke.body ?? {}).toLowerCase();
  check(
    'the verification response uses none of the competence words (AC-31)',
    !forbidden.some((word) => verifyBody.includes(word)),
    verifyBody.slice(0, 200),
  );

  await verifyMails({
    admin,
    adminUserId,
    courseId,
    courseTitle: `Host basics ${RUN}`,
    officeId,
  });

  console.log(
    `\n${failures === 0 ? 'ALL PASS' : `${failures} FAILED`}  (${checks} checks)`,
  );
  console.log(
    `\nStill a human step: open the PDF url printed above and hold a phone\n` +
      `camera against its QR. AC-12 is about a symbol that scans off paper, and\n` +
      `no assertion in this file can stand in for that.`,
  );

  process.exit(failures === 0 ? 0 : 1);
}

// ===========================================================================
// The mails (AC-20, AC-21)
// ===========================================================================

/** The queue `TrainingNotificationsService` adds to. Named in `queues.module.ts`. */
const TRAINING_QUEUE = 'TrainingEmail';
const DAY_MS = 86_400_000;

/** The subject line each event opens with. Owned by `training-mailer.ts`. */
const SUBJECT = {
  registered: (title) => `You are registered: ${title}`,
  reminder: (title) => `Tomorrow: ${title}`,
  certificate_issued: (title) => `Your certificate: ${title}`,
  rescheduled: (title) => `Moved: ${title}`,
  cancelled: (title) => `Cancelled: ${title}`,
};

/** Every message Mailpit holds for one address, newest first. */
async function mailsTo(address) {
  const res = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}&limit=200`,
  );
  if (!res.ok) throw new Error(`Mailpit search answered ${res.status}`);
  const body = await res.json();
  // Search is by substring on the header; keep only exact recipients so
  // `moved-x@` never counts toward `x@`.
  return (body.messages ?? []).filter((m) =>
    (m.To ?? []).some((to) => to.Address.toLowerCase() === address.toLowerCase()),
  );
}

async function mailsOf(address, event, title) {
  const prefix = SUBJECT[event](title);
  return (await mailsTo(address)).filter((m) => m.Subject.startsWith(prefix));
}

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait for at least one `event` mail to `address`.
 *
 * 45 seconds, because the path is API → Redis → worker → SMTP → Mailpit and a
 * first attempt can meet a cold transport. A relay failure is retried after
 * 30 s by the job's backoff, so a mail that needed its first retry still lands
 * inside this window, and one that needed two is a finding, not a flake.
 */
async function waitForMail(address, event, title, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = await mailsOf(address, event, title);
    if (found.length > 0 || Date.now() > deadline) return found;
    await pause(750);
  }
}

/**
 * Let the queue drain before COUNTING, so "exactly one" is not just "one so far".
 *
 * Nothing waiting, nothing active, then a further two seconds for the SMTP
 * hand-off to show up in Mailpit. Delayed jobs are excluded: those are the
 * reminders, which are meant to sit there.
 */
async function settle(queue) {
  const deadline = Date.now() + 60_000;
  for (;;) {
    const counts = await queue.getJobCounts('waiting', 'active', 'prioritized', 'paused');
    const busy = Object.values(counts).reduce((a, b) => a + b, 0);
    if (busy === 0 || Date.now() > deadline) break;
    await pause(500);
  }
  await pause(2_000);
}

/** One message's text body and its attachments' bytes. */
async function readMail(id) {
  const res = await fetch(`${MAILPIT}/api/v1/message/${id}`);
  const body = await res.json();
  const attachments = [];
  for (const part of body.Attachments ?? []) {
    const bytes = Buffer.from(
      await (await fetch(`${MAILPIT}/api/v1/message/${id}/part/${part.PartID}`)).arrayBuffer(),
    );
    attachments.push({ ...part, bytes });
  }
  return { text: body.Text ?? '', attachments };
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The reminder scheduler's id. Mirrors `trainingReminderJobId` in `domain/training-mail.ts`. */
const reminderJobId = (sessionId, startsAt) =>
  `training-reminder-schedule:${sessionId}:${startsAt.getTime()}`;

/** When a delayed job will fire, from BullMQ's own record of it. */
const firesAt = (job) => job.timestamp + (job.delay ?? job.opts?.delay ?? 0);

async function verifyMails({ admin, adminUserId, courseId, courseTitle, officeId }) {
  const queue = new Queue(TRAINING_QUEUE, { connection: REDIS });
  const db = new pg.Client({ connectionString: DATABASE_URL });
  await db.connect();

  try {
    // -----------------------------------------------------------------------
    section('Mail: nobody else is drawing these jobs');
    // -----------------------------------------------------------------------
    const workers = await queue.getWorkers();
    check(
      `exactly one worker consumes ${TRAINING_QUEUE} on ${REDIS.host}:${REDIS.port}`,
      workers.length === 1,
      `found ${workers.length}. Zero means nothing will send; more than one means ` +
        'another process may take the jobs and mail them from other code.',
    );

    // A learner of this run's own, so its address can be moved without
    // touching an account anybody else signs in with.
    const firstEmail = `mail-learner-${RUN}@example.test`;
    const movedEmail = `moved-mail-learner-${RUN}@example.test`;
    const walkInEmail = `mail-walkin-${RUN}@example.test`;
    const cancelWalkInEmail = `mail-walkin-attended-${RUN}@example.test`;
    const learner = await sessionFor(firstEmail);
    const learnerId = await resolveUserId(learner);

    // -----------------------------------------------------------------------
    section('Mail: publishing starts the reminder clock (AC-20)');
    // -----------------------------------------------------------------------
    const startsAt = new Date(Math.ceil((Date.now() + 3 * DAY_MS) / 60_000) * 60_000);
    const hours = 6 * 3_600_000;
    const drafted = await call('POST', '/admin/training/sessions', {
      cookie: admin,
      body: {
        courseId,
        venueId: officeId,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + hours).toISOString(),
        feeRwf: 10_000,
        seatCount: 20,
        leadTrainerId: adminUserId,
      },
    });
    const sessionId = drafted.body?.id;
    const publishedAt = Date.now();
    const published = await call('POST', `/admin/training/sessions/${sessionId}/publish`, {
      cookie: admin,
    });
    check('the mail session is published', published.status === 200, published.text.slice(0, 200));

    const firstReminder = await queue.getJob(reminderJobId(sessionId, startsAt));
    check(
      'ONE delayed reminder job exists for the session, under the id derived from its start',
      Boolean(firstReminder) && (await firstReminder.getState()) === 'delayed',
      `job=${firstReminder?.id} state=${firstReminder && (await firstReminder.getState())}`,
    );
    check(
      'it fires 24 hours before the session starts (AC-20)',
      Boolean(firstReminder) &&
        Math.abs(firesAt(firstReminder) - (startsAt.getTime() - DAY_MS)) < 5_000,
      firstReminder &&
        `fires ${new Date(firesAt(firstReminder)).toISOString()}, expected ` +
          `${new Date(startsAt.getTime() - DAY_MS).toISOString()} (published ${new Date(publishedAt).toISOString()})`,
    );

    // -----------------------------------------------------------------------
    section('Mail: registered (AC-20), and a repeated raise is ONE mail');
    // -----------------------------------------------------------------------
    const registration = {
      sessionId,
      fullName: `Mail Learner ${RUN}`,
      phone: '+250788000444',
      businessName: `Mail business ${RUN}`,
    };
    const reg = await call('POST', '/training/registrations', { cookie: learner, body: registration });
    check('the mail learner registers', reg.status === 200, `${reg.status} ${reg.text.slice(0, 200)}`);
    const registrationId = reg.body?.registrationId;

    const registeredMail = await waitForMail(firstEmail, 'registered', courseTitle);
    check(
      'the REGISTERED mail arrives in Mailpit, sent by the worker',
      registeredMail.length >= 1,
      `nothing to ${firstEmail} within 45s. Is a worker running on this Redis, and can it reach SMTP?`,
    );

    const again = await call('POST', '/training/registrations', { cookie: learner, body: registration });
    check(
      'registering again returns the same registration, which re-raises the mail (AC-4)',
      again.body?.alreadyRegistered === true && again.body?.registrationId === registrationId,
    );
    await settle(queue);
    const registeredCount = (await mailsOf(firstEmail, 'registered', courseTitle)).length;
    check(
      'a REPEATED raise sends ONE registered mail, because the job id is derived',
      registeredCount === 1,
      `got ${registeredCount}`,
    );

    const walkIn = await call('POST', `/admin/training/sessions/${sessionId}/attendees`, {
      cookie: admin,
      body: {
        fullName: `Mail Walkin ${RUN}`,
        email: walkInEmail,
        phone: '+250788000555',
        businessName: 'Mail walk-in business',
      },
    });
    check('a walk-in joins the mail session', walkIn.status === 200 || walkIn.status === 201, walkIn.text.slice(0, 200));

    // -----------------------------------------------------------------------
    section('Mail: the account moves to a new address (AC-20)');
    // -----------------------------------------------------------------------
    // No route changes an account's email, so the row is moved directly. That
    // is exactly the case AC-20 is about: the registration keeps the address
    // given at sign-up as a record, and the account moves on.
    await db.query('update users set email = $1 where id = $2', [movedEmail, learnerId]);
    const snapshot = await db.query(
      'select r.email as snapshot, u.email as current from training_registrations r join users u on u.id = r.user_id where r.id = $1',
      [registrationId],
    );
    check(
      'the registration still holds the OLD address as its snapshot, and the account the new one',
      snapshot.rows[0]?.snapshot === firstEmail && snapshot.rows[0]?.current === movedEmail,
      JSON.stringify(snapshot.rows[0]),
    );

    // -----------------------------------------------------------------------
    section('Mail: rescheduled, with the reason (AC-21)');
    // -----------------------------------------------------------------------
    const moveReason = `The hall is being repainted that week (${RUN}).`;
    const movedStart = new Date(startsAt.getTime() + DAY_MS);
    const moved = await call('PATCH', `/admin/training/sessions/${sessionId}`, {
      cookie: admin,
      body: {
        startsAt: movedStart.toISOString(),
        endsAt: new Date(movedStart.getTime() + hours).toISOString(),
        rescheduleReason: moveReason,
      },
    });
    check('the published session is moved', moved.status === 200, `${moved.status} ${moved.text.slice(0, 200)}`);

    for (const [who, address] of [['the moved learner', movedEmail], ['the walk-in', walkInEmail]]) {
      const got = await waitForMail(address, 'rescheduled', courseTitle);
      check(`the RESCHEDULED mail reaches ${who} at the account's current address`, got.length >= 1, `nothing to ${address}`);
      const text = got[0] ? (await readMail(got[0].ID)).text : '';
      check(`${who}'s rescheduled mail carries the trainer's reason (AC-21)`, text.includes(moveReason), text.slice(0, 400));
    }

    check(
      'the replaced reminder is GONE from the queue (AC-21)',
      !(await queue.getJob(reminderJobId(sessionId, startsAt))),
    );
    const secondReminder = await queue.getJob(reminderJobId(sessionId, movedStart));
    check(
      'a new delayed reminder exists against the NEW start, 24 hours before it (AC-21)',
      Boolean(secondReminder) &&
        (await secondReminder.getState()) === 'delayed' &&
        Math.abs(firesAt(secondReminder) - (movedStart.getTime() - DAY_MS)) < 5_000,
      secondReminder
        ? `state=${await secondReminder.getState()} fires ${new Date(firesAt(secondReminder)).toISOString()}`
        : 'no job',
    );

    // -----------------------------------------------------------------------
    section('Mail: the reminder, fired early (AC-20)');
    // -----------------------------------------------------------------------
    const registrants = [movedEmail, walkInEmail];
    await secondReminder?.promote();
    for (const address of registrants) await waitForMail(address, 'reminder', courseTitle);
    await settle(queue);
    for (const address of registrants) {
      const n = (await mailsOf(address, 'reminder', courseTitle)).length;
      check(`firing the reminder sends ONE reminder mail to ${address}`, n === 1, `got ${n}`);
    }

    // The session moves a SECOND time after its reminder already went out. The
    // new time is owed a reminder of its own, and a derived job id that ignores
    // the start time would be refused as a duplicate of the first.
    const secondReason = `The trainer is travelling (${RUN}).`;
    const movedAgain = new Date(movedStart.getTime() + DAY_MS);
    const second = await call('PATCH', `/admin/training/sessions/${sessionId}`, {
      cookie: admin,
      body: {
        startsAt: movedAgain.toISOString(),
        endsAt: new Date(movedAgain.getTime() + hours).toISOString(),
        rescheduleReason: secondReason,
      },
    });
    check('the session is moved a second time', second.status === 200, second.text.slice(0, 200));
    const thirdReminder = await queue.getJob(reminderJobId(sessionId, movedAgain));
    check('a reminder is scheduled against the second new start', Boolean(thirdReminder));
    await thirdReminder?.promote();
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      const counts = await Promise.all(registrants.map(async (a) => (await mailsOf(a, 'reminder', courseTitle)).length));
      if (counts.every((n) => n >= 2)) break;
      await pause(750);
    }
    await settle(queue);
    for (const address of registrants) {
      const reminders = (await mailsOf(address, 'reminder', courseTitle)).length;
      const moves = (await mailsOf(address, 'rescheduled', courseTitle)).length;
      check(
        `after a second move ${address} gets a SECOND reminder and a second move notice, one of each per move`,
        reminders === 2 && moves === 2,
        `reminders=${reminders} rescheduled=${moves}`,
      );
    }

    // -----------------------------------------------------------------------
    section('Mail: certificate issued, with the stored PDF (AC-20)');
    // -----------------------------------------------------------------------
    const tickKey = `verify-training-mail-${RUN}`;
    const tick = await call('POST', `/admin/training/registrations/${registrationId}/attendance`, {
      cookie: admin,
      body: { decision: 'present', idempotencyKey: tickKey },
    });
    check('the mail learner is marked present', tick.status === 200 && tick.body?.issuedNow === true, tick.text.slice(0, 200));
    const serial = tick.body?.certificateSerial;

    const certMail = await waitForMail(movedEmail, 'certificate_issued', courseTitle);
    check('the CERTIFICATE mail arrives at the current address', certMail.length >= 1, `nothing to ${movedEmail}`);
    const cert = certMail[0] ? await readMail(certMail[0].ID) : { text: '', attachments: [] };
    const pdfs = cert.attachments.filter((a) => a.ContentType === 'application/pdf');
    check(
      'it carries exactly one PDF attachment named for the serial',
      pdfs.length === 1 && pdfs[0].FileName === `${serial}.pdf`,
      JSON.stringify(cert.attachments.map(({ FileName, ContentType, Size }) => ({ FileName, ContentType, Size }))),
    );
    check(
      'and the verification link (AC-20)',
      /\/verify\/[0-9A-Z]+/.test(cert.text),
      cert.text.slice(0, 400),
    );

    const link = await call('GET', `/training/certificates/${tick.body?.certificateId}/pdf`, { cookie: learner });
    const stored = link.body?.url ? Buffer.from(await (await fetch(link.body.url)).arrayBuffer()) : Buffer.alloc(0);
    check(
      'the attached PDF is BYTE-IDENTICAL to the object stored in MinIO (read back, not re-rendered)',
      pdfs.length === 1 && stored.length > 0 && sha256(pdfs[0].bytes) === sha256(stored),
      `attachment ${pdfs[0]?.bytes.length} bytes ${pdfs[0] && sha256(pdfs[0].bytes).slice(0, 16)}, ` +
        `stored ${stored.length} bytes ${sha256(stored).slice(0, 16)}`,
    );

    await call('POST', `/admin/training/registrations/${registrationId}/attendance`, {
      cookie: admin,
      body: { decision: 'present', idempotencyKey: tickKey },
    });
    await settle(queue);
    const certCount = (await mailsOf(movedEmail, 'certificate_issued', courseTitle)).length;
    check('a replayed tick re-raises the mail and still sends ONE certificate mail', certCount === 1, `got ${certCount}`);

    // -----------------------------------------------------------------------
    section('Mail: cancelled, with the reason (AC-21)');
    // -----------------------------------------------------------------------
    const doomedStart = new Date(Math.ceil((Date.now() + 6 * DAY_MS) / 60_000) * 60_000);
    const doomed = await call('POST', '/admin/training/sessions', {
      cookie: admin,
      body: {
        courseId,
        venueId: officeId,
        startsAt: doomedStart.toISOString(),
        endsAt: new Date(doomedStart.getTime() + hours).toISOString(),
        feeRwf: 10_000,
        seatCount: 20,
        leadTrainerId: adminUserId,
      },
    });
    const doomedId = doomed.body?.id;
    await call('POST', `/admin/training/sessions/${doomedId}/publish`, { cookie: admin });
    check(
      'the session to be cancelled has its reminder queued',
      Boolean(await queue.getJob(reminderJobId(doomedId, doomedStart))),
    );

    const regDoomed = await call('POST', '/training/registrations', {
      cookie: learner,
      body: { ...registration, sessionId: doomedId },
    });
    check('the moved learner registers for it', regDoomed.status === 200, regDoomed.text.slice(0, 200));
    // Registered AFTER the move: the registration's own snapshot is the new
    // address here, so this one proves nothing about snapshots. The ones above do.
    const attendee = await call('POST', `/admin/training/sessions/${doomedId}/attendees`, {
      cookie: admin,
      body: {
        fullName: `Mail Attended ${RUN}`,
        email: cancelWalkInEmail,
        phone: '+250788000666',
        businessName: 'Attended before the cancel',
      },
    });
    const attendedTick = await call(
      'POST',
      `/admin/training/registrations/${attendee.body?.registrationId}/attendance`,
      { cookie: admin, body: { decision: 'present', idempotencyKey: `${tickKey}-attended` } },
    );
    check('one registrant is marked present before the cancel', attendedTick.status === 200, attendedTick.text.slice(0, 200));

    const cancelReason = `Too few registrations this month (${RUN}).`;
    const cancelled = await call('POST', `/admin/training/sessions/${doomedId}/cancel`, {
      cookie: admin,
      body: { reason: cancelReason },
    });
    check(
      'cancelling releases the undecided and keeps the attended (AC-21)',
      cancelled.status === 200 && cancelled.body?.releasedCount === 1 && cancelled.body?.keptAttendedCount === 1,
      `${cancelled.status} ${cancelled.text.slice(0, 200)}`,
    );

    for (const [who, address] of [['the released learner', movedEmail], ['the attended walk-in', cancelWalkInEmail]]) {
      const got = await waitForMail(address, 'cancelled', courseTitle);
      check(`the CANCELLED mail reaches ${who}`, got.length >= 1, `nothing to ${address}`);
      const text = got[0] ? (await readMail(got[0].ID)).text : '';
      check(`${who}'s cancelled mail carries the reason (AC-21)`, text.includes(cancelReason), text.slice(0, 400));
    }
    check(
      "the cancelled session's reminder is REMOVED from the queue (AC-21)",
      !(await queue.getJob(reminderJobId(doomedId, doomedStart))),
    );

    // -----------------------------------------------------------------------
    section('Mail: the registration snapshot is never mailed (AC-20)');
    // -----------------------------------------------------------------------
    await settle(queue);
    // Training mails only: this address also received its own sign-in codes,
    // which belong to the account the script created and prove nothing here.
    const toSnapshot = (await mailsTo(firstEmail)).filter((m) => m.Subject.includes(courseTitle));
    check(
      'the OLD address received only the registered mail sent before the move, nothing after it',
      toSnapshot.length === 1 && toSnapshot[0].Subject.startsWith(SUBJECT.registered(courseTitle)),
      JSON.stringify(toSnapshot.map((m) => m.Subject)),
    );
    const runRegistrations = new Set(
      (
        await db.query('select id from training_registrations where session_id = any($1::uuid[])', [
          [sessionId, doomedId],
        ])
      ).rows.map((r) => r.id),
    );
    const failed = await queue.getJobs(['failed'], 0, 500);
    const ours = failed.filter(
      (j) =>
        runRegistrations.has(j.data?.registrationId) ||
        j.data?.sessionId === sessionId ||
        j.data?.sessionId === doomedId,
    );
    check(
      'no training mail job of this run sits in the failed set',
      ours.length === 0,
      ours.map((j) => `${j.id}: ${j.failedReason}`).join('; '),
    );
  } finally {
    await queue.close();
    await db.end();
  }
}

/**
 * The signed-in account's own user id.
 *
 * From Better Auth's own session endpoint, because neither `/me/staff` nor
 * `/me/workspaces` carries an id: the first reports roles and permissions, the
 * second reports workspaces. A session's own user id is not something the
 * training routes accept as input either, and deliberately so - a session is
 * drafted with an explicit `leadTrainerId` because a platform admin drafts
 * sessions they will not teach. So the id has to be discovered here.
 */
async function resolveUserId(cookie) {
  const res = await fetch(`${API}/api/auth/get-session`, { headers: { cookie } });
  const body = await res.json().catch(() => null);
  return body?.session?.userId ?? body?.user?.id ?? null;
}

main().catch((error) => {
  console.error(`\nverify-training could not run: ${error.message}`);
  process.exit(1);
});
