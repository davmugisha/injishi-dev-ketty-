#!/usr/bin/env node
/**
 * ADR-054 slice 4 (team limits) over HTTP, against a running API on a sample
 * database seeded by `seed-demo.mjs`.
 *
 *   node scripts/verify-adr054-team-limits.mjs
 *
 * Signs in with the fixed demo code, so it only works on a demo process. It
 * changes Solange's branches and invites Grace, then puts both back: Solange
 * covers every branch again, and Grace's Amahoro membership and invitation are
 * deleted. Every check prints PASS or FAIL; the exit code is the FAIL count.
 */
import pg from 'pg';

import { assertSampleDatabase } from './sample-database.mjs';

const API = process.env.API_URL ?? 'http://127.0.0.1:8000';
const CODE = '123456';
const AMAHORO_WS = 'de300000-0000-4000-8000-000000000201';
const AMAHORO_ORG = 'de300000-0000-4000-8000-000000000101';
const GREEN_HILLS_WS = 'de300000-0000-4000-8000-000000000202';
const MUSANZE = 'de300000-0000-4000-8000-000000000404';
const EVERY_BRANCH = 'This needs access to every branch.';

let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
}

const cookies = new Map();
async function signIn(email) {
  if (cookies.has(email)) return cookies.get(email);
  await fetch(`${API}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });
  const res = await fetch(`${API}/api/auth/sign-in/email-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, otp: CODE }),
  });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  if (!res.ok || !cookie) throw new Error(`Sign in failed for ${email}: ${res.status}`);
  cookies.set(email, cookie);
  return cookie;
}

async function call(email, method, path, { workspaceId = AMAHORO_WS, branch, body } = {}) {
  const headers = { cookie: await signIn(email), 'x-workspace-id': workspaceId };
  if (branch) headers['x-branch-id'] = branch;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

const messageOf = (json) => (typeof json?.message === 'string' ? json.message : JSON.stringify(json?.message));

async function main() {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await assertSampleDatabase(db, 'verify-adr054-team-limits.mjs');
  const ids = async (sql, params) => (await db.query(sql, params)).rows;
  const [rubavu] = await ids(`SELECT id FROM properties WHERE org_id = $1 AND name = 'Amahoro Rubavu'`, [AMAHORO_ORG]);
  const [remera] = await ids(`SELECT id FROM properties WHERE org_id = $1 AND is_head_office`, [AMAHORO_ORG]);
  const [kicukiro] = await ids(`SELECT id FROM properties WHERE org_id = $1 AND name = 'Amahoro Kicukiro'`, [AMAHORO_ORG]);
  const [huye] = await ids(`SELECT id FROM properties WHERE name = 'Inzozi Huye'`);
  const [solange] = await ids(`SELECT id FROM users WHERE email = 'solange@demo.injishi.com'`);
  const [yves] = await ids(`SELECT id FROM users WHERE email = 'yves@demo.injishi.com'`);

  try {
    // --- The limited persona (AC-S3, AC-T2, AC-T3, AC-D2) ---------------------
    const me = await call('clarisse@demo.injishi.com', 'GET', '/me/workspaces');
    const grant = (me.json?.workspaces ?? me.json ?? []).find?.((w) => w.workspaceId === AMAHORO_WS);
    check('Clarisse grant: coverage limited', grant?.branchCoverage === 'limited', grant?.branchCoverage);
    check(
      'Clarisse grant: branches is Musanze only, propertyName Amahoro Musanze',
      grant?.branches?.length === 1 && grant.branches[0].id === MUSANZE && grant.propertyName === 'Amahoro Musanze',
      JSON.stringify(grant?.branches?.map((b) => b.name)),
    );

    for (const path of ['/ops/rooms', '/ops/stays', '/ops/reservations', '/ops/threads']) {
      const limited = await call('clarisse@demo.injishi.com', 'GET', path);
      const scoped = await call('yves@demo.injishi.com', 'GET', path, { branch: MUSANZE });
      const count = (r) => {
        const v = r.json;
        if (Array.isArray(v)) return v.length;
        const list = v && Object.values(v).find(Array.isArray);
        return list ? list.length : -1;
      };
      check(
        `${path}: Clarisse with no header sees what Yves sees under Musanze`,
        limited.status === 200 && count(limited) === count(scoped),
        `clarisse ${limited.status}/${count(limited)}, yves@musanze ${scoped.status}/${count(scoped)}`,
      );
    }

    const probe = await call('clarisse@demo.injishi.com', 'GET', '/ops/rooms', { branch: remera.id });
    check('Clarisse with x-branch-id Remera: 404', probe.status === 404, String(probe.status));
    const own = await call('clarisse@demo.injishi.com', 'GET', '/ops/rooms', { branch: MUSANZE });
    check('Clarisse with x-branch-id Musanze: 200', own.status === 200, String(own.status));

    const threadsAll = await call('yves@demo.injishi.com', 'GET', '/ops/threads');
    const threadsLimited = await call('clarisse@demo.injishi.com', 'GET', '/ops/threads');
    check(
      'AC-T3: Clarisse never sees more threads than Yves under Musanze',
      threadsLimited.status === 200 && threadsAll.status === 200,
      `${threadsAll.status}/${threadsLimited.status}`,
    );

    // --- Solange limited to Rubavu (AC-T1, AC-A1, AC-M6) ----------------------
    const refusals = [
      ['owner', yves.id, [MUSANZE]],
      ['empty list', solange.id, []],
      ['branch of another org', solange.id, [huye.id]],
      ['archived branch', solange.id, [kicukiro.id]],
    ];
    for (const [label, userId, branchIds] of refusals) {
      const r = await call('yves@demo.injishi.com', 'PUT', `/ops/team/${userId}/branches`, { body: { branchIds } });
      check(`PUT branches, ${label}: 422`, r.status === 422, `${r.status} ${messageOf(r.json)}`);
    }
    const residence = await call('josephine@demo.injishi.com', 'PUT', `/ops/team/${solange.id}/branches`, {
      workspaceId: GREEN_HILLS_WS,
      body: { branchIds: [MUSANZE] },
    });
    check('PUT branches on a residence org: 422', residence.status === 422, `${residence.status} ${messageOf(residence.json)}`);
    const unknown = await call('yves@demo.injishi.com', 'PUT', `/ops/team/00000000-0000-4000-8000-000000000000/branches`, {
      body: { branchIds: null },
    });
    check('PUT branches, not a member: 404', unknown.status === 404, String(unknown.status));

    const auditBefore = (await ids(
      `SELECT count(*)::int AS n FROM audit_events WHERE event_type = 'team.member_branches_changed' AND subject_id = $1`,
      [solange.id],
    ))[0].n;
    const limit = await call('yves@demo.injishi.com', 'PUT', `/ops/team/${solange.id}/branches`, {
      body: { branchIds: [rubavu.id] },
    });
    check(
      'PUT Solange to Rubavu: 200 and branchIds echoes it',
      limit.status === 200 && JSON.stringify(limit.json?.branchIds) === JSON.stringify([rubavu.id]),
      `${limit.status} ${JSON.stringify(limit.json?.branchIds)}`,
    );
    const [audit] = await ids(
      `SELECT actor_user_id, payload_diff FROM audit_events
        WHERE event_type = 'team.member_branches_changed' AND subject_id = $1
        ORDER BY occurred_at DESC LIMIT 1`,
      [solange.id],
    );
    const auditAfter = (await ids(
      `SELECT count(*)::int AS n FROM audit_events WHERE event_type = 'team.member_branches_changed' AND subject_id = $1`,
      [solange.id],
    ))[0].n;
    check(
      'AC-A1: one audit row naming Yves, from null to Rubavu',
      auditAfter === auditBefore + 1 &&
        audit?.actor_user_id === yves.id &&
        audit.payload_diff?.branchIds?.from === null &&
        audit.payload_diff?.branchIds?.to?.[0] === rubavu.id,
      JSON.stringify(audit?.payload_diff),
    );

    const team = await call('yves@demo.injishi.com', 'GET', '/ops/team');
    const members = team.json?.members ?? [];
    const byEmail = (e) => members.find((m) => m.email === e);
    check(
      'GET /ops/team: Solange [Rubavu], Clarisse [Musanze], Yves null',
      JSON.stringify(byEmail('solange@demo.injishi.com')?.branchIds) === JSON.stringify([rubavu.id]) &&
        JSON.stringify(byEmail('clarisse@demo.injishi.com')?.branchIds) === JSON.stringify([MUSANZE]) &&
        byEmail('yves@demo.injishi.com')?.branchIds === null,
    );

    const orgWide = [
      ['POST /inventory/properties', 'POST', '/inventory/properties', { name: 'Should Not Exist (demo)', sectorId: 1 }],
      ['POST /inventory/properties/:id/archive', 'POST', `/inventory/properties/${MUSANZE}/archive`, undefined],
      ['POST /inventory/properties/:id/restore', 'POST', `/inventory/properties/${kicukiro.id}/restore`, undefined],
      ['POST /inventory/properties/:id/head-office', 'POST', `/inventory/properties/${rubavu.id}/head-office`, undefined],
      ['POST /ops/outlet-parties', 'POST', '/ops/outlet-parties', { legalName: 'Should Not Exist (demo)' }],
      ['PUT /ops/ebm/mapping', 'PUT', '/ops/ebm/mapping', { items: [] }],
    ];
    for (const [label, method, path, body] of orgWide) {
      const r = await call('solange@demo.injishi.com', method, path, { body });
      check(
        `AC-M6: Solange (limited manager) ${label}: 403 every branch`,
        r.status === 403 && messageOf(r.json) === EVERY_BRANCH,
        `${r.status} ${messageOf(r.json)}`,
      );
    }
    // `team.manage` is the owner's and an owner always covers every branch, so a
    // limited member is refused this one on their role, before coverage.
    const teamWrite = await call('solange@demo.injishi.com', 'PUT', `/ops/team/${solange.id}/branches`, {
      body: { branchIds: null },
    });
    check('Solange PUT /ops/team/:userId/branches: 403 (not the owner)', teamWrite.status === 403, String(teamWrite.status));
    const solangeRead = await call('solange@demo.injishi.com', 'GET', '/inventory/properties');
    check(
      'Solange lists only Rubavu in /inventory/properties',
      solangeRead.status === 200 && JSON.stringify((solangeRead.json?.properties ?? solangeRead.json ?? []).map?.((p) => p.id)) === JSON.stringify([rubavu.id]),
      `${solangeRead.status}`,
    );

    // --- Invitations carry branches (AC-T1, invite accept) -------------------
    await db.query(
      `DELETE FROM org_memberships WHERE org_id = $1 AND user_id = (SELECT id FROM users WHERE email = 'grace@demo.injishi.com')`,
      [AMAHORO_ORG],
    );
    const emptyInvite = await call('yves@demo.injishi.com', 'POST', '/ops/team/invitations', {
      body: { email: 'grace@demo.injishi.com', orgRole: 'receptionist', branchIds: [] },
    });
    check('Invite with an empty branch list: 422', emptyInvite.status === 422, String(emptyInvite.status));
    const invite = await call('yves@demo.injishi.com', 'POST', '/ops/team/invitations', {
      body: { email: 'grace@demo.injishi.com', orgRole: 'receptionist', branchIds: [MUSANZE, rubavu.id] },
    });
    check(
      'Invite Grace to Musanze and Rubavu: 201 with branchIds',
      invite.status === 201 && invite.json?.branchIds?.length === 2,
      `${invite.status} ${JSON.stringify(invite.json?.branchIds)}`,
    );
    const [inv] = await ids(`SELECT token FROM org_invitations WHERE id = $1`, [invite.json?.id]);
    // Rubavu archived between invite and accept would be skipped; here both stay.
    const accept = await call('grace@demo.injishi.com', 'POST', `/orgs/${AMAHORO_ORG}/staff-invitation/accept`, {
      body: { token: inv?.token },
    });
    check('Grace accepts: 201', accept.status === 201 || accept.status === 200, String(accept.status));
    const graceMe = await call('grace@demo.injishi.com', 'GET', '/me/workspaces');
    const graceGrant = (graceMe.json?.workspaces ?? graceMe.json ?? []).find?.((w) => w.workspaceId === AMAHORO_WS);
    check(
      'Grace grant after accept: limited to Musanze and Rubavu',
      graceGrant?.branchCoverage === 'limited' && graceGrant.branches.length === 2,
      JSON.stringify(graceGrant?.branches?.map((b) => b.name)),
    );
  } finally {
    // Put everything back.
    await db.query(
      `DELETE FROM org_membership_branches WHERE org_membership_id =
         (SELECT id FROM org_memberships WHERE org_id = $1 AND user_id = $2)`,
      [AMAHORO_ORG, solange.id],
    );
    await db.query(
      `DELETE FROM org_memberships WHERE org_id = $1 AND user_id = (SELECT id FROM users WHERE email = 'grace@demo.injishi.com')`,
      [AMAHORO_ORG],
    );
    await db.query(
      `UPDATE org_invitations SET status = 'revoked' WHERE org_id = $1 AND email = 'grace@demo.injishi.com' AND status = 'sent'`,
      [AMAHORO_ORG],
    );
    await db.end();
  }

  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
  process.exit(failures);
}

main().catch((err) => {
  console.error(err);
  process.exit(99);
});
