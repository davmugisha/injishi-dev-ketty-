/**
 * owner.*: what the owner's screens read that the world does not already hold.
 *
 *   branch codes      ISG, ISH, KCR on the three branches (owner.settingsBusinessBranches); the Reports
 *                     filter, the members' scopes and the Policies switcher key on them
 *   team              Jacques Mugabo's open invitation to Ishyamba and Emmanuel Nkusi's revoked access
 *                     (owner.teamRolesMembers). The active members are the world's eleven plus Solange.
 *   saved views       the owner's four Reports views (owner.reportsSavedViews), list key `owner.reports`
 *   licences          the seven documents on file (owner.complianceLicences), as `org_certificates`
 *
 * Grace Uwera is "pending" (a manager-requested invite) in the fixture, but she is the finance persona
 * and must sign in, so the world keeps her an active member; the platform has no requested-invite state.
 *
 * Everything this writes for the two Amahoro orgs converges: invitations, saved views, certificates and
 * role permission overrides that a demo day or a verify flow made are removed on the next seed. Emails
 * of people who are not personas live at @app.demo.injishi.com, as every interface seed address does.
 */
import { createHash } from 'node:crypto';

import { day, iid, kigaliAt, parseFixtureDate, shiftDate, userId } from './lib.mjs';
import { ORG, PROPERTY } from './world.mjs';

const ORG_SCOPE = { column: 'org_id', values: [ORG.hotel, ORG.residences] };

/** The interface's role ids, in the platform's org roles. */
const ORG_ROLE = {
  owner: 'owner',
  manager: 'manager',
  frontdesk: 'receptionist',
  staff: 'housekeeper',
  finance: 'finance',
  hr: 'hr',
};

/** Scope ids (branch codes, lower case) to the branches they name. */
const BRANCH = { isg: PROPERTY.isangano, ish: PROPERTY.ishyamba, kcr: PROPERTY.kacyiru };

/** A fixture contact address, moved into the demo domain so no real inbox is ever written to. */
function demoEmail(contact) {
  const local = String(contact).split('@')[0].toLowerCase().replace(/[^a-z0-9.]+/g, '.');
  return `${local}@app.demo.injishi.com`;
}

/** "Invited 10 Oct · link expires 17 Oct" → the day it was sent. */
function invitedOn(text) {
  const m = String(text).match(/Invited (\d{1,2} [A-Z][a-z]{2})/);
  if (!m) throw new Error(`owner.teamRolesMembers: no invite date in "${text}"`);
  return shiftDate(parseFixtureDate(m[1]));
}

/** "Revoked 30 Sep by you · left the business" → the day access ended. */
function revokedOn(text) {
  const m = String(text).match(/Revoked (\d{1,2} [A-Z][a-z]{2})/);
  if (!m) throw new Error(`owner.teamRolesMembers: no revoke date in "${text}"`);
  return shiftDate(parseFixtureDate(m[1]));
}

/** The instant 10:00 Kigali on a calendar day. */
const tenAm = (iso) => new Date(`${iso}T10:00:00+02:00`);

async function seedBranchCodes({ c, fx, log }) {
  for (const b of fx('owner.settingsBusinessBranches')) {
    const propertyId = BRANCH[b.id];
    if (!propertyId) continue; // the standalone outlet is the outlets area's, not a branch
    await c.query('UPDATE properties SET branch_code = $2 WHERE id = $1', [propertyId, b.code]);
  }
  log('owner: branch codes ISG, ISH, KCR');
}

async function seedTeam({ c, fx, log, keep }) {
  const invitations = [];
  let revoked = 0;
  for (const m of fx('owner.teamRolesMembers')) {
    const role = ORG_ROLE[m.role];
    if (m.status === 'invited') {
      if (!role || role === 'owner') throw new Error(`owner.teamRolesMembers ${m.id}: cannot invite into "${m.role}"`);
      const id = iid('invitation', `amahoro-hospitality:${m.id}`);
      const sent = tenAm(invitedOn(m.lastActive));
      const branches = m.scopeIds.map((s) => BRANCH[s]).filter(Boolean);
      await c.query(
        `INSERT INTO org_invitations
           (id, org_id, email, org_role, purpose, token, status, expires_at, branch_property_ids, invitee_name,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'staff', $5, 'sent', $6, $7, $8, $9, $9)
         ON CONFLICT (id) DO UPDATE SET status = 'sent', expires_at = EXCLUDED.expires_at,
           org_role = EXCLUDED.org_role, branch_property_ids = EXCLUDED.branch_property_ids,
           invitee_name = EXCLUDED.invitee_name, created_at = EXCLUDED.created_at`,
        [id, ORG.hotel, demoEmail(m.contact), role,
          // A token nobody holds: the demo invitation is listed, never accepted.
          createHash('sha256').update(`interface-seed:${id}`).digest('hex'),
          new Date(sent.getTime() + 7 * 86_400_000), branches.length ? branches : null, m.name, sent],
      );
      invitations.push(id);
    } else if (m.status === 'revoked') {
      // Somebody who had access and no longer has it: a person, and a removed membership that keeps
      // the history their posts and charges still point at.
      const uid = iid('user', `member:${m.id}`);
      await c.query(
        `INSERT INTO users (id, email, email_verified, name) VALUES ($1, $2, true, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [uid, demoEmail(`${m.name.toLowerCase().replace(/\s+/g, '.')}@x`), m.name],
      );
      const membershipId = iid('membership', `${ORG.hotel}:member:${m.id}`);
      const removedAt = new Date(`${revokedOn(m.lastActive)}T17:00:00+02:00`);
      await c.query(
        `INSERT INTO org_memberships (id, org_id, user_id, org_role, status, removed_at, created_at)
         VALUES ($1, $2, $3, $4, 'removed', $5, $6)
         ON CONFLICT (id) DO UPDATE SET status = 'removed', removed_at = EXCLUDED.removed_at,
           org_role = EXCLUDED.org_role`,
        [membershipId, ORG.hotel, uid, role, removedAt, new Date(removedAt.getTime() - 400 * 86_400_000)],
      );
      // The branches they were limited to while they worked here, kept as the history they are.
      for (const propertyId of m.scopeIds.map((s) => BRANCH[s]).filter(Boolean)) {
        await c.query(
          `INSERT INTO org_membership_branches (org_membership_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [membershipId, propertyId],
        );
      }
      revoked++;
    }
  }
  keep('org_invitations', invitations, ORG_SCOPE);
  // No role departs from the platform's defaults in the fixture: an owner's change made on a demo day goes.
  keep('org_role_permissions', [], ORG_SCOPE);
  log(`owner: ${invitations.length} open invitation(s), ${revoked} revoked member(s)`);
}

async function seedSavedViews({ c, fx, log, keep }) {
  const owner = userId('owner');
  const ids = [];
  for (const [i, v] of fx('owner.reportsSavedViews').entries()) {
    const id = iid('saved-view', `owner.reports:${v.id}`);
    const config = {
      filters: [
        { field: 'tab', op: 'eq', value: v.tab },
        { field: 'property', op: 'eq', value: v.property },
      ],
      sort: [],
      pageSize: 25,
      view: 'list',
    };
    await c.query(
      `INSERT INTO list_saved_views (id, org_id, user_id, list_key, name, config, shared, is_default, created_at, updated_at)
       VALUES ($1, $2, $3, 'owner.reports', $4, $5, false, $6, $7, $7)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, config = EXCLUDED.config,
         is_default = EXCLUDED.is_default, updated_at = EXCLUDED.updated_at`,
      // Created a minute apart so the list keeps the fixture's order.
      [id, ORG.hotel, owner, v.label, JSON.stringify(config), i === 0, kigaliAt(`08:0${i}`, -30)],
    );
    ids.push(id);
  }
  keep('list_saved_views', ids, ORG_SCOPE);
  log(`owner: ${ids.length} saved Reports views for Didier Mugenzi`);
}

/** The document kind a fixture licence is, in `org_certificate_kind` (an EAC grade is "other", named). */
function kindOf(name) {
  if (/^Tourism operating licence/.test(name)) return { kind: 'tourism_license', other: null };
  if (/^Accommodation class/.test(name)) return { kind: 'rdb_grade', other: null };
  if (/^Fire safety/.test(name)) return { kind: 'fire_safety', other: null };
  if (/^EAC grade/.test(name)) return { kind: 'other', other: 'EAC grade' };
  if (/^Certificate of incorporation/.test(name)) return { kind: 'other', other: 'Certificate of incorporation' };
  throw new Error(`owner.complianceLicences: no document kind for "${name}"`);
}

const PROPERTY_BY_NAME = {
  'Isangano Lakeside Hotel': PROPERTY.isangano,
  'Ishyamba Forest Lodge': PROPERTY.ishyamba,
  'Kacyiru Court Residences': PROPERTY.kacyiru,
};

/** "Review Jun 2027" → the grading's review month, on the day it was graded. */
function reviewDate(expiry, issuedOn) {
  const m = String(expiry).match(/^Review ([A-Z][a-z]{2}) (\d{4})$/);
  if (!m) return null;
  const graded = issuedOn ? Number(issuedOn.slice(8, 10)) : 1;
  return parseFixtureDate(`${graded} ${m[1]} ${m[2]}`);
}

async function seedLicences({ c, fx, log, keep }) {
  const ids = [];
  for (const l of fx('owner.complianceLicences')) {
    const { kind, other } = kindOf(l.name);
    const propertyId = PROPERTY_BY_NAME[l.holder] ?? null;
    const requested = /^Waiting/.test(l.status);
    const graded = l.left.match(/^Graded (\d{1,2} [A-Z][a-z]{2} \d{4})$/)?.[1];
    const registered = l.left.match(/^Registered (\d{4})$/)?.[1];
    // The fixture gives an incorporation's year only; the first of January stands for it.
    const issuedOn = graded ? parseFixtureDate(graded) : registered ? `${registered}-01-01` : null;
    const expiresOn = /^\d{1,2} [A-Z][a-z]{2} \d{4}$/.test(l.expiry)
      ? shiftDate(parseFixtureDate(l.expiry))
      : reviewDate(l.expiry, issuedOn);
    // "34 days · renewal in draft": what is still open about the document.
    const followUp = l.left.includes(' · ') ? l.left.split(' · ').slice(1).join(' · ') : null;
    const requestedOn = l.left.match(/requested (\d{1,2} [A-Z][a-z]{2})/)?.[1];
    const created = requestedOn ? tenAm(shiftDate(parseFixtureDate(requestedOn))) : tenAm(day(-200));
    const id = iid('certificate', `amahoro-hospitality:${l.id}`);
    await c.query(
      `INSERT INTO org_certificates
         (id, org_id, kind, kind_other, certificate_number, issued_by, issued_on, expires_on, property_id, status,
          follow_up, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, kind_other = EXCLUDED.kind_other,
         certificate_number = EXCLUDED.certificate_number, issued_by = EXCLUDED.issued_by,
         issued_on = EXCLUDED.issued_on, expires_on = EXCLUDED.expires_on, property_id = EXCLUDED.property_id,
         status = EXCLUDED.status, follow_up = EXCLUDED.follow_up, created_at = EXCLUDED.created_at`,
      [id, ORG.hotel, kind, other, l.ref === '—' ? null : l.ref, l.issuer, issuedOn, expiresOn, propertyId,
        requested ? 'requested' : 'on_file', followUp, created],
    );
    ids.push(id);
  }
  keep('org_certificates', ids, ORG_SCOPE);
  log(`owner: ${ids.length} licences and registrations on file`);
}

export async function seed(ctx) {
  await seedBranchCodes(ctx);
  await seedTeam(ctx);
  await seedSavedViews(ctx);
  await seedLicences(ctx);
}
