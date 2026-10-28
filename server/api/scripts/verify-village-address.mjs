// Verify the village level of the address (D24): the two new steps of the
// geography cascade, and what a submitted village does to a row.
//
// The address used to stop at sector. `orgs.village_id` and
// `user_profiles.village_id` had existed the whole time and nothing ever wrote
// them, so "village" was a column, not a field. This drives the two write paths
// over HTTP and then READS THE DATABASE, because "the village was stored" is a
// claim about a row and only a row can settle it.
//
// WHAT IT PROVES, by phase:
//
//   --phase geography
//     GET /api/v1/geography/cells and /villages answer, scoped by the level
//     above them, in the same order and with the same membership the database
//     gives for that scope — compared against SQL rather than against a number
//     typed into this file. The unscoped village list is the whole country.
//     A zero id is refused by the query contract.
//
//   --phase business
//     A registration carrying a village writes it to `orgs.village_id`; one
//     without a village writes NULL; one whose village sits under a different
//     sector is refused 400 naming `business.address.villageId`; one naming a
//     village that does not exist is refused with the OTHER sentence; and a
//     RESIDENCE registration is refused the same way, which is the arm that
//     `branchRowsFor` returns early from and would have skipped.
//
//   --phase personal
//     PUT /api/v1/me/profile with a cell and village stores the village and
//     reads back BOTH — the cell joined up from the village, never stored.
//     Saving the same address without a village clears it, because the form is
//     the whole answer. A village under another sector is refused 400 naming
//     `address.villageId`.
//
// WHAT IT LEAVES BEHIND: two throwaway accounts,
// `village-verify-biz@injishi.com` and `village-verify-me@injishi.com`, and the
// registrations the business phase creates, named "VILLAGE-VERIFY …" with a TIN
// from the visibly synthetic `999` block. Nothing is deleted: unpicking a
// registration means unpicking its workspace, invoice, events and properties,
// and a verification script that can half-delete a business is worse than one
// that leaves a labelled row behind.
//
// Needs the API on 8000 and a sample-marked database seeded with geography.
//
// Run it:  node scripts/verify-village-address.mjs --phase geography

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { apiEnvFile } from './env-file.mjs';

const BASE = process.env.API_BASE || 'http://127.0.0.1:8000';
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:3000';
const BIZ_REGISTRANT = 'village-verify-biz@injishi.com';
const ME_REGISTRANT = 'village-verify-me@injishi.com';

const PHASES = ['geography', 'business', 'personal'];
const phaseIndex = process.argv.indexOf('--phase');
const phase = phaseIndex === -1 ? null : process.argv[phaseIndex + 1];
if (!PHASES.includes(phase)) {
  console.error(`usage: node scripts/verify-village-address.mjs --phase <${PHASES.join('|')}>`);
  process.exit(2);
}

let pass = 0;
let fail = 0;
const failures = [];

function check(label, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

// ---------------------------------------------------------------------------
// The database, read directly: a stored id is the thing under test.
// ---------------------------------------------------------------------------
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = apiEnvFile() ?? new URL('../.env', import.meta.url);
  const line = readFileSync(env, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL is not set and not in server/api/.env.test (or the APP_ENV file)');
  return line.slice('DATABASE_URL='.length).trim();
}
const db = new pg.Pool({ connectionString: databaseUrl() });
const q = async (text, params = []) => (await db.query(text, params)).rows;

/**
 * Registering a business needs a verified identity wherever a check can run
 * (ADR-060). This proof is about something else, so its registrant is verified
 * by staff, the way the demo seeds verify theirs (`manual`), under the same
 * name and birth date the proof then sends.
 */
async function markVerified(email, fullName, dateOfBirth) {
  const [user] = await q(`select id from users where lower(email) = lower($1)`, [email]);
  if (!user) throw new Error(`markVerified: no user ${email}`);
  await q(
    `insert into verified_identities (user_id, kyc_status, legal_full_name, dob, verified_method, verified_at)
     values ($1, 'verified', $2, $3, 'manual', now())
     on conflict (user_id) do update set kyc_status = 'verified', legal_full_name = $2, dob = $3,
       verified_method = 'manual', verified_at = now()`,
    [user.id, fullName, dateOfBirth],
  );
}

// ---------------------------------------------------------------------------
// Sessions, cached between runs in the OS temp directory. The OTP cap is five
// codes per address per hour, and the cache holds live cookies, so it never
// sits in the repository.
// ---------------------------------------------------------------------------
const JAR_FILE = join(tmpdir(), 'injishi-verify-village-sessions.json');
const JARS = (() => {
  try {
    return existsSync(JAR_FILE) ? JSON.parse(readFileSync(JAR_FILE, 'utf8')) : {};
  } catch {
    return {};
  }
})();

function makeSession(seed) {
  const jar = new Map(Object.entries(seed ?? {}));
  return {
    cookie: () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '),
    absorb(res) {
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    },
    snapshot: () => Object.fromEntries(jar),
  };
}

async function call(session, method, path, body, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (session) headers.cookie = session.cookie();
  let payload;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (session) session.absorb(res);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function signIn(email) {
  const cached = JARS[email];
  if (cached) {
    const reused = makeSession(cached);
    const probe = await call(reused, 'GET', '/api/v1/me/profile');
    if (probe.status === 200) return reused;
  }
  const session = makeSession();
  const origin = { origin: WEB_ORIGIN };
  await call(session, 'POST', '/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' }, origin);
  const res = await call(session, 'POST', '/api/auth/sign-in/email-otp', { email, otp: '123456' }, origin);
  if (res.status !== 200) {
    throw new Error(`sign-in failed for ${email}: ${res.status} ${res.text.slice(0, 200)}`);
  }
  JARS[email] = session.snapshot();
  writeFileSync(JAR_FILE, JSON.stringify(JARS, null, 1));
  return session;
}

/**
 * Two real, DIFFERENT places, read out of the database rather than typed here.
 *
 * `here` and `elsewhere` are in different sectors on purpose: the second is
 * what makes "that village is not in the sector you chose" testable, and a pair
 * hard-coded from a dump would rot the first time the geography seed changed.
 */
async function twoPlaces() {
  const rows = await q(
    `select v.id as village_id, v.name as village_name, c.id as cell_id,
            s.id as sector_id, d.id as district_id, d.province_id
       from villages v
       join cells c on c.id = v.cell_id
       join sectors s on s.id = c.sector_id
       join districts d on d.id = s.district_id
      order by v.id
      limit 1`,
  );
  const here = rows[0];
  if (!here) throw new Error('no villages in this database — run pnpm db:seed first');
  const [elsewhere] = await q(
    `select v.id as village_id, c.sector_id
       from villages v
       join cells c on c.id = v.cell_id
      where c.sector_id <> $1
      order by v.id
      limit 1`,
    [here.sector_id],
  );
  if (!elsewhere) throw new Error('only one sector has villages — cannot test the mismatch');
  return { here, elsewhere };
}

const address = (place, { withVillage }) => ({
  country: 'RW',
  provinceId: place.province_id,
  districtId: place.district_id,
  sectorId: place.sector_id,
  ...(withVillage ? { cellId: place.cell_id, villageId: place.village_id } : {}),
});

const personalFor = (name, nationalId, phone, addr) => ({
  fullName: name,
  document: { documentType: 'national_id', documentNumber: nationalId, issuingCountry: 'RW' },
  dateOfBirth: '1990-01-01',
  phoneE164: phone,
  address: addr,
});

/** A visibly synthetic TIN: the `999` block, as the demo catalogue uses. */
const syntheticTin = () => `999${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;

/** The message at one field path in a validation refusal, or null. */
function issueAt(res, path) {
  const issues = res.json?.issues ?? res.json?.message?.issues ?? [];
  const hit = issues.find((i) => (i.path ?? []).map(String).join('.') === path);
  return hit ? hit.message : null;
}

// ---------------------------------------------------------------------------
// Phase: the cascade
// ---------------------------------------------------------------------------
async function geographyPhase() {
  const { here } = await twoPlaces();

  const cells = await call(null, 'GET', `/api/v1/geography/cells?sectorId=${here.sector_id}`);
  const cellsExpected = await q(
    `select id, name, sector_id from cells where sector_id = $1 order by name`,
    [here.sector_id],
  );
  check('GET /geography/cells answers 200', cells.status === 200, `status ${cells.status}`);
  check(
    'the cells in a sector are exactly the database rows, in the database order',
    JSON.stringify(cells.json) ===
      JSON.stringify(cellsExpected.map((r) => ({ id: r.id, name: r.name, sectorId: r.sector_id }))),
    `endpoint ${cells.json?.length} rows vs database ${cellsExpected.length}`,
  );

  const villages = await call(null, 'GET', `/api/v1/geography/villages?cellId=${here.cell_id}`);
  const villagesExpected = await q(
    `select id, name, cell_id from villages where cell_id = $1 order by name`,
    [here.cell_id],
  );
  check('GET /geography/villages answers 200', villages.status === 200, `status ${villages.status}`);
  check(
    'the villages in a cell are exactly the database rows, in the database order',
    JSON.stringify(villages.json) ===
      JSON.stringify(villagesExpected.map((r) => ({ id: r.id, name: r.name, cellId: r.cell_id }))),
    `endpoint ${villages.json?.length} rows vs database ${villagesExpected.length}`,
  );
  check(
    'that cell holds at least one village, so the list above proves something',
    villagesExpected.length > 0,
    'the scoped list is empty',
  );

  // The scope is optional on both endpoints, exactly as it is on districts and
  // sectors. Counted against the table rather than against a number typed here.
  const allVillages = await call(null, 'GET', '/api/v1/geography/villages');
  const [{ n: villageCount }] = await q(`select count(*)::int as n from villages`);
  check(
    'the unscoped village list is the whole country',
    allVillages.status === 200 && allVillages.json?.length === villageCount,
    `endpoint ${allVillages.json?.length} vs table ${villageCount}`,
  );

  // Positive ids or nothing. `0` is what an unanswered select would send if the
  // picker ever stopped omitting it, and it must not read as "unscoped".
  const zeroCell = await call(null, 'GET', '/api/v1/geography/cells?sectorId=0');
  const zeroVillage = await call(null, 'GET', '/api/v1/geography/villages?cellId=0');
  check('a zero sectorId is refused rather than treated as unscoped', zeroCell.status === 400, `status ${zeroCell.status}`);
  check('a zero cellId is refused rather than treated as unscoped', zeroVillage.status === 400, `status ${zeroVillage.status}`);

  // A negative control for the two membership assertions above: the same
  // comparison against the WRONG scope has to fail, or it proves nothing.
  const otherCell = await q(
    `select id from cells where sector_id = $1 and id <> $2 order by id limit 1`,
    [here.sector_id, here.cell_id],
  );
  if (otherCell.length > 0) {
    const wrong = await call(null, 'GET', `/api/v1/geography/villages?cellId=${otherCell[0].id}`);
    check(
      'the same check against a different cell returns a different list (control)',
      JSON.stringify(wrong.json) !== JSON.stringify(villages.json),
      'two different cells returned identical village lists',
    );
  } else {
    check(
      'the same check against a different cell returns a different list (control)',
      false,
      'that sector holds only one cell, so the control could not run',
    );
  }
}

// ---------------------------------------------------------------------------
// Phase: the business address
// ---------------------------------------------------------------------------
async function businessPhase() {
  const { here, elsewhere } = await twoPlaces();
  const session = await signIn(BIZ_REGISTRANT);
  await markVerified(BIZ_REGISTRANT, "Village Verify Registrant", "1990-01-01");
  const personal = personalFor(
    'Village Verify Registrant',
    // Its own block: `verify-adr053-claim.mjs` holds 049049 to 049052, and a
    // number held by another account is refused (one human, one account).
    '1199900000059050',
    '+250780059050',
    address(here, { withVillage: false }),
  );

  const hospitality = (legalName, addr) => ({
    role: 'host',
    capacity: 'owner',
    personal,
    business: {
      domain: 'hospitality',
      legalName,
      entityGroup: 'accommodation',
      accommodationClass: 'guest_house',
      tin: syntheticTin(),
      address: addr,
      certificates: [],
    },
  });

  const withVillage = await call(
    session,
    'POST',
    '/api/v1/registrations',
    hospitality(`VILLAGE-VERIFY with village ${Date.now()}`, address(here, { withVillage: true })),
  );
  check('a registration carrying a village is accepted', withVillage.status === 201, `status ${withVillage.status} ${withVillage.text.slice(0, 200)}`);
  const storedWith = withVillage.json?.orgId
    ? (await q(`select village_id, sector_id from orgs where id = $1`, [withVillage.json.orgId]))[0]
    : null;
  check(
    'orgs.village_id holds the village that was sent',
    storedWith?.village_id === here.village_id,
    `stored ${storedWith?.village_id} vs sent ${here.village_id}`,
  );

  const without = await call(
    session,
    'POST',
    '/api/v1/registrations',
    hospitality(`VILLAGE-VERIFY no village ${Date.now()}`, address(here, { withVillage: false })),
  );
  check('a registration without a village is still accepted', without.status === 201, `status ${without.status} ${without.text.slice(0, 200)}`);
  const storedWithout = without.json?.orgId
    ? (await q(`select village_id from orgs where id = $1`, [without.json.orgId]))[0]
    : null;
  check(
    'orgs.village_id is NULL when no village was sent, not 0',
    storedWithout !== null && storedWithout.village_id === null,
    `stored ${storedWithout?.village_id}`,
  );

  const mismatched = await call(session, 'POST', '/api/v1/registrations', {
    ...hospitality(`VILLAGE-VERIFY mismatch ${Date.now()}`, {
      ...address(here, { withVillage: false }),
      villageId: elsewhere.village_id,
    }),
  });
  check('a village from another sector is refused', mismatched.status === 400, `status ${mismatched.status}`);
  check(
    'the refusal names business.address.villageId and says which way it is wrong',
    issueAt(mismatched, 'business.address.villageId') === 'That village is not in the sector you chose.',
    `issues ${JSON.stringify(mismatched.json?.issues ?? mismatched.json)}`.slice(0, 240),
  );

  const unknown = await call(session, 'POST', '/api/v1/registrations', {
    ...hospitality(`VILLAGE-VERIFY unknown ${Date.now()}`, {
      ...address(here, { withVillage: false }),
      villageId: 2147483647,
    }),
  });
  check(
    'a village id no row carries is refused with the other sentence',
    unknown.status === 400 &&
      issueAt(unknown, 'business.address.villageId') === 'That village does not exist. Pick one from the list.',
    `status ${unknown.status} issues ${JSON.stringify(unknown.json?.issues ?? unknown.json)}`.slice(0, 240),
  );

  // The arm the branch-row check returns early from. A residence writes no
  // properties, so a village check that lived in `branchRowsFor` would let a
  // landlord store a village belonging to another sector.
  const residence = await call(session, 'POST', '/api/v1/registrations', {
    role: 'landlord',
    capacity: 'owner',
    personal,
    business: {
      domain: 'residence',
      legalName: `VILLAGE-VERIFY residence ${Date.now()}`,
      residenceClass: 'residential_landlord',
      upi: '1/03/07/02/1234',
      address: { ...address(here, { withVillage: false }), villageId: elsewhere.village_id },
      certificates: [],
    },
  });
  check(
    'a RESIDENCE registration is refused the same mismatch (it writes no branches)',
    residence.status === 400 &&
      issueAt(residence, 'business.address.villageId') === 'That village is not in the sector you chose.',
    `status ${residence.status} issues ${JSON.stringify(residence.json?.issues ?? residence.json)}`.slice(0, 240),
  );

  console.log(`\n  left behind: registrations named "VILLAGE-VERIFY …" owned by ${BIZ_REGISTRANT}`);
}

// ---------------------------------------------------------------------------
// Phase: the personal address
// ---------------------------------------------------------------------------
async function personalPhase() {
  const { here, elsewhere } = await twoPlaces();
  const session = await signIn(ME_REGISTRANT);
  const details = (addr) =>
    personalFor('Village Verify Person', '1199900000059051', '+250780059051', addr);

  const saved = await call(session, 'PUT', '/api/v1/me/profile', details(address(here, { withVillage: true })));
  check('Step 1 with a cell and village is accepted', saved.status === 200, `status ${saved.status} ${saved.text.slice(0, 200)}`);

  const userId = (await q(`select id from users where lower(email) = lower($1)`, [ME_REGISTRANT]))[0]?.id;
  const stored = userId
    ? (await q(`select village_id from user_profiles where user_id = $1`, [userId]))[0]
    : null;
  check(
    'user_profiles.village_id holds the village that was sent',
    stored?.village_id === here.village_id,
    `stored ${stored?.village_id} vs sent ${here.village_id}`,
  );

  const read = await call(session, 'GET', '/api/v1/me/profile');
  check(
    'GET /me/profile returns the village, and the cell joined up from it',
    read.status === 200 &&
      read.json?.address?.villageId === here.village_id &&
      read.json?.address?.cellId === here.cell_id,
    `address ${JSON.stringify(read.json?.address)}`.slice(0, 240),
  );

  // The form is the whole answer: a person who clears their village must be
  // able to clear it, or the picker and the row disagree from then on.
  const cleared = await call(session, 'PUT', '/api/v1/me/profile', details(address(here, { withVillage: false })));
  const afterClear = userId
    ? (await q(`select village_id from user_profiles where user_id = $1`, [userId]))[0]
    : null;
  check('saving the address without a village is accepted', cleared.status === 200, `status ${cleared.status}`);
  check(
    'saving without a village CLEARS the stored one rather than leaving it',
    afterClear !== null && afterClear.village_id === null,
    `stored ${afterClear?.village_id}`,
  );
  check(
    'and the read no longer offers a village or a cell',
    cleared.json?.address?.villageId === undefined && cleared.json?.address?.cellId === undefined,
    `address ${JSON.stringify(cleared.json?.address)}`.slice(0, 240),
  );

  const mismatched = await call(session, 'PUT', '/api/v1/me/profile', {
    ...details({ ...address(here, { withVillage: false }), villageId: elsewhere.village_id }),
  });
  check('a personal village from another sector is refused', mismatched.status === 400, `status ${mismatched.status}`);
  check(
    'the refusal names address.villageId',
    issueAt(mismatched, 'address.villageId') === 'That village is not in the sector you chose.',
    `issues ${JSON.stringify(mismatched.json?.issues ?? mismatched.json)}`.slice(0, 240),
  );
  const afterRefusal = userId
    ? (await q(`select village_id from user_profiles where user_id = $1`, [userId]))[0]
    : null;
  check(
    'the refused save wrote nothing',
    afterRefusal !== null && afterRefusal.village_id === null,
    `stored ${afterRefusal?.village_id}`,
  );
}

const RUN = { geography: geographyPhase, business: businessPhase, personal: personalPhase };
const TOKEN = {
  geography: 'PHASE OK geography cascade',
  business: 'PHASE OK business village',
  personal: 'PHASE OK personal village',
};

const main = async () => {
  console.log(`\n=== verify-village-address --phase ${phase} ===`);
  await RUN[phase]();
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log(`failures: ${failures.join(' | ')}`);
    process.exitCode = 1;
    return;
  }
  // Printed only after every assertion in the phase passed.
  console.log(TOKEN[phase]);
};

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.end());
