import { describe, expect, it } from 'vitest';

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { accessContextFor, runWithAccessContext } from '../auth/access-context';
import { AuditWriter } from './audit-writer';
import { redactPersonal } from './personal-fields';

/**
 * The one audit writer (ADR-076 contract section 8, AC-U4, G16).
 *
 * Pins that every row carries the access it was written under when a request
 * is behind it, carries none when nothing is, never leaks a personal value, and
 * that nothing else in the server inserts an audit row.
 */
describe('AuditWriter', () => {
  function fakeWriter(): { tx: Parameters<typeof AuditWriter.write>[0]; rows: Record<string, unknown>[] } {
    const rows: Record<string, unknown>[] = [];
    const tx = {
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          rows.push(row);
          return { returning: () => Promise.resolve([{ id: 'audit-1' }]) };
        },
      }),
    } as unknown as Parameters<typeof AuditWriter.write>[0];
    return { tx, rows };
  }

  it('stamps the access of the request it runs in', async () => {
    const { tx, rows } = fakeWriter();
    const context = accessContextFor('business', 'user-1', {
      actorMembershipId: 'membership-1',
      roleKeys: ['receptionist'],
      permissions: ['pms.stay.checkin'],
      scope: [{ kind: 'branch', ids: ['11111111-1111-4111-8111-111111111111'] }],
    });
    const written = await runWithAccessContext(context, () =>
      AuditWriter.write(tx, { subjectType: 'org', subjectId: 'org-1', eventType: 'team.member_role_changed' }),
    );
    expect(written).toEqual({ id: 'audit-1' });
    expect(rows[0]).toMatchObject({
      // No actor named: the request's.
      actorUserId: 'user-1',
      actorMembershipId: 'membership-1',
      grantFamily: 'business',
      roleKeys: ['receptionist'],
      permissions: ['pms.stay.checkin'],
      scope: [{ kind: 'branch', ids: ['11111111-1111-4111-8111-111111111111'] }],
      deviceId: null,
    });
  });

  it('keeps an explicit null actor, the act nobody signed in did', async () => {
    const { tx, rows } = fakeWriter();
    await runWithAccessContext(accessContextFor('device', null, { deviceId: 'kiosk-1' }), () =>
      AuditWriter.write(tx, { actorUserId: null, eventType: 'hr.attendance.punched' }),
    );
    expect(rows[0]).toMatchObject({ actorUserId: null, grantFamily: 'device', deviceId: 'kiosk-1' });
  });

  it('records no access at all outside a request: a job or a script', async () => {
    const { tx, rows } = fakeWriter();
    await AuditWriter.write(tx, { actorUserId: 'user-2', eventType: 'staff.bootstrapped' });
    expect(rows[0]).toMatchObject({
      actorUserId: 'user-2',
      actorMembershipId: null,
      grantFamily: null,
      roleKeys: null,
      permissions: null,
      scope: null,
    });
  });

  it('writes a personal value as "changed", at any depth, and keeps the key', async () => {
    const { tx, rows } = fakeWriter();
    await AuditWriter.write(tx, {
      eventType: 'team.invitation_sent',
      payloadDiff: { invitationId: 'inv-1', email: 'aline@example.com', owner: { phone: '+250788000000', role: 'owner' } },
    });
    expect(rows[0].payloadDiff).toEqual({
      invitationId: 'inv-1',
      email: 'changed',
      owner: { phone: 'changed', role: 'owner' },
    });
  });

  it('leaves a business branch name and a property village alone: personal only on an HR file', () => {
    expect(redactPersonal({ branchName: 'Remera', villageId: 4101, street: 'KG 7 Ave' })).toEqual({
      branchName: 'Remera',
      villageId: 4101,
      street: 'KG 7 Ave',
    });
  });

  // Reads every source file: slow on a laptop under a full parallel run, so it gets 30 seconds.
  it('is the only code in the server that inserts an audit row', () => {
    const src = join(__dirname, '..', '..');
    // The assistant's retention job closes an interrupted approval and audits it in
    // ONE statement, so a rerun can never audit twice. It runs with no request
    // behind it, so it would record no access through the writer either. It is the
    // one exception (ADR-076 G16).
    const allowed = new Set(['modules/assistant/infrastructure/retention-queries.ts']);
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
          continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) continue;
        const rel = relative(src, path).replace(/\\/g, '/');
        if (rel === 'shared/audit/audit-writer.ts' || allowed.has(rel)) continue;
        const text = readFileSync(path, 'utf8');
        if (/insert\(\s*auditEvents\s*\)|insert\s+into\s+audit_events/i.test(text)) offenders.push(rel);
      }
    };
    walk(src);
    expect(offenders).toEqual([]);
  }, 30_000);
});
