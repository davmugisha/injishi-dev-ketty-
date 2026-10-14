// Verify ADR-060 Phase 2 over real HTTP: a TIN check returns the company the
// register holds, and a registration is held to it.
//
// The mock company register's documented blocks make every run fresh
// (`shared/registry/demo-registers.ts`): `9981NNNNN` has one director,
// National ID `11990800NNNNN101`; `9982NNNNN` has two, `11990801NNNNN101` and
// `11992702NNNNN101`.
//
// WHAT IT PROVES:
//   A. A TIN in the register comes back with its legal name, type, address and
//      directors BY NAME, and no director's ID number anywhere in the answer.
//   B. `registrantIsDirector` is true for a director and false for anyone else;
//      a TIN with no company details answers null.
//   C. Create refuses a legal name that is not the register's.
//   D. A director registers as the owner. Anyone else registering as the owner
//      is refused at `capacity`, naming the on behalf path.
//   E. On behalf, the intended owner must be one of the directors; naming one
//      registers.
//
// WRITES: fresh accounts and two registrations per run. SAMPLE database only.
//   node --env-file=.env scripts/verify-registration-tin-details.mjs
const API = process.env.VERIFY_API_URL || 'http://127.0.0.1:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const RUN = Date.now().toString(36);

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `   ${detail}`}`);
}

function jar(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function sessionFor(email) {
  await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp: OTP }),
  });
  if (!res.ok) throw new Error(`${email}: sign-in ${res.status}`);
  return jar(res);
}

async function call(cookie, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

/** Verify a person through the register, and return who it says they are. */
async function verify(cookie, documentNumber) {
  const sent = await call(cookie, 'POST', '/api/v1/me/identity/national-id/lookup', { documentNumber });
  if (sent.json?.status !== 'code_sent') throw new Error(`lookup ${documentNumber}: ${sent.text}`);
  const person = await call(cookie, 'POST', '/api/v1/me/identity/national-id/confirm', {
    challengeId: sent.json.challengeId,
    code: OTP,
  });
  if (person.status !== 200) throw new Error(`confirm ${documentNumber}: ${person.text}`);
  return person.json;
}

const five = () => String(10_000 + Math.floor(Math.random() * 89_999));
const ADDRESS = { country: 'RW', provinceId: 1, districtId: 102, sectorId: 10201, street: 'KG 11 Ave' };

function registration({ person, tin, legalName, capacity = 'owner', intendedOwner }) {
  return {
    role: 'host',
    capacity,
    personal: {
      fullName: person.fullName,
      dateOfBirth: person.dateOfBirth,
      phoneE164: person.phoneE164,
      address: ADDRESS,
    },
    ...(intendedOwner ? { intendedOwner } : {}),
    business: {
      domain: 'hospitality',
      legalName,
      address: ADDRESS,
      accommodationClass: 'hotel',
      tin,
      chamberOfTourismMember: false,
      psfMember: false,
    },
  };
}

const ok = (r) => r.status === 200 || r.status === 201;

const one = five();
const two = five();
const soleTin = `9981${one}`;
const pairTin = `9982${two}`;
const soleDirector = `11990800${one}101`;
const pairDirector = `11990801${two}101`;

const director = await sessionFor(`tin-director-${RUN}@verify.injishi.rw`);
const stranger = await sessionFor(`tin-stranger-${RUN}@verify.injishi.rw`);
const directorPerson = await verify(director, soleDirector);
const strangerPerson = await verify(stranger, `119908${String(2_000_000 + Math.floor(Math.random() * 7_000_000))}${five().slice(0, 2)}1`);

console.log('A. the register answers with the company');
const sole = await call(director, 'POST', '/api/v1/registrations/tin-check', { tin: soleTin });
const business = sole.json?.business;
check(
  'legal name, type, address and one director by name',
  sole.status === 200 && business?.legalName && business?.companyType && business?.address?.sectorId && business?.directors?.length === 1 && business?.directors[0]?.name === directorPerson.fullName,
  sole.text.slice(0, 300),
);
check('no director ID number anywhere in the answer', !/\d{16}/.test(sole.text), sole.text);

console.log('B. is the caller a director?');
check('true for its director', sole.json?.registrantIsDirector === true, String(sole.json?.registrantIsDirector));
const pair = await call(stranger, 'POST', '/api/v1/registrations/tin-check', { tin: pairTin });
check('false for anyone else', pair.json?.registrantIsDirector === false && pair.json?.business?.directors?.length === 2, pair.text.slice(0, 200));
const plain = await call(stranger, 'POST', '/api/v1/registrations/tin-check', { tin: `9990${five()}` });
check('null, with no business, for a TIN the register has no details for', plain.json?.business === null && plain.json?.registrantIsDirector === null, plain.text);

console.log('C. the legal name is the register\'s');
const misnamed = await call(director, 'POST', '/api/v1/registrations', registration({ person: directorPerson, tin: soleTin, legalName: 'Some Other Name Ltd' }));
check('refused at business.legalName', misnamed.status === 400 && /business.*legalName|legalName/.test(misnamed.text), misnamed.text.slice(0, 300));

console.log('D. who may register as the owner');
const owner = await call(director, 'POST', '/api/v1/registrations', registration({ person: directorPerson, tin: soleTin, legalName: business.legalName }));
check('its director registers as the owner', ok(owner), owner.text.slice(0, 300));
const pretender = await call(stranger, 'POST', '/api/v1/registrations', registration({ person: strangerPerson, tin: pairTin, legalName: pair.json.business.legalName }));
check('anyone else is refused at capacity, pointed to on behalf', pretender.status === 400 && /capacity/.test(pretender.text) && /on behalf/.test(pretender.text), pretender.text.slice(0, 300));

console.log('E. on behalf, the owner must be a director');
const wrongOwner = await call(stranger, 'POST', '/api/v1/registrations', registration({
  person: strangerPerson,
  tin: pairTin,
  legalName: pair.json.business.legalName,
  capacity: 'on_behalf_of',
  intendedOwner: { name: 'Not A Director', nationalId: `119908${String(2_000_000 + Math.floor(Math.random() * 7_000_000))}551`, email: `owner-${RUN}@verify.injishi.rw` },
}));
check('a non-director owner is refused at intendedOwner.nationalId', wrongOwner.status === 400 && /nationalId/.test(wrongOwner.text), wrongOwner.text.slice(0, 300));
const onBehalf = await call(stranger, 'POST', '/api/v1/registrations', registration({
  person: strangerPerson,
  tin: pairTin,
  legalName: pair.json.business.legalName,
  capacity: 'on_behalf_of',
  intendedOwner: { name: pair.json.business.directors[0].name, nationalId: pairDirector, email: `owner-${RUN}@verify.injishi.rw` },
}));
check('naming a director registers on their behalf', ok(onBehalf), onBehalf.text.slice(0, 300));
if (owner.status === 201 && onBehalf.status === 201) console.log('  director rule enforced');

console.log(failures === 0 ? '\nTIN DETAILS VERIFIED' : `\n${failures} FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
