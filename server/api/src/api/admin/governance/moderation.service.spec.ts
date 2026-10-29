import { describe, expect, it, type Mock, vi } from 'vitest';

import { NotFoundException } from '@nestjs/common';

import type {
  AdminGovernanceRepository,
  AdminTicketDetailRow,
} from './admin-governance.repository';
import { AdminModerationService } from './moderation.service';

/**
 * The reason-gated ticket read (demo-comms, 2026-09-14).
 *
 * The SQL is the repository's. What is proved here is the order that makes it
 * an audit trail: the access log row is written before anything is returned,
 * names the ticket and the requester, and is not written for a ticket that does
 * not exist.
 */
describe('AdminModerationService.readTicket', () => {
  const TICKET = 'de300000-0000-4000-8000-000000001901';
  const STAFF = '11111111-1111-4111-8111-111111111111';
  const REQUESTER = '22222222-2222-4222-8222-222222222222';
  const REASON = 'Answering the person who wrote in';

  const row = (over: Partial<AdminTicketDetailRow> = {}): AdminTicketDetailRow => ({
    id: TICKET,
    requesterUserId: REQUESTER,
    category: 'booking',
    state: 'open',
    domain: null,
    districtId: null,
    firstResponseAt: null,
    resolvedAt: null,
    csat: null,
    createdAt: new Date('2026-09-14T07:00:00.000Z'),
    message: 'Will I be charged if the hotel declines?',
    contactEmail: 'grace@demo.injishi.com',
    contactName: 'Grace Kwizera',
    contactPhone: null,
    ...over,
  });

  interface Harness {
    service: AdminModerationService;
    repo: { findSupportTicket: Mock; logSupportTicketRead: Mock };
    order: string[];
  }

  function harness(found: AdminTicketDetailRow | null): Harness {
    const order: string[] = [];
    const repo = {
      findSupportTicket: vi.fn(async () => {
        order.push('find');
        return found;
      }),
      logSupportTicketRead: vi.fn(async () => {
        order.push('log');
      }),
    };
    const service = new AdminModerationService(repo as unknown as AdminGovernanceRepository);
    return { service, repo, order };
  }

  it('returns the message and the contact details', async () => {
    const { service } = harness(row());

    const ticket = await service.readTicket(TICKET, STAFF, REASON);

    expect(ticket.message).toBe('Will I be charged if the hotel declines?');
    expect(ticket.contactEmail).toBe('grace@demo.injishi.com');
    expect(ticket.contactName).toBe('Grace Kwizera');
    expect(ticket.createdAt).toBe('2026-09-14T07:00:00.000Z');
  });

  it('logs the read, naming the actor, the ticket, the requester and the reason', async () => {
    const { service, repo } = harness(row());

    await service.readTicket(TICKET, STAFF, REASON);

    expect(repo.logSupportTicketRead).toHaveBeenCalledTimes(1);
    expect(repo.logSupportTicketRead).toHaveBeenCalledWith({
      actorUserId: STAFF,
      ticketId: TICKET,
      subjectUserId: REQUESTER,
      reason: REASON,
    });
  });

  it('logs a signed-out sender with no subject user, still naming the ticket', async () => {
    const { service, repo } = harness(row({ requesterUserId: null }));

    await service.readTicket(TICKET, STAFF, REASON);

    expect(repo.logSupportTicketRead).toHaveBeenCalledWith(
      expect.objectContaining({ subjectUserId: null, ticketId: TICKET }),
    );
  });

  it('writes the log before it answers', async () => {
    const { service, order } = harness(row());

    await service.readTicket(TICKET, STAFF, REASON);

    expect(order).toEqual(['find', 'log']);
  });

  it('answers 404 for an unknown ticket and logs nothing', async () => {
    const { service, repo } = harness(null);

    await expect(service.readTicket(TICKET, STAFF, REASON)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.logSupportTicketRead).not.toHaveBeenCalled();
  });

  it('refuses to answer when the log write fails', async () => {
    const { service, repo } = harness(row());
    repo.logSupportTicketRead.mockRejectedValueOnce(new Error('insert failed'));

    await expect(service.readTicket(TICKET, STAFF, REASON)).rejects.toThrow('insert failed');
  });
});
