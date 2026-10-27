import { randomUUID } from 'node:crypto';

import type { WorkspaceAccess } from '@injishi/contracts';
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
import { PlacementMessagesService } from './application/placement-messages.service';
import type { RentalsMail } from './domain/rentals-mail';
import { LeaseMessagesRepository } from './infrastructure/lease-messages.repository';
import { PlacementMessagesRepository } from './infrastructure/placement-messages.repository';
import { RentalsContextRepository } from './infrastructure/rentals-context.repository';
import type { RentalsMailer } from './infrastructure/rentals.mailer';

/**
 * Broker conversations against a real Postgres (2026-10-26): one thread per
 * placement under a race, kept apart from the lease conversations (the
 * tenant never lists it, the landlord's lease list never shows it), unread
 * counts per side, and the unread email to the broker and to the business.
 *
 * OPT IN: set `MESSAGES_IT_DATABASE_URL` to a THROWAWAY, migrated database.
 */
const url = process.env.MESSAGES_IT_DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('broker conversations against Postgres (MESSAGES_IT_DATABASE_URL)', () => {
  let pool: Pool;
  let db: Database;
  let landlord: ScopedWorkspace;
  let broker: WorkspaceAccess;
  let owner: string;
  let brokerUser: string;
  let tenantUser: string;
  let placement: string;
  const mails: { to: string; subject: string; url: string }[] = [];

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
    const placements = new PlacementMessagesRepository(db);
    const files = new MessageFilesStorage(port, db);
    const sink = { messageNew: () => undefined, threadRead: () => undefined, placementMessageNew: () => undefined, placementThreadRead: () => undefined } as unknown as MessageEvents;
    const mailer = {
      appUrl: 'http://localhost:3002',
      send: async (_ref: string, to: string, mail: RentalsMail) => {
        mails.push({ to, subject: mail.subject, url: mail.action.url });
        return true;
      },
    } as unknown as RentalsMailer;
    return {
      leases: new LeaseMessagesService(db, repo, files, sink),
      messages: new PlacementMessagesService(db, repo, placements, files, sink),
      digests: new MessageDigestsService(repo, new RentalsContextRepository(db), mailer, placements),
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
    owner = await user(`powner-${tag}@msg.test`, 'Amani Owner');
    brokerUser = await user(`pbroker-${tag}@msg.test`, 'Didier Broker');
    tenantUser = await user(`ptenant-${tag}@msg.test`, 'Grace Tenant');
    const org = (await one(`insert into orgs (legal_name, domain, business_kind, residence_class, registration_status, upi) values ($1, 'residence', 'residence', 'residential_landlord', 'active', $2) returning id`, [`Broker Court ${tag}`, `1/02/03/05/${Math.floor(1000 + Math.random() * 8999)}`])).id as string;
    const wsId = (await one(`insert into workspaces (kind, org_id) values ('business', $1) returning id`, [org])).id as string;
    await q(`insert into org_memberships (org_id, user_id, org_role) values ($1, $2, 'owner')`, [org, owner]);
    const prop = (await one(`insert into properties (org_id, workspace_id, name) values ($1, $2, 'Broker Court') returning id`, [org, wsId])).id as string;
    const unit = (await one(`insert into rental_units (workspace_id, property_id, label) values ($1, $2, 'B-01') returning id`, [wsId, prop])).id as string;
    const brokerWs = (await one(`insert into workspaces (kind, user_id) values ('broker', $1) returning id`, [brokerUser])).id as string;
    const brokerId = (await one(`insert into brokers (user_id, national_id, name) values ($1, $2, 'Didier Broker') returning id`, [brokerUser, `1199${Math.floor(1e11 + Math.random() * 8e11)}`])).id as string;
    placement = (await one(
      `insert into tenant_placements (broker_id, landlord_org_id, unit_id, workspace_id, tenant_name) values ($1, $2, $3, $4, 'Grace') returning id`,
      [brokerId, org, unit, wsId],
    )).id as string;
    // A lease on the same unit, so the tenant has conversations of their own to list.
    const ten = (await one(`insert into tenants (workspace_id, org_id, full_name, email, user_id) values ($1, $2, 'Grace Tenant', $3, $4) returning id`, [wsId, org, `ptenant-${tag}@msg.test`, tenantUser])).id as string;
    await q(
      `insert into leases (org_id, workspace_id, monthly_rent_rwf, start_date, end_date, reference, rent_due_day, property_id, unit_id, tenant_id, billing_starts_on, deposit_rwf, status, signed_at, activated_at)
       values ($1, $2, 300000, current_date, current_date + 365, $3, 5, $4, $5, $6, current_date, 0, 'active', now(), now())`,
      [org, wsId, `L-P-${tag}`, prop, unit, ten],
    );
    landlord = {
      workspaceId: wsId,
      kind: 'business',
      orgId: org,
      domain: 'residence',
      orgRole: 'owner',
      permissions: ['lease.manage', 'message.send'],
      branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
    } as unknown as ScopedWorkspace;
    broker = { workspaceId: brokerWs, kind: 'broker' } as unknown as WorkspaceAccess;
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('makes one thread per placement even when both sides open it at once', async () => {
    const { messages } = build();
    await Promise.all([messages.brokerThread(broker, brokerUser, placement), messages.landlordThread(landlord, owner, placement)]);
    const rows = await q(`select id, thread_kind::text as kind, lease_id from threads where placement_id = $1`, [placement]);
    expect(rows).toEqual([{ id: expect.any(String), kind: 'placement', lease_id: null }]);
  });

  it('counts unread per side, and the sender has read their own line', async () => {
    const { messages } = build();
    await messages.brokerSend(broker, brokerUser, placement, { body: 'Grace can move in Monday' }, []);
    expect((await messages.landlordUnread(landlord, owner)).total).toBe(1);
    expect((await messages.brokerUnread(broker, brokerUser)).total).toBe(0);
    const reply = await messages.landlordSend(landlord, owner, placement, { body: 'Monday works' }, []);
    expect(reply).toMatchObject({ side: 'landlord', fromMe: true, receipt: 'delivered' });
    expect((await messages.landlordUnread(landlord, owner)).total).toBe(0);
    expect(await messages.brokerUnread(broker, brokerUser)).toEqual({ total: 1, byLease: {}, byPlacement: { [placement]: 1 } });
    await messages.brokerRead(broker, brokerUser, placement);
    const view = await messages.landlordThread(landlord, owner, placement);
    expect(view.messages.at(-1)).toMatchObject({ body: 'Monday works', receipt: 'read' });
    const list = await messages.brokerList(broker, brokerUser);
    expect(list.threads[0]).toMatchObject({ placementId: placement, counterpartName: expect.stringMatching(/^Broker Court/), lastMessagePreview: 'Monday works', unreadCount: 0 });
  });

  it("stays out of the tenant's conversations and the landlord's lease list", async () => {
    const { leases } = build();
    const tenantList = await leases.tenantList(tenantUser);
    expect(tenantList.threads).toHaveLength(1);
    const placementThread = (await one(`select id from threads where placement_id = $1`, [placement])).id as string;
    expect(tenantList.threads.map((t) => t.threadId)).not.toContain(placementThread);
    expect((await leases.landlordList(landlord, owner)).threads.map((t) => t.threadId)).not.toContain(placementThread);
    // The placement's lines never count as the tenant's unread.
    expect((await leases.tenantUnread(tenantUser)).total).toBe(0);
  });

  it('emails the broker and the business once each for what waits', async () => {
    const { messages, digests } = build();
    const thread = (await one(`select id from threads where placement_id = $1`, [placement])).id as string;
    await messages.brokerRead(broker, brokerUser, placement);
    await messages.landlordRead(landlord, owner, placement);
    await q(`delete from thread_digests where thread_id = $1`, [thread]);
    mails.length = 0;
    await messages.brokerSend(broker, brokerUser, placement, { body: 'Deposit ready' }, []);
    expect(await digests.run(new Date(Date.now() + 6 * 60_000))).toBe(1);
    expect(mails[0]).toMatchObject({ subject: 'Didier Broker sent 1 new message', url: `http://localhost:3002/messages?placement=${placement}` });
    expect(mails[0]!.to.startsWith('powner-')).toBe(true);
    mails.length = 0;
    await messages.landlordSend(landlord, owner, placement, { body: 'Thanks' }, []);
    expect(await digests.run(new Date(Date.now() + 40 * 60_000))).toBe(1);
    expect(mails[0]!.to.startsWith('pbroker-')).toBe(true);
    expect(mails[0]!.url).toBe(`http://localhost:3002/messages?placement=${placement}`);
  });
});
