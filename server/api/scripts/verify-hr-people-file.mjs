#!/usr/bin/env node
// Verify the people file end to end (ADR-058 slice 3, 058-people-file).
//
// Drives the real API as the Amahoro demo roster: the owner sets up the HR
// catalogs and a number prefix, fills in three cooks' files, uploads a photo,
// adds pay accounts, writes a note, requests a document and works it through
// refusal and approval, publishes a policy and an announcement, records
// discipline, and draws the org chart. A limited receptionist granted
// `people.manage` proves branch limits, a leaver is rehired as a new file, and
// a Team invitation accepted becomes a thin file. Every check names the
// acceptance criterion it proves.
//
// It WRITES, and it is meant for a sample database you own, never the shared
// one. Everything it creates is new on each run. It grants the receptionist
// role `people.manage` for one section and puts the role back afterwards.
//
// With DATABASE_URL set it also reads the database (audit rows, the outbox, an
// invitation token) and runs the HR daily job through `run-hr-daily.mjs` to
// prove the expiry reminder (AC-PF5). That needs an API build: `dist/`, or
// API_DIST_DIR. Without DATABASE_URL those checks are skipped and say so.
//
//   VERIFY_API_URL=http://localhost:8012 DATABASE_URL=postgres://.../injishi_hr \
//     API_DIST_DIR=dist node scripts/verify-hr-people-file.mjs
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

const API = process.env.VERIFY_API_URL || 'http://localhost:8000';
const OTP = process.env.VERIFY_OTP_CODE || '123456';
const DB = process.env.DATABASE_URL?.trim() || null;
const here = dirname(fileURLToPath(import.meta.url));

const AMAHORO_ORG = 'de300000-0000-4000-8000-000000000101';
const BOUTIQUE = 'de300000-0000-4000-8000-000000000401';
const MUSANZE = 'de300000-0000-4000-8000-000000000404';

let failures = 0;
function check(label, ok, detail) {
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || detail === undefined ? '' : `   ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
}

const kigaliToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date());
const addDays = (d, n) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const today = kigaliToday();

// --- Sessions and calls ---------------------------------------------------------

function jar(res) {
  return (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
}

async function sessionFor(email) {
  const origin = { Origin: 'http://localhost:3000' };
  await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...origin },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...origin },
    body: JSON.stringify({ email, otp: OTP }),
  });
  if (!res.ok) throw new Error(`${email}: sign-in ${res.status} ${await res.text()}`);
  const cookie = jar(res);
  await fetch(`${API}/api/v1/me/two-factor/send`, { method: 'POST', headers: { cookie, ...origin } });
  await fetch(`${API}/api/v1/me/two-factor/verify`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json', ...origin },
    body: JSON.stringify({ code: OTP }),
  });
  const me = await fetch(`${API}/api/v1/me/workspaces`, { headers: { cookie } });
  const body = await me.json();
  const ws = (body.workspaces ?? []).find((w) => w.orgId === AMAHORO_ORG);
  return { email, cookie, workspaceId: ws?.workspaceId ?? null };
}

async function call(s, method, path, body) {
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers: {
      cookie: s.cookie,
      ...(s.workspaceId ? { 'x-workspace-id': s.workspaceId } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}
const get = (s, p) => call(s, 'GET', p);
const post = (s, p, b = {}) => call(s, 'POST', p, b);
const put = (s, p, b) => call(s, 'PUT', p, b);
const patch = (s, p, b) => call(s, 'PATCH', p, b);
function listPath(path, { q, filters = [], size = 100 } = {}) {
  const params = new URLSearchParams({ size: String(size) });
  if (q) params.set('q', q);
  if (filters.length > 0) params.set('f', JSON.stringify(filters));
  return `${path}?${params}`;
}

/** Upload one file through `POST /ops/hr/files`, the way the screen does: multipart, purpose beside it. */
async function upload(s, purpose, bytes, filename) {
  const form = new FormData();
  form.set('purpose', purpose);
  form.set('file', new Blob([bytes]), filename);
  const res = await fetch(`${API}/api/v1/ops/hr/files`, {
    method: 'POST',
    headers: { cookie: s.cookie, 'x-workspace-id': s.workspaceId },
    body: form,
  });
  if (res.status === 429) {
    // The per person upload budget (30 in 10 minutes, UploadThrottlerGuard) is
    // spent: a run uploads about a dozen files, so two runs back to back fit and
    // three do not. Stop rather than report every later step as a product failure.
    throw new Error(`Upload throttled (429, retry after ${res.headers.get('retry-after') ?? res.headers.get('retry-after-uploads-user')}s): wait and run again.`);
  }
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** Fetch a signed link and answer its bytes. */
async function fetchLink(link) {
  const res = await fetch(link.url);
  return { status: res.status, bytes: Buffer.from(await res.arrayBuffer()) };
}

const stamp = Date.now().toString().slice(-8);
const idNumber = (n) => `11985${stamp}${n}`.slice(0, 16);
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const pdf = (label) => Buffer.from(`%PDF-1.4\n% ${label} ${stamp}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`, 'latin1');

let client = null;
async function sql(text, params = []) {
  if (!DB) return null;
  if (!client) {
    client = new pg.Client({ connectionString: DB });
    await client.connect();
  }
  return (await client.query(text, params)).rows;
}

console.log(`Verifying the people file against ${API}, today ${today} (Kigali)\n`);

const owner = await sessionFor('yves@demo.injishi.com');
const manager = await sessionFor('solange@demo.injishi.com');
const desk = await sessionFor('denise@demo.injishi.com');
const limited = await sessionFor('clarisse@demo.injishi.com');
const housekeeper = await sessionFor('beatha@demo.injishi.com');
if (!owner.workspaceId || !manager.workspaceId || !desk.workspaceId || !limited.workspaceId) {
  throw new Error('The Amahoro roster did not resolve a workspace. Is this a seeded sample database?');
}

// --- Catalogs and settings (AC-PF11, AC-PF12) -------------------------------------------

console.log('The HR catalogs (AC-PF11)');
const typeRes = await post(owner, '/ops/hr/catalog/employee-types', { title: `Casual ${stamp}` });
check('owner adds an employee type: 201', typeRes.status === 201 && typeRes.body?.status === 'active', typeRes);
const tagRes = await post(owner, '/ops/hr/catalog/tags', { title: `First aid ${stamp}`, tone: 'ok' });
check('owner adds a tag with a tone: 201', tagRes.status === 201 && tagRes.body?.tone === 'ok', tagRes);
const tag2Res = await post(owner, '/ops/hr/catalog/tags', { title: `Speaks French ${stamp}` });
check('a tag with no tone is neutral', tag2Res.status === 201 && tag2Res.body?.tone === 'neutral', tag2Res);
const positionRes = await post(owner, '/ops/hr/catalog/job-positions', { title: `Line cook ${stamp}` });
check('owner adds a job position: 201', positionRes.status === 201, positionRes);
const warningRes = await post(owner, '/ops/hr/catalog/disciplinary-types', { title: `Verbal warning ${stamp}`, kind: 'warning' });
const dismissalRes = await post(owner, '/ops/hr/catalog/disciplinary-types', { title: `Dismissal ${stamp}`, kind: 'dismissal' });
check('owner adds a warning and a dismissal type: 201 each', warningRes.status === 201 && dismissalRes.status === 201, [warningRes.status, dismissalRes.status]);
const dupTag = await post(owner, '/ops/hr/catalog/tags', { title: `first AID ${stamp}` });
check('the same tag title again, in other letters: 409', dupTag.status === 409, dupTag);
const noKind = await post(owner, '/ops/hr/catalog/disciplinary-types', { title: `No kind ${stamp}` });
check('a disciplinary type with no kind: 422', noKind.status === 422, noKind);
const toneOnType = await post(owner, '/ops/hr/catalog/employee-types', { title: `Toned ${stamp}`, tone: 'bad' });
check('a tone on an employee type: 422', toneOnType.status === 422, toneOnType);
const managerAdds = await post(manager, '/ops/hr/catalog/tags', { title: `Manager tag ${stamp}` });
check('a manager cannot add to a catalog without people.manage: 403', managerAdds.status === 403, managerAdds.status);
const deskReads = await get(desk, '/ops/hr/catalog/tags');
check('the desk reads a catalog (any HR permission): 200', deskReads.status === 200 && deskReads.body?.items?.some((t) => t.id === tagRes.body?.id), deskReads.status);
const keeperReads = await get(housekeeper, '/ops/hr/catalog/tags');
check('a housekeeper holds no HR permission: 403', keeperReads.status === 403, keeperReads.status);
const badKind = await get(owner, '/ops/hr/catalog/shoe-sizes');
check('a catalog that does not exist: 400', badKind.status === 400, badKind.status);

console.log('\nThe employee number prefix (AC-PF12)');
const setPrefix = await patch(owner, '/ops/hr/settings', { employeeNumberPrefix: 'amh' });
check('owner sets a prefix, upper cased: 200 AMH', setPrefix.status === 200 && setPrefix.body?.employeeNumberPrefix === 'AMH', setPrefix);
const managerPrefix = await patch(manager, '/ops/hr/settings', { employeeNumberPrefix: 'X' });
check('a manager cannot change HR settings: 403', managerPrefix.status === 403, managerPrefix.status);
const badPrefix = await patch(owner, '/ops/hr/settings', { employeeNumberPrefix: 'too long a prefix' });
check('a prefix that is not 1 to 8 capitals, digits or dashes: 400', badPrefix.status === 400, badPrefix.status);

// --- Three cooks on file ---------------------------------------------------------------

const cookBody = (n, name, branch) => ({
  legalName: `${name} Verify ${stamp}`,
  phone: `0788 6${stamp.slice(-2)} 1${n}0`.replace(/ /g, ''),
  dateOfBirth: '1990-02-0' + n,
  sex: n % 2 ? 'female' : 'male',
  idDocumentType: 'national_id',
  idDocumentNumber: idNumber(n),
  hiredOn: addDays(today, -60),
  workPropertyId: branch,
  jobPositionId: positionRes.body?.id,
});
const cookA = (await post(owner, '/ops/employees', cookBody(1, 'Uwase Aline', BOUTIQUE))).body;
const cookB = (await post(owner, '/ops/employees', cookBody(2, 'Habimana Eric', BOUTIQUE))).body;
const cookM = (await post(owner, '/ops/employees', cookBody(3, 'Mukamana Grace', MUSANZE))).body;
check('three cooks on file, numbered with the prefix', [cookA, cookB, cookM].every((c) => /^AMH\d{4,}$/.test(c?.employeeNumber ?? '')), [cookA?.employeeNumber, cookB?.employeeNumber, cookM?.employeeNumber]);
check('a job position is set on create (AC-PF11)', cookA?.jobPositionId === positionRes.body?.id, cookA?.jobPositionId);

// --- The file's new fields (AC-PF1, AC-PF2) ----------------------------------------------

console.log('\nThe file fields (AC-PF1)');
const districts = (await get(owner, '/geography/districts')).body ?? [];
const sectors = (await get(owner, `/geography/sectors?districtId=${districts[0]?.id}`)).body ?? [];
const cells = (await get(owner, `/geography/cells?sectorId=${sectors[0]?.id}`)).body ?? [];
const villages = (await get(owner, `/geography/villages?cellId=${cells[0]?.id}`)).body ?? [];
const village = villages[0];
check('a village from the geography tables to live in', !!village?.id, villages.length);
const fields = {
  maritalStatus: 'married',
  childrenCount: 2,
  villageId: village?.id,
  street: 'KG 11 Ave, house 4',
  emergencyName: 'Uwase Claudine',
  emergencyPhone: '0788 123 999',
  emergencyRelation: 'Sister',
  qualification: 'Diploma in culinary arts',
  priorExperienceYears: 3,
  employeeTypeId: typeRes.body?.id,
  tagIds: [tagRes.body?.id, tag2Res.body?.id],
};
const filled = await patch(owner, `/ops/employees/${cookA?.id}`, fields);
const a = filled.body;
check('owner fills in the file: 200', filled.status === 200, filled);
check('the address reads back with the village names', a?.address?.villageId === village?.id && a?.address?.street === fields.street && !!a?.address?.villageName && !!a?.address?.districtName, a?.address);
check('the emergency contact reads back, its phone in E.164', a?.emergencyContact?.name === fields.emergencyName && a?.emergencyContact?.phone === '+250788123999', a?.emergencyContact);
check('employee type and both tags read back', a?.employeeType?.id === typeRes.body?.id && a?.tags?.length === 2, [a?.employeeType, a?.tags]);
const tooMany = await patch(owner, `/ops/employees/${cookA?.id}`, { childrenCount: 31 });
check('31 children is refused: 400', tooMany.status === 400, tooMany.status);
const tooLong = await patch(owner, `/ops/employees/${cookA?.id}`, { priorExperienceYears: 61 });
check('61 years of experience is refused: 400', tooLong.status === 400, tooLong.status);
const noVillage = await patch(owner, `/ops/employees/${cookA?.id}`, { villageId: 999999999 });
check('a village that does not exist: 422', noVillage.status === 422, noVillage.status);
const badEmergency = await patch(owner, `/ops/employees/${cookA?.id}`, { emergencyPhone: '12345' });
check('an emergency phone that is not Rwandan: 400', badEmergency.status === 400, badEmergency.status);

console.log('\nArchived catalog rows stay where they are (AC-PF11)');
const archiveTag = await patch(owner, `/ops/hr/catalog/tags/${tag2Res.body?.id}`, { status: 'archived' });
check('owner archives a tag: 200 archived', archiveTag.status === 200 && archiveTag.body?.status === 'archived', archiveTag);
const stillOn = await get(owner, `/ops/employees/${cookA?.id}`);
check('the archived tag stays on the file that carries it', stillOn.body?.employee?.tags?.some((t) => t.id === tag2Res.body?.id), stillOn.body?.employee?.tags);
const resend = await patch(owner, `/ops/employees/${cookA?.id}`, { tagIds: [tagRes.body?.id, tag2Res.body?.id] });
check('resending the archived tag on that file is no change: 200', resend.status === 200, resend);
const newTagged = await patch(owner, `/ops/employees/${cookB?.id}`, { tagIds: [tag2Res.body?.id] });
check('the archived tag is not offered to another file: 422', newTagged.status === 422, newTagged);
const reuseTitle = await post(owner, '/ops/hr/catalog/tags', { title: `Speaks French ${stamp}` });
check('an archived title may be used again by a new active tag: 201', reuseTitle.status === 201, reuseTitle.status);
const reactivate = await patch(owner, `/ops/hr/catalog/tags/${tag2Res.body?.id}`, { status: 'active' });
check('bringing the old one back while the name is taken: 409', reactivate.status === 409, reactivate);

console.log('\nWho reads which fields (AC-PF2)');
const basic = (await get(manager, `/ops/employees/${cookA?.id}`)).body?.employee;
check('manager reads the basic view', basic?.view === 'basic', basic?.view);
check('basic carries the work fields: type, tags, qualification, experience, photo flag', basic?.employeeType?.id === typeRes.body?.id && basic?.tags?.length === 2 && basic?.qualification === fields.qualification && basic?.priorExperienceYears === 3 && 'hasPhoto' in basic, basic);
const personal = ['maritalStatus', 'childrenCount', 'address', 'emergencyContact', 'sex', 'dateOfBirth', 'offboardReason', 'serviceFrom', 'previousEmployeeId'];
check('basic carries none of the personal fields', basic && personal.every((k) => !(k in basic)), basic && personal.filter((k) => k in basic));
const full = (await get(owner, `/ops/employees/${cookA?.id}`)).body?.employee;
check('full carries them all', full?.view === 'full' && personal.every((k) => k in full), full && personal.filter((k) => !(k in full)));
const managerCsv = await fetch(`${API}/api/v1/ops/employees/export.csv`, { headers: { cookie: manager.cookie, 'x-workspace-id': manager.workspaceId } });
const managerCsvText = await managerCsv.text();
check('the manager export has the work columns and no address, children or emergency contact', managerCsvText.includes('Employee type') && managerCsvText.includes('Tags') && !managerCsvText.includes('Address') && !managerCsvText.includes('Children') && !managerCsvText.includes('Emergency'), managerCsvText.split('\r\n')[0]);
const ownerCsvText = await (await fetch(`${API}/api/v1/ops/employees/export.csv`, { headers: { cookie: owner.cookie, 'x-workspace-id': owner.workspaceId } })).text();
check('the owner export carries the address line', ownerCsvText.includes('Address') && ownerCsvText.includes(fields.street), ownerCsvText.split('\r\n')[0]);

console.log('\nThe Employees lens filters by type and tag (AC-PF13)');
const byType = await get(manager, listPath('/ops/employees', { filters: [['employeeType', 'eq', typeRes.body?.id]] }));
check('filtered by employee type: only cook A', byType.status === 200 && byType.body?.items?.length === 1 && byType.body.items[0].id === cookA?.id, byType.body?.items?.map((e) => e.legalName));
const byTag = await get(manager, listPath('/ops/employees', { filters: [['tag', 'in', [tagRes.body?.id]]] }));
check('filtered by tag: only cook A', byTag.status === 200 && byTag.body?.items?.length === 1 && byTag.body.items[0].id === cookA?.id, byTag.body?.items?.map((e) => e.legalName));
const notTagged = await get(manager, listPath('/ops/employees', { filters: [['tag', 'isNull']] }));
check('"has no tag" leaves cook A out', notTagged.status === 200 && !notTagged.body?.items?.some((e) => e.id === cookA?.id), notTagged.status);
const groupedByType = await get(manager, `/ops/employees?size=50&g=employeeType`);
check('grouped by employee type, the group carries the type name', groupedByType.status === 200 && groupedByType.body?.groups?.some((g) => g.label === `Casual ${stamp}`), groupedByType.body?.groups);

// --- The photo (AC-PF1) --------------------------------------------------------------------

console.log('\nThe photo (AC-PF1)');
const photoUp = await upload(owner, 'photo', PNG, 'aline.png');
check('owner uploads a PNG as a photo: 201, sniffed as image/png', photoUp.status === 201 && photoUp.body?.mime === 'image/png', photoUp);
const textAsPhoto = await upload(owner, 'photo', Buffer.from('hello, I am not an image'), 'photo.png');
check('a text file named .png is refused by its bytes: 400', textAsPhoto.status === 400, textAsPhoto);
const pdfAsPhoto = await upload(owner, 'photo', pdf('not a photo'), 'photo.jpg');
check('a PDF is not a photo: 400', pdfAsPhoto.status === 400, pdfAsPhoto.status);
const noPurpose = await upload(owner, 'selfie', PNG, 'x.png');
check('an upload with no known purpose: 400', noPurpose.status === 400, noPurpose.status);
const managerUpload = await upload(manager, 'photo', PNG, 'x.png');
check('a manager cannot upload HR files: 403', managerUpload.status === 403, managerUpload.status);
const setPhoto = await put(owner, `/ops/employees/${cookA?.id}/photo`, { objectKey: photoUp.body?.objectKey });
check('owner hangs the photo on the file: 200, hasPhoto', setPhoto.status === 200 && setPhoto.body?.hasPhoto === true, setPhoto);
const docKey = (await upload(owner, 'document', pdf('id copy one'), 'id.pdf')).body?.objectKey;
const wrongKind = await put(owner, `/ops/employees/${cookB?.id}/photo`, { objectKey: docKey });
check('a document is not a photo, whatever the key: 422', wrongKind.status === 422, wrongKind);
const photoLink = await get(manager, `/ops/employees/${cookA?.id}/photo`);
check('the manager reads the photo, a work field: 200, a five minute link', photoLink.status === 200 && photoLink.body?.expiresInSeconds === 300, photoLink);
const photoBytes = photoLink.body?.url ? await fetchLink(photoLink.body) : null;
check('the link answers the same bytes', photoBytes?.status === 200 && photoBytes.bytes.equals(PNG), photoBytes?.status);
const deskPhoto = await get(desk, `/ops/employees/${cookA?.id}/photo`);
check('the desk reads no file, so no photo: 403', deskPhoto.status === 403, deskPhoto.status);
const noPhoto = await get(owner, `/ops/employees/${cookB?.id}/photo`);
check('a file with no photo: 404', noPhoto.status === 404, noPhoto.status);

// --- Pay accounts (AC-PF3) -------------------------------------------------------------------

console.log('\nPay accounts (AC-PF3)');
const bank = await post(owner, `/ops/employees/${cookA?.id}/pay-accounts`, { kind: 'bank', bankName: 'Bank of Kigali', accountNumber: '00040-0123456-78', branchName: 'Remera' });
check('the first account is primary on its own: 201', bank.status === 201 && bank.body?.isPrimary === true, bank);
const momo = await post(owner, `/ops/employees/${cookA?.id}/pay-accounts`, { kind: 'momo', momoPhone: '0788 765 432', makePrimary: true });
check('MoMo made primary: 201, phone in E.164', momo.status === 201 && momo.body?.isPrimary === true && momo.body?.momoPhone === '+250788765432', momo);
const accounts = (await get(owner, `/ops/employees/${cookA?.id}/pay-accounts`)).body?.accounts ?? [];
check('exactly one primary, and it is the MoMo one', accounts.filter((x) => x.isPrimary).length === 1 && accounts.find((x) => x.isPrimary)?.id === momo.body?.id, accounts);
const badMomo = await post(owner, `/ops/employees/${cookA?.id}/pay-accounts`, { kind: 'momo', momoPhone: '+1 415 555 0100' });
check('a MoMo number that is not Rwandan: 422', badMomo.status === 422, badMomo.status);
const badBank = await post(owner, `/ops/employees/${cookA?.id}/pay-accounts`, { kind: 'bank', bankName: 'BK', accountNumber: 'abc' });
check('an account number with letters: 400', badBank.status === 400, badBank.status);
const managerAccounts = await get(manager, `/ops/employees/${cookA?.id}/pay-accounts`);
check('a manager reads no pay account (people.manage or payroll.run): 403', managerAccounts.status === 403, managerAccounts.status);
const retire = await patch(owner, `/ops/pay-accounts/${momo.body?.id}`, { action: 'retire' });
check('retiring the primary: 200, retired and no longer primary', retire.status === 200 && retire.body?.status === 'retired' && retire.body?.isPrimary === false, retire.body);
const retireAgain = await patch(owner, `/ops/pay-accounts/${momo.body?.id}`, { action: 'retire' });
check('retiring it again: 409', retireAgain.status === 409, retireAgain.status);
const backToBank = await patch(owner, `/ops/pay-accounts/${bank.body?.id}`, { action: 'make_primary' });
check('the bank account made primary again: 200', backToBank.status === 200 && backToBank.body?.isPrimary === true, backToBank.body);

// --- Notes (AC-PF6) ---------------------------------------------------------------------------

console.log('\nNotes (AC-PF6)');
const attachment = await upload(owner, 'attachment', pdf('note attachment'), 'note.pdf');
check('owner uploads an attachment: 201', attachment.status === 201, attachment);
const note = await post(owner, `/ops/employees/${cookA?.id}/notes`, { body: 'Asked to move to the morning shift from next month.', fileKeys: [attachment.body?.objectKey] });
check('owner writes a note with the attachment: 201, its author named', note.status === 201 && note.body?.fileKeys?.length === 1 && !!note.body?.authorName, note);
const strangerKey = await post(owner, `/ops/employees/${cookA?.id}/notes`, { body: 'A key nobody uploaded.', fileKeys: ['staff/other-business/forged.pdf'] });
check('a note naming a key this workspace never uploaded: 422', strangerKey.status === 422, strangerKey.status);
const photoAsAttachment = await post(owner, `/ops/employees/${cookA?.id}/notes`, { body: 'The photo as an attachment.', fileKeys: [photoUp.body?.objectKey] });
check('a photo key is not an attachment: 422', photoAsAttachment.status === 422, photoAsAttachment.status);
const notes = await get(owner, `/ops/employees/${cookA?.id}/notes`);
check('owner reads the notes: 200, one note', notes.status === 200 && notes.body?.notes?.length === 1, notes);
const noteLink = await get(owner, `/ops/employees/${cookA?.id}/notes/${note.body?.id}/files/0`);
const noteBytes = noteLink.body?.url ? await fetchLink(noteLink.body) : null;
check('its attachment opens through a link: 200, the same bytes', noteLink.status === 200 && noteBytes?.bytes.equals(pdf('note attachment')), noteLink.status);
const noSuchFile = await get(owner, `/ops/employees/${cookA?.id}/notes/${note.body?.id}/files/3`);
check('an attachment index past the end: 404', noSuchFile.status === 404, noSuchFile.status);
const managerNotes = await get(manager, `/ops/employees/${cookA?.id}/notes`);
check('a manager reads no notes: 403', managerNotes.status === 403, managerNotes.status);

// --- Documents (AC-PF4, AC-PF5) ------------------------------------------------------------------

console.log('\nRequesting a document from three cooks (AC-PF4)');
const request = await post(owner, '/ops/document-requests', { title: `National ID copy ${stamp}`, formats: ['pdf'], maxMb: 2, dueOn: addDays(today, 14), employeeIds: [cookA?.id, cookB?.id, cookM?.id] });
const summary = request.body?.requests?.find((r) => r.title === `National ID copy ${stamp}`);
check('one request, one document per person: three requested', request.status === 201 && summary?.counts?.requested === 3, summary);
const docsA = (await get(owner, `/ops/employees/${cookA?.id}/documents`)).body?.documents ?? [];
const docA = docsA.find((d) => d.requestId === summary?.id);
check("cook A's file shows the requested document, pdf only, 2 MB", docA?.status === 'requested' && docA?.formats?.join() === 'pdf' && docA?.maxMb === 2, docA);
const pngKey = (await upload(owner, 'document', PNG, 'id.png')).body?.objectKey;
const wrongFormat = await post(owner, `/ops/employees/${cookA?.id}/documents`, { documentId: docA?.id, fileKey: pngKey });
check('a PNG for a request that takes PDF only: 422', wrongFormat.status === 422, wrongFormat);
const firstUpload = await post(owner, `/ops/employees/${cookA?.id}/documents`, { documentId: docA?.id, fileKey: docKey });
check('the PDF is accepted: submitted, one version', firstUpload.status === 201 && firstUpload.body?.status === 'submitted' && firstUpload.body?.versions?.length === 1, firstUpload);
const refuse = await post(owner, `/ops/documents/${docA?.id}/decide`, { decision: 'reject', reason: 'The photo page is cut off.' });
check('owner refuses it with a reason: rejected', refuse.status === 200 && refuse.body?.status === 'rejected' && refuse.body?.rejectReason === 'The photo page is cut off.', refuse);
const noReason = await post(owner, `/ops/documents/${docA?.id}/decide`, { decision: 'reject' });
check('a refusal with no reason: 400', noReason.status === 400, noReason.status);
const secondKey = (await upload(owner, 'document', pdf('id copy two'), 'id-2.pdf')).body?.objectKey;
const secondUpload = await post(owner, `/ops/employees/${cookA?.id}/documents`, { documentId: docA?.id, fileKey: secondKey });
check('uploaded again: submitted, two versions, the refused one kept', secondUpload.status === 201 && secondUpload.body?.status === 'submitted' && secondUpload.body?.versions?.length === 2 && secondUpload.body.versions.some((v) => v.status === 'rejected'), secondUpload.body?.versions);
const approve = await post(owner, `/ops/documents/${docA?.id}/decide`, { decision: 'approve' });
check('owner approves it: approved', approve.status === 200 && approve.body?.status === 'approved', approve);
const decideTwice = await post(owner, `/ops/documents/${docA?.id}/decide`, { decision: 'approve' });
check('deciding an approved document again: 409', decideTwice.status === 409, decideTwice.status);
const uploadOnApproved = await post(owner, `/ops/employees/${cookA?.id}/documents`, { documentId: docA?.id, fileKey: secondKey });
check('uploading over an approved document: 409', uploadOnApproved.status === 409, uploadOnApproved.status);
const otherPersonsDoc = await post(owner, `/ops/employees/${cookB?.id}/documents`, { documentId: docA?.id, fileKey: secondKey });
check("uploading to someone else's document through another file: 404", otherPersonsDoc.status === 404, otherPersonsDoc.status);

console.log('\nThe file link (AC-PF4)');
const docLink = await get(owner, `/ops/documents/${docA?.id}/file`);
const docBytes = docLink.body?.url ? await fetchLink(docLink.body) : null;
check('owner opens the newest file: a five minute link to the second PDF', docLink.status === 200 && docLink.body?.expiresInSeconds === 300 && docBytes?.bytes.equals(pdf('id copy two')), docLink.status);
const deskLink = await get(desk, `/ops/documents/${docA?.id}/file`);
check('a receptionist fetching the file link: 403 and no link', deskLink.status === 403 && !deskLink.body?.url, deskLink);
const managerLink = await get(manager, `/ops/documents/${docA?.id}/file`);
check('a manager fetching it: 403', managerLink.status === 403, managerLink.status);

console.log('\nDates, expiry and the reminder (AC-PF5)');
const badDates = await patch(owner, `/ops/documents/${docA?.id}`, { issuedOn: today, expiresOn: addDays(today, -1) });
check('an expiry before the issue date: 422', badDates.status === 422, badDates.status);
const dated = await patch(owner, `/ops/documents/${docA?.id}`, { issuedOn: addDays(today, -700), expiresOn: addDays(today, 20), remindDaysBefore: 30 });
check('expiry in 20 days, reminded 30 days before: 200, not expired', dated.status === 200 && dated.body?.expired === false && dated.body?.remindDaysBefore === 30, dated.body);
const adHocKey = (await upload(owner, 'document', pdf('food handler'), 'food.pdf')).body?.objectKey;
const adHoc = await post(owner, `/ops/employees/${cookB?.id}/documents`, { title: `Food handler certificate ${stamp}`, fileKey: adHocKey, issuedOn: addDays(today, -400), expiresOn: addDays(today, -1), remindDaysBefore: 0 });
check('a document nobody requested, already past expiry: 201, expired in the read', adHoc.status === 201 && adHoc.body?.status === 'submitted' && adHoc.body?.expired === true && adHoc.body?.requestId === null, adHoc.body);
if (DB) {
  const stored = await sql('select status from employee_documents where id = $1', [adHoc.body?.id]);
  check('"expired" is never stored: the row still says submitted', stored?.[0]?.status === 'submitted', stored);
  const env = { ...process.env, DATABASE_URL: DB };
  const runDaily = () => {
    const out = execFileSync(process.execPath, [resolve(here, 'run-hr-daily.mjs')], { cwd: resolve(here, '..'), env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(out.trim().split('\n').pop());
  };
  const expiring = async (id) => (await sql(`select count(*)::int as n from outbox_events where event_type = 'document.expiring' and aggregate_id = $1`, [id]))[0].n;
  const firstRun = runDaily();
  check('the next daily run raises the reminder', firstRun.reminded >= 1 && (await expiring(docA?.id)) === 1, firstRun);
  check('and the past-expiry document with a lead of 0, once', (await expiring(adHoc.body?.id)) === 1, await expiring(adHoc.body?.id));
  runDaily();
  check('a second run the same day raises nothing more', (await expiring(docA?.id)) === 1, await expiring(docA?.id));
  const moved = await patch(owner, `/ops/documents/${docA?.id}`, { expiresOn: addDays(today, 25) });
  const cleared = await sql('select reminded_at from employee_documents where id = $1', [docA?.id]);
  check('moving the expiry clears the reminder', moved.status === 200 && cleared?.[0]?.reminded_at === null, cleared);
  runDaily();
  check('so the new date is reminded once', (await expiring(docA?.id)) === 2, await expiring(docA?.id));
  const viewed = await sql(`select count(*)::int as n from audit_events where event_type = 'hr.document_viewed' and subject_id = $1`, [cookA?.id]);
  check('every file fetch wrote a document_viewed row', viewed?.[0]?.n >= 1, viewed);
  const requested = await sql(`select count(*)::int as n from outbox_events where event_type = 'document.requested' and payload->>'requestId' = $1`, [summary?.id]);
  check('the request wrote document.requested for each person', requested?.[0]?.n === 3, requested);
} else {
  console.log('  SKIP  the daily reminder run and the stored rows (set DATABASE_URL)');
}

console.log('\nThe Documents lens (AC-PF4)');
const lens = await get(owner, '/ops/documents');
check('owner reads every document of the business', lens.status === 200 && [docA?.id, adHoc.body?.id].every((id) => lens.body?.documents?.some((d) => d.id === id)), lens.status);
const approvedOnly = await get(owner, '/ops/documents?status=approved');
check('filtered to approved: none that is not', approvedOnly.status === 200 && approvedOnly.body?.documents?.every((d) => d.status === 'approved') && approvedOnly.body.documents.some((d) => d.id === docA?.id), approvedOnly.status);
const managerLens = await get(manager, '/ops/documents');
check('a manager reads no documents: 403', managerLens.status === 403, managerLens.status);

// --- Policies (AC-PF7) -----------------------------------------------------------------------------

console.log('\nPolicies (AC-PF7)');
const departments = (await get(owner, '/ops/departments')).body;
const department = (departments?.departments ?? departments ?? [])[0];
const policyFile = await upload(owner, 'attachment', pdf('handbook'), 'handbook.pdf');
const policyAll = await post(owner, '/ops/policies', { title: `Uniform rules ${stamp}`, body: 'Name badge on, every shift.', audience: 'all', fileKeys: [policyFile.body?.objectKey] });
check('owner publishes a policy to everyone: 201, published', policyAll.status === 201 && policyAll.body?.status === 'published' && policyAll.body?.audience === 'all', policyAll);
const policyTargeted = await post(owner, '/ops/policies', { title: `Kitchen hygiene ${stamp}`, body: 'Hair covered in the kitchen.', audience: 'targeted', targets: { departmentIds: department ? [department.id] : [], jobPositionIds: [positionRes.body?.id], employeeIds: [cookM?.id] } });
check('a targeted policy keeps its departments, positions and people', policyTargeted.status === 201 && policyTargeted.body?.targets?.jobPositionIds?.[0] === positionRes.body?.id && policyTargeted.body?.targets?.employeeIds?.[0] === cookM?.id, policyTargeted);
const noTargets = await post(owner, '/ops/policies', { title: `Nobody ${stamp}`, body: 'For nobody.', audience: 'targeted', targets: { departmentIds: [], jobPositionIds: [], employeeIds: [] } });
check('targeted at nobody: 400', noTargets.status === 400, noTargets.status);
const foreignPerson = await post(owner, '/ops/policies', { title: `Stranger ${stamp}`, body: 'x', audience: 'targeted', targets: { departmentIds: [], jobPositionIds: [], employeeIds: ['de300000-0000-4000-8000-00000000ffff'] } });
check('naming someone not on file here: 422', foreignPerson.status === 422, foreignPerson.status);
const deskPolicies = await get(desk, '/ops/policies');
check('the desk reads the policies: 200', deskPolicies.status === 200 && deskPolicies.body?.policies?.some((p) => p.id === policyAll.body?.id), deskPolicies.status);
const keeperPolicies = await get(housekeeper, '/ops/policies');
check('a housekeeper: 403', keeperPolicies.status === 403, keeperPolicies.status);
const managerPolicy = await post(manager, '/ops/policies', { title: 'Manager rule', body: 'x', audience: 'all' });
check('a manager cannot publish one: 403', managerPolicy.status === 403, managerPolicy.status);
const policyLink = await get(desk, `/ops/policies/${policyAll.body?.id}/files/0`);
check('its attachment opens for the desk too', policyLink.status === 200 && !!policyLink.body?.url, policyLink.status);
const retarget = await patch(owner, `/ops/policies/${policyTargeted.body?.id}`, { audience: 'all' });
check('changed to everyone: its targets are cleared', retarget.status === 200 && retarget.body?.audience === 'all' && retarget.body?.targets?.employeeIds?.length === 0, retarget.body);
const archivePolicy = await patch(owner, `/ops/policies/${policyAll.body?.id}`, { status: 'archived' });
check('archived, never deleted: 200, still listed', archivePolicy.status === 200 && (await get(owner, '/ops/policies')).body?.policies?.some((p) => p.id === policyAll.body?.id && p.status === 'archived'), archivePolicy.status);

// --- Staff announcements (AC-PF9) ----------------------------------------------------------------

console.log('\nStaff announcements (AC-PF9)');
const announcement = await post(owner, '/ops/staff-announcements', { title: `Staff party ${stamp}`, body: 'Friday at 18:00 in the garden.', audience: 'all', expiresOn: addDays(today, 7), commentsAllowed: false });
check('owner posts one: 201, no views yet, comments off', announcement.status === 201 && announcement.body?.viewCount === 0 && announcement.body?.commentsAllowed === false, announcement);
const pastExpiry = await post(owner, '/ops/staff-announcements', { title: `Too late ${stamp}`, body: 'x', audience: 'all', expiresOn: addDays(today, -1) });
check('one that has already expired: 422', pastExpiry.status === 422, pastExpiry.status);
const deskAnnouncements = await get(desk, '/ops/staff-announcements');
check('the desk reads them: 200', deskAnnouncements.status === 200 && deskAnnouncements.body?.announcements?.some((x) => x.id === announcement.body?.id), deskAnnouncements.status);
await patch(owner, `/ops/staff-announcements/${announcement.body?.id}`, { status: 'archived' });
const republished = await patch(owner, `/ops/staff-announcements/${announcement.body?.id}`, { status: 'published' });
check('archived and published again: 200', republished.status === 200 && republished.body?.status === 'published', republished.status);
if (DB) {
  const published = await sql(`select count(*)::int as n from outbox_events where event_type = 'announcement.published' and aggregate_id = $1`, [announcement.body?.id]);
  check('posting and republishing each wrote announcement.published', published?.[0]?.n === 2, published);
}

// --- Discipline (AC-PF8) ----------------------------------------------------------------------------

console.log('\nDiscipline (AC-PF8)');
const warning = await post(owner, '/ops/disciplinary-actions', { employeeIds: [cookA?.id, cookB?.id], typeId: warningRes.body?.id, description: 'Late three times this week.', startsOn: today });
check('one warning for two people: two rows, no offer to offboard', warning.status === 201 && warning.body?.actions?.length === 2 && warning.body?.offerOffboarding === false, warning.body);
check('each row names only its own person', new Set(warning.body?.actions?.map((x) => x.employee.employeeId)).size === 2, warning.body?.actions);
const disFile = await upload(owner, 'attachment', pdf('dismissal letter'), 'letter.pdf');
const dismissal = await post(owner, '/ops/disciplinary-actions', { employeeIds: [cookB?.id], typeId: dismissalRes.body?.id, description: 'Theft from the store room.', startsOn: today, fileKey: disFile.body?.objectKey });
check('a dismissal offers offboarding, and offboards nobody', dismissal.status === 201 && dismissal.body?.offerOffboarding === true && (await get(owner, `/ops/employees/${cookB?.id}`)).body?.employee?.status === 'active', dismissal.body);
const halfLength = await post(owner, '/ops/disciplinary-actions', { employeeIds: [cookA?.id], typeId: warningRes.body?.id, description: 'Suspended.', startsOn: today, unit: 'days' });
check('a unit with no length: 400', halfLength.status === 400, halfLength.status);
await patch(owner, `/ops/hr/catalog/disciplinary-types/${warningRes.body?.id}`, { status: 'archived' });
const archivedType = await post(owner, '/ops/disciplinary-actions', { employeeIds: [cookA?.id], typeId: warningRes.body?.id, description: 'Under an archived type.', startsOn: today });
check('recording under an archived type: 422', archivedType.status === 422, archivedType.status);
const kindChange = await patch(owner, `/ops/hr/catalog/disciplinary-types/${warningRes.body?.id}`, { kind: 'suspension' });
check("a used type's kind cannot change: 409", kindChange.status === 409, kindChange.status);
const aOnly = await get(owner, `/ops/disciplinary-actions?employeeId=${cookA?.id}`);
check("one person's records: only theirs", aOnly.status === 200 && aOnly.body?.actions?.length === 1 && aOnly.body.actions[0].employee.employeeId === cookA?.id, aOnly.body?.actions?.length);
const managerDiscipline = await get(manager, '/ops/disciplinary-actions');
check('a manager reads no discipline: 403', managerDiscipline.status === 403, managerDiscipline.status);
const letter = dismissal.body?.actions?.[0];
const letterLink = await get(owner, `/ops/disciplinary-actions/${letter?.id}/file`);
check("the record's attachment opens for the owner", letterLink.status === 200 && letter?.hasFile === true, letterLink.status);

// --- The org chart (AC-PF10) --------------------------------------------------------------------------

console.log('\nThe org chart (AC-PF10)');
await patch(owner, `/ops/employees/${cookB?.id}`, { reportingManagerId: cookA?.id });
const chart = await get(manager, '/ops/org-chart');
const node = (id) => chart.body?.nodes?.find((n) => n.employeeId === id);
check('the manager draws it: 200', chart.status === 200, chart.status);
check('cook B reports to cook A, and cook A is a root', node(cookB?.id)?.reportingManagerId === cookA?.id && node(cookA?.id)?.reportingManagerId === null, [node(cookA?.id), node(cookB?.id)]);
check('roster card fields only, with the photo flag', node(cookA?.id)?.hasPhoto === true && !('idDocumentNumber' in (node(cookA?.id) ?? {})), node(cookA?.id));
const deskChart = await get(desk, '/ops/org-chart');
check('the desk: 403', deskChart.status === 403, deskChart.status);

// --- Branch limits (AC-PF15) ------------------------------------------------------------------------

console.log('\nBranch limits on every new read (AC-PF15)');
const roles = (await get(owner, '/ops/roles')).body;
const receptionist = (roles?.roles ?? []).find((r) => r.orgRole === 'receptionist');
const before = receptionist?.permissions ?? [];
const granted = await put(owner, '/ops/roles/receptionist', { permissions: [...new Set([...before, 'people.manage'])] });
check('the owner grants people.manage to receptionists (ADR-055)', granted.status === 200, granted.status);
try {
  const outside = await get(limited, `/ops/employees/${cookA?.id}/documents`);
  check('a Musanze receptionist reading a Boutique cook\'s documents: 404', outside.status === 404, outside.status);
  const inside = await get(limited, `/ops/employees/${cookM?.id}/documents`);
  check('the Musanze cook\'s: 200', inside.status === 200 && inside.body?.documents?.length === 1, inside.status);
  const notesOutside = await get(limited, `/ops/employees/${cookA?.id}/notes`);
  const accountsOutside = await get(limited, `/ops/employees/${cookA?.id}/pay-accounts`);
  const linkOutside = await get(limited, `/ops/documents/${docA?.id}/file`);
  const photoOutside = await get(limited, `/ops/employees/${cookA?.id}/photo`);
  check('notes, pay accounts, a file link and a photo outside her branch: 404 each', [notesOutside, accountsOutside, linkOutside, photoOutside].every((r) => r.status === 404), [notesOutside, accountsOutside, linkOutside, photoOutside].map((r) => r.status));
  const herLens = await get(limited, '/ops/documents');
  // Against every Boutique file the owner can see, so a rerun's leftovers count too.
  const boutique = new Set(((await get(owner, listPath('/ops/employees', { filters: [['branch', 'eq', BOUTIQUE]] }))).body?.items ?? []).map((e) => e.id));
  check('her Documents lens holds the Musanze cook and nobody from the Boutique', herLens.status === 200 && herLens.body?.documents?.some((d) => d.employee.employeeId === cookM?.id) && boutique.size > 0 && !herLens.body.documents.some((d) => boutique.has(d.employee.employeeId)), herLens.body?.documents?.map((d) => d.employee.displayName));
  const herRequests = await get(limited, '/ops/document-requests');
  const herSummary = herRequests.body?.requests?.find((r) => r.id === summary?.id);
  check('a request counts only her branch\'s documents', herSummary && Object.values(herSummary.counts).reduce((x, y) => x + y, 0) === 1, herSummary?.counts);
  const herDiscipline = await get(limited, '/ops/disciplinary-actions');
  check('her discipline list holds nobody from the Boutique', herDiscipline.status === 200 && !herDiscipline.body?.actions?.some((x) => [cookA?.id, cookB?.id].includes(x.employee.employeeId)), herDiscipline.status);
  const herChart = await get(limited, '/ops/org-chart');
  check('her org chart is the Musanze people only', herChart.status === 200 && herChart.body?.nodes?.every((n) => n.employeeId !== cookA?.id && n.employeeId !== cookB?.id), herChart.body?.nodes?.length);
  const requestOutside = await post(limited, '/ops/document-requests', { title: `Outside ${stamp}`, formats: ['pdf'], maxMb: 1, employeeIds: [cookA?.id] });
  check('requesting a document from a Boutique cook: 403 in words', requestOutside.status === 403, requestOutside);
  const disciplineOutside = await get(limited, `/ops/disciplinary-actions?employeeId=${cookA?.id}`);
  check("naming a Boutique cook's discipline: 404", disciplineOutside.status === 404, disciplineOutside.status);
} finally {
  const restored = await put(owner, '/ops/roles/receptionist', { permissions: before });
  check('the receptionist role is put back', restored.status === 200, restored.status);
}

// --- Rehire (AC-PF14) ------------------------------------------------------------------------------

console.log('\nA leaver comes back (AC-PF14)');
const left = await post(owner, `/ops/employees/${cookM?.id}/offboard`, { lastDay: today, reason: 'Moved to Kigali' });
check('cook M leaves: offboarded', left.status === 200 && left.body?.status === 'offboarded', left.status);
const leaverReason = (await get(manager, `/ops/employees/${cookM?.id}`)).body?.employee;
check('the leaving reason is a full view field: the manager does not see it', leaverReason && !('offboardReason' in leaverReason), leaverReason && Object.keys(leaverReason));
const noDocForLeaver = await post(owner, '/ops/document-requests', { title: `For a leaver ${stamp}`, formats: ['pdf'], maxMb: 1, employeeIds: [cookM?.id] });
check('no document is requested from someone who has left: 409', noDocForLeaver.status === 409, noDocForLeaver.status);
const again = await post(owner, '/ops/employees', { ...cookBody(3, 'Mukamana Grace', BOUTIQUE), legalName: `Mukamana Grace Verify ${stamp}` });
check('the same ID again: 409 rehire_available, naming the old file', again.status === 409 && again.body?.code === 'rehire_available' && again.body?.employeeId === cookM?.id, again.body);
const rehired = await post(owner, '/ops/employees', { ...cookBody(3, 'Mukamana Grace', BOUTIQUE), rehireOf: cookM?.id });
check('sent again with rehireOf: 201, a new file and a new number naming the old one', rehired.status === 201 && rehired.body?.id !== cookM?.id && rehired.body?.employeeNumber !== cookM?.employeeNumber && rehired.body?.previousEmployeeId === cookM?.id, rehired.body);
check('service counts from the new hire date until credited', rehired.body?.serviceFrom === rehired.body?.hiredOn, rehired.body?.serviceFrom);
const credited = await patch(owner, `/ops/employees/${rehired.body?.id}`, { serviceFrom: addDays(today, -900) });
check('people.manage credits the old service: 200', credited.status === 200 && credited.body?.serviceFrom === addDays(today, -900), credited.body?.serviceFrom);
const afterHire = await patch(owner, `/ops/employees/${rehired.body?.id}`, { serviceFrom: addDays(today, 30) });
check('service cannot start after the hire date: 422', afterHire.status === 422, afterHire.status);

// --- The prefix never renames (AC-PF12) ----------------------------------------------------------------

const cleared = await patch(owner, '/ops/hr/settings', { employeeNumberPrefix: null });
const stillPrefixed = (await get(owner, `/ops/employees/${cookA?.id}`)).body?.employee?.employeeNumber;
check('clearing the prefix renames no issued number', cleared.status === 200 && cleared.body?.employeeNumberPrefix === null && stillPrefixed === cookA?.employeeNumber, stillPrefixed);

// --- A Team invitation accepted is a file (058-self-service AC-J2) ---------------------------------------

if (DB) {
  console.log('\nAccepting a Team invitation writes a thin file (AC-J2)');
  const email = `pf-joiner-${stamp}@example.com`;
  const invite = await post(owner, '/ops/team/invitations', { email, orgRole: 'receptionist' });
  check('owner invites a receptionist: 201', invite.status === 201, invite.status);
  const token = (await sql('select token from org_invitations where lower(email) = $1 order by created_at desc limit 1', [email]))?.[0]?.token;
  const joiner = await sessionFor(email);
  const accepted = await call(joiner, 'POST', `/orgs/${AMAHORO_ORG}/staff-invitation/accept`, { token });
  check('the invitee accepts: 200', accepted.status === 200, accepted);
  const thin = (await get(owner, listPath('/ops/employees', { q: `pf-joiner-${stamp}` }))).body?.items?.[0];
  check('a thin file exists for them: active, an account, hired today, details missing', thin?.status === 'active' && thin?.hasAccount === true && thin?.hiredOn === today && thin?.detailsMissing?.length > 0, thin);
} else {
  console.log('\n  SKIP  the invitation acceptance (set DATABASE_URL to read the token)');
}

// --- Audit (AC-PF1, AC-PF3, AC-PF6) -------------------------------------------------------------------

if (DB) {
  console.log('\nAudit rows');
  const rows = await sql(`select event_type, payload_diff::text as diff from audit_events where subject_id = $1 order by occurred_at`, [cookA?.id]);
  const update = rows.find((r) => r.event_type === 'hr.employee_updated' && r.diff.includes('maritalStatus'));
  check('the file update wrote personal values as "changed"', update && update.diff.includes('"maritalStatus": "changed"') && !update.diff.includes('married') && !update.diff.includes('Claudine'), update?.diff);
  check('no audit row carries an account number or a MoMo number', rows.every((r) => !r.diff.includes('0123456') && !r.diff.includes('788765432')), '');
  check('reading the notes wrote notes_viewed', rows.some((r) => r.event_type === 'hr.notes_viewed'), rows.map((r) => r.event_type));
  const swaps = await sql(`select count(*)::int as n from outbox_events where event_type = 'pay_account.changed' and aggregate_id = $1`, [cookA?.id]);
  check('every change of primary account wrote pay_account.changed (AC-PF3)', swaps?.[0]?.n >= 3, swaps);
} else {
  console.log('\n  SKIP  audit rows (set DATABASE_URL to read them)');
}

if (client) await client.end();
console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
