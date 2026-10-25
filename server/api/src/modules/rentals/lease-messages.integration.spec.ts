import { randomUUID } from 'node:crypto';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../../database/drizzle/schema';
import type { ScopedWorkspace } from '../../shared/auth/branch-scope';
import type { Database } from '../../shared/database/database.module';
import { MessageFilesStorage } from '../storage/application/message-files-storage';
import type { StoragePort } from '../storage/domain/storage-port';
import { LeaseMessagesService } from './application/lease-messages.service';
import { MessageDigestsService } from './application/message-digests.service';
import type { MessageEvents } from './application/message-events';
import type { TenancyRef } from './application/tenancies.service';
import type { RentalsMail } from './domain/rentals-mail';
import { LeaseMessagesRepository } from './infrastructure/lease-messages.repository';
import { RentalsContextRepository } from './infrastructure/rentals-context.repository';
import type { RentalsMailer } from './infrastructure/rentals.mailer';

/**
 * Lease conversations against a real Postgres (rentals P3.4): one thread per
 * lease under a race, unread counts per side (a team member's line is not
 * unread for the owner; the tenant's is), read receipts, a voice note stored
 * with its length, and the unread-message email: not before five minutes, one
 * per reader for every waiting conversation, not again within the cooldown,
 * never for a line the other side read, never for a fault's line.
 *
 * OPT IN: set `MESSAGES_IT_DATABASE_URL` to a THROWAWAY, migrated database.
 */
const url = process.env.MESSAGES_IT_DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('lease conversations against Postgres (MESSAGES_IT_DATABASE_URL)', () => {
  let pool: Pool;
  let db: Database;
  let ws: ScopedWorkspace;
  let owner: string;
  let team: string;
  let tenant: TenancyRef;
  let tenant2: TenancyRef;
  const mails: { to: string; subject: string; lines: string[]; url: string }[] = [];
  const events: string[] = [];

  const port: StoragePort = {
    put: async (input) => ({ objectKey: `${input.kind}/${randomUUID()}.bin`, sizeBytes: input.body.byteLength }) as never,
    putFile: async () => {
      throw new Error('not used');
    },
    signedUrl: async (key) => `https://files.test/${key}`,
    get: async () => Buffer.from('bytes'),
    remove: async () => undefined,
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- the services are what the tests read
  const build = () => {
    const repo = new LeaseMessagesRepository(db);
    const mailer = {
      appUrl: 'http://localhost:3002',
      send: async (_ref: string, to: string, mail: RentalsMail) => {
        mails.push({ to, subject: mail.subject, lines: mail.lines, url: mail.action.url });
        return true;
      },
    } as unknown as RentalsMailer;
    const sink = { messageNew: () => events.push('new'), threadRead: () => events.push('read') } as unknown as MessageEvents;
    return {
      repo,
      messages: new LeaseMessagesService(db, repo, new MessageFilesStorage(port, db), sink),
      digests: new MessageDigestsService(repo, new RentalsContextRepository(db), mailer),
    };
  };

  const q = async (text: string, values: unknown[] = []): Promise<Record<string, unknown>[]> => (await pool.query(text, values)).rows;
  const one = async (text: string, values: unknown[] = []): Promise<Record<string, unknown>> => (await q(text, values))[0]!;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url, max: 4 });
    db = drizzle(pool, { schema }) as unknown as Database;
    const tag = randomUUID().slice(0, 8);
    const user = async (email: string, name: string): Promise<string> =>
      (await one(`insert into users (email, name) values ($1, $2) returning id`, [email, name])).id as string;
    owner = await user(`owner-${tag}@msg.test`, 'Amani Owner');
    team = await user(`team-${tag}@msg.test`, 'Eric Team');
    const t1 = await user(`t1-${tag}@msg.test`, 'Grace Tenant');
    const t2 = await user(`t2-${tag}@msg.test`, 'Aline Tenant');
    const org = (await one(`insert into orgs (legal_name, domain, residence_class, registration_status, upi) values ($1, 'residence', 'residential_landlord', 'active', $2) returning id`, [`Msg Court ${tag}`, `1/02/03/04/${Math.floor(1000 + Math.random() * 8999)}`])).id as string;
    const wsId = (await one(`insert into workspaces (kind, org_id) values ('business', $1) returning id`, [org])).id as string;
    await q(`insert into org_memberships (org_id, user_id, org_role) values ($1, $2, 'owner'), ($1, $3, 'receptionist')`, [org, owner, team]);
    const prop = (await one(`insert into properties (org_id, workspace_id, name) values ($1, $2, 'Msg Court') returning id`, [org, wsId])).id as string;
    const lease = async (label: string, userId: string, name: string, n: number): Promise<TenancyRef> => {
      const unit = (await one(`insert into rental_units (workspace_id, property_id, label) values ($1, $2, $3) returning id`, [wsId, prop, label])).id as string;
      const ten = (await one(`insert into tenants (workspace_id, org_id, full_name, email, user_id) values ($1, $2, $3, $4, $5) returning id`, [wsId, org, name, `${label.toLowerCase()}-${tag}@msg.test`, userId])).id as string;
      const l = (await one(
        `insert into leases (org_id, workspace_id, monthly_rent_rwf, start_date, end_date, reference, rent_due_day, property_id, unit_id, tenant_id, billing_starts_on, deposit_rwf, status, signed_at, activated_at)
         values ($1, $2, 300000, current_date, current_date + 365, $3, 5, $4, $5, $6, current_date, 0, 'active', now(), now()) returning id`,
        [org, wsId, `L-${n}-${tag}`, prop, unit, ten],
      )).id as string;
      return { leaseId: l, tenantId: ten, userId, workspaceId: wsId };
    };
    tenant = await lease('M-01', t1, 'Grace Tenant', 1);
    tenant2 = await lease('M-02', t2, 'Aline Tenant', 2);
    ws = {
      workspaceId: wsId,
      kind: 'business',
      orgId: org,
      domain: 'residence',
      orgRole: 'owner',
      permissions: ['message.send'],
      branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
    } as unknown as ScopedWorkspace;
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('makes one thread per lease even when two first messages race', async () => {
    const { messages } = build();
    await Promise.all([
      messages.landlordSend(ws, owner, tenant.leaseId, { body: 'Welcome home' }, []),
      messages.tenantSend(tenant, { body: 'Thank you' }, []),
    ]);
    const rows = await q(`select id from threads where lease_id = $1`, [tenant.leaseId]);
    expect(rows).toHaveLength(1);
    expect(await q(`select id from messages where thread_id = $1`, [rows[0]!.id])).toHaveLength(2);
  });

  it("counts unread per side: the tenant's lines for the landlord's people, the landlord side's for the tenant", async () => {
    const { messages } = build();
    // Both wrote once above (and each sender has read up to their own line).
    // Both read everything first, so the counts start from nothing.
    await messages.landlordRead(ws, owner, tenant.leaseId);
    await messages.tenantRead(tenant);
    await messages.landlordSend(ws, team, tenant.leaseId, { body: 'Hello from the office' }, []);
    await messages.landlordSend(ws, team, tenant.leaseId, { body: 'The plumber comes at 10' }, []);
    // Two landlord-side lines for the tenant; a team member's line is never unread for the owner.
    expect(await messages.tenantUnread(tenant.userId)).toEqual({ total: 2, byLease: { [tenant.leaseId]: 2 } });
    expect((await messages.landlordUnread(ws, owner)).total).toBe(0);
    await messages.tenantSend(tenant, { body: 'Great' }, []);
    expect((await messages.landlordUnread(ws, owner)).total).toBe(1);
    expect((await messages.landlordUnread(ws, team)).total).toBe(1);
    // Writing marked the tenant read; reading clears the owner's.
    expect((await messages.tenantUnread(tenant.userId)).total).toBe(0);
    await messages.landlordSend(ws, team, tenant.leaseId, { body: 'The plumber comes at 10' }, []);
    await messages.landlordRead(ws, owner, tenant.leaseId);
    expect((await messages.landlordUnread(ws, owner)).total).toBe(0);
    expect((await messages.tenantUnread(tenant.userId)).total).toBe(1);
    await messages.tenantRead(tenant);
    expect((await messages.tenantUnread(tenant.userId)).total).toBe(0);
    const list = await messages.landlordList(ws, owner);
    expect(list.threads.map((t) => t.reference)).toHaveLength(2);
    expect(list.threads[0]).toMatchObject({ leaseId: tenant.leaseId, lastMessagePreview: 'The plumber comes at 10', lastMessageFromMe: true, unreadCount: 0 });
    // The lease with no conversation yet is listed to start one.
    expect(list.threads[1]).toMatchObject({ leaseId: tenant2.leaseId, threadId: null, lastMessageAt: null });
    expect((await messages.landlordList(ws, owner, 'aline')).threads.map((t) => t.leaseId)).toEqual([tenant2.leaseId]);
  });

  it('turns our ticks to read when the other side opens the conversation', async () => {
    const { messages } = build();
    const sent = await messages.tenantSend(tenant, { body: 'Is Saturday fine?' }, []);
    expect(sent.receipt).toBe('delivered');
    await messages.landlordRead(ws, team, tenant.leaseId);
    const view = await messages.tenantThread(tenant);
    expect(view.messages.at(-1)).toMatchObject({ id: sent.id, fromMe: true, receipt: 'read' });
  });

  it('stores a voice note with its length and a photo, and hands each file only to the conversation it is in', async () => {
    const { messages } = build();
    const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64, 1)]);
    const voice = await messages.tenantSend(tenant, { voiceDurationS: 7 }, [{ filename: 'voice.webm', mime: 'audio/webm;codecs=opus', body: webm }]);
    expect(voice).toMatchObject({ bodyType: 'voice', voiceDurationS: 7, attachments: [{ kind: 'audio', mime: 'audio/webm', filename: 'voice.webm' }] });
    expect(voice.attachments[0]!.url).toBe(`/api/v1/me/tenancies/${tenant.leaseId}/messages/files/${voice.attachments[0]!.id}`);
    await expect(messages.tenantFile(tenant, voice.attachments[0]!.id)).resolves.toMatchObject({ mime: 'audio/webm' });
    await messages.tenantSend(tenant2, { body: 'hello' }, []);
    await expect(messages.tenantFile(tenant2, voice.attachments[0]!.id)).rejects.toThrow('That file was not found.');
    const pdf = await messages.landlordSend(ws, owner, tenant.leaseId, { body: 'Receipt attached' }, [{ filename: 'receipt.pdf', mime: 'application/pdf', body: Buffer.from('%PDF-1.4 test') }]);
    expect(pdf).toMatchObject({ bodyType: 'file', attachments: [{ kind: 'file', filename: 'receipt.pdf' }] });
    await expect(messages.tenantSend(tenant, {}, [{ filename: 'x.exe', mime: 'application/pdf', body: Buffer.from('MZ\x90\x00') }])).rejects.toThrow(/can't be sent/);
  });

  it('emails each reader once for what waits, after five minutes, and not again within the cooldown', async () => {
    const { digests, messages } = build();
    // Settle what came before: both sides read, and no digest is due.
    await messages.tenantRead(tenant);
    await messages.landlordRead(ws, owner, tenant.leaseId);
    await messages.tenantRead(tenant2);
    await messages.landlordRead(ws, owner, tenant2.leaseId);
    await q(`delete from thread_digests where thread_id in (select id from threads where lease_id = any($1))`, [[tenant.leaseId, tenant2.leaseId]]);
    mails.length = 0;
    const now = new Date(Date.now() + 1000);
    expect(await digests.run(now)).toBe(0);

    // The landlord writes twice to Grace; both tenants write to the landlord.
    await messages.landlordSend(ws, owner, tenant.leaseId, { body: 'Water off on Monday' }, []);
    await messages.landlordSend(ws, team, tenant.leaseId, { body: 'From 9 to 12' }, []);
    await messages.tenantSend(tenant, { body: 'Noted' }, []);
    await messages.tenantSend(tenant2, { body: 'Can I paint the bedroom?' }, []);
    // Four minutes on: nothing yet.
    expect(await digests.run(new Date(Date.now() + 4 * 60_000))).toBe(0);
    // Six minutes on. Grace wrote "Noted" after the landlord's two lines, which marked them read: no
    // mail to her. The landlord's people have not read "Noted" or Aline's line: ONE mail to the business
    // for both conversations.
    const later = new Date(Date.now() + 6 * 60_000);
    expect(await digests.run(later)).toBe(1);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to.startsWith('owner-')).toBe(true);
    expect(mails[0]!.subject).toBe('2 new messages in 2 conversations');
    expect(mails[0]!.url).toBe('http://localhost:3002/messages');

    // Again right away: nothing new, nothing sent.
    mails.length = 0;
    expect(await digests.run(new Date(later.getTime() + 60_000))).toBe(0);
    // A new tenant line inside the cooldown waits; after it, one more mail.
    await messages.tenantSend(tenant2, { body: 'Also the door' }, []);
    expect(await digests.run(new Date(later.getTime() + 10 * 60_000))).toBe(0);
    expect(await digests.run(new Date(later.getTime() + 31 * 60_000))).toBe(1);
    expect(mails[0]?.subject).toBe('Aline Tenant sent 1 new message');

    // A team member reading clears the landlord side: nothing more for them.
    await messages.tenantSend(tenant2, { body: 'And the window' }, []);
    await messages.landlordRead(ws, team, tenant2.leaseId);
    mails.length = 0;
    expect(await digests.run(new Date(later.getTime() + 90 * 60_000))).toBe(0);
  });

  it("emails the tenant for the landlord's lines they leave unread", async () => {
    const { digests, messages } = build();
    mails.length = 0;
    await messages.landlordSend(ws, owner, tenant2.leaseId, { body: 'Yes, white only' }, []);
    expect(await digests.run(new Date(Date.now() + 120 * 60_000))).toBe(1);
    expect(mails[0]!.subject).toMatch(/^Msg Court \S+ sent 1 new message$/);
    expect(mails[0]!.url).toBe(`http://localhost:3002/home/${tenant2.leaseId}/messages`);
    expect(mails[0]!.to.startsWith('t2-')).toBe(true);
    expect(mails[0]!.lines[0]).toContain('"Yes, white only"');
  });

  it("leaves a fault's line out of the email (the fault's own emails carried it)", async () => {
    const { digests, messages } = build();
    const ticket = (await one(`insert into maintenance_tickets (workspace_id, org_id, lease_id, title) values ($1, $2, $3, 'Tap leaking') returning id`, [
      ws.workspaceId,
      ws.orgId,
      tenant.leaseId,
    ])).id as string;
    // Everyone has read everything; only the fault's line is new.
    for (const t of [tenant, tenant2]) {
      await messages.tenantRead(t);
      await messages.landlordRead(ws, owner, t.leaseId);
    }
    mails.length = 0;
    const line = await db.transaction((tx) => messages.faultLine(tx, { leaseId: tenant.leaseId, ticketId: ticket, senderUserId: tenant.userId, body: 'It drips' }));
    expect(line).toMatchObject({ leaseId: tenant.leaseId });
    const view = await messages.landlordThread(ws, owner, tenant.leaseId);
    expect(view.messages.at(-1)).toMatchObject({ body: 'It drips', fault: { id: ticket, title: 'Tap leaking' } });
    expect(await digests.run(new Date(Date.now() + 200 * 60_000))).toBe(0);
  });
});
