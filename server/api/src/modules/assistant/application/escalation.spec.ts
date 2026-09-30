import { BadRequestException, NotFoundException } from '@nestjs/common';

import { hashAnonToken } from '../domain/anon-token';
import { MOCK_ESCALATION_OFFERED, MockAssistantModel } from '../infrastructure/mock-model.adapter';
import { defaultProposals } from '../testing/fake-actions';
import { FakeConversations } from '../testing/fake-conversations';
import { fakeReads } from '../testing/fake-listings';
import { ToolSet } from './assistant-tools';
import { AssistantService } from './assistant.service';

const NOW = new Date('2026-09-30T10:00:00Z');

function build(): { repo: FakeConversations; service: AssistantService } {
  const repo = new FakeConversations();
  const service = new AssistantService(
    new MockAssistantModel(),
    { mode: 'mock', model: 'claude-sonnet-5-5' },
    repo.asRepository(),
    new ToolSet(fakeReads),
    defaultProposals,
  );
  return { repo, service };
}

describe('human escalation (ADR-061 D-l, slice F)', () => {
  it('offers human support on the answer, and the model sends nothing', async () => {
    const { repo, service } = build();
    const result = await service.send({ kind: 'anon', tokenHash: null }, { message: 'I want to talk to a person', surface: 'web' }, NOW);
    const reply = result.conversation.messages[1];
    expect(reply).toMatchObject({ text: MOCK_ESCALATION_OFFERED, escalation: { topic: 'other' } });
    // The model cannot write a ticket: the offer alone leaves none.
    expect(repo.tickets).toHaveLength(0);
  });

  it('writes a ticket carrying the context when the person sends it', async () => {
    const { repo, service } = build();
    const first = await service.send(
      { kind: 'anon', tokenHash: null },
      { message: "I can't publish my property", surface: 'web', pagePath: '/host' },
      NOW,
    );
    const holder = { kind: 'anon' as const, tokenHash: hashAnonToken(first.newAnonToken as string) };
    await service.send(holder, { message: 'I want to talk to a person', surface: 'web' }, NOW);

    const { ticketId } = await service.escalate(holder, { surface: 'web', topic: 'listing', email: 'aline@example.rw', name: 'Aline' }, { email: null }, NOW);
    const ticket = repo.tickets.find((t) => t.id === ticketId);
    expect(ticket).toMatchObject({
      requesterUserId: null,
      category: 'listing',
      contactEmail: 'aline@example.rw',
      contactName: 'Aline',
      conversationId: first.conversation.id,
      context: expect.objectContaining({
        page: '/host',
        questions: ["I can't publish my property", 'I want to talk to a person'],
        toolsUsed: expect.arrayContaining(['search_help', 'suggest_human_support']),
      }),
    });
    expect(ticket?.message).toMatch(/^Sent from the Injishi support assistant\.\nPage: \/host\nWhat the person asked:\n- I can't publish my property/);
  });

  it('uses the account address for a signed in person, never one the model chose', async () => {
    const { repo, service } = build();
    await service.send({ kind: 'user', userId: 'u1' }, { message: 'I want to talk to a person', surface: 'web' }, NOW);
    await service.escalate({ kind: 'user', userId: 'u1' }, { surface: 'web', topic: 'other', email: 'someone@else.rw' }, { email: 'owner@example.rw' }, NOW);
    expect(repo.tickets[0]).toMatchObject({ requesterUserId: 'u1', contactEmail: 'owner@example.rw' });
  });

  it('refuses an anonymous escalation without a reply address, and one with nothing to send', async () => {
    const { service } = build();
    const first = await service.send({ kind: 'anon', tokenHash: null }, { message: 'hello', surface: 'web' }, NOW);
    const holder = { kind: 'anon' as const, tokenHash: hashAnonToken(first.newAnonToken as string) };
    await expect(service.escalate(holder, { surface: 'web', topic: 'other' }, { email: null }, NOW)).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.escalate({ kind: 'anon', tokenHash: null }, { surface: 'web', topic: 'other', email: 'a@b.rw' }, { email: null }, NOW),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('answer feedback (ADR-061 D-m)', () => {
  it('records feedback once, and shows it on the answer', async () => {
    const { repo, service } = build();
    const first = await service.send({ kind: 'user', userId: 'u1' }, { message: 'what is injishi', surface: 'web' }, NOW);
    const answerId = first.conversation.messages[1].id;
    expect(await service.feedback({ kind: 'user', userId: 'u1' }, answerId, true, NOW)).toEqual({ messageId: answerId, helpful: true });
    // A second press cannot flip it.
    expect(await service.feedback({ kind: 'user', userId: 'u1' }, answerId, false, NOW)).toEqual({ messageId: answerId, helpful: true });
    expect(repo.feedback.size).toBe(1);
    const view = await service.current({ kind: 'user', userId: 'u1' }, 'web', NOW);
    expect(view?.messages[1].helpful).toBe(true);
  });

  it("refuses feedback on someone else's message, on a question, and on an expired conversation", async () => {
    const { service } = build();
    const first = await service.send({ kind: 'user', userId: 'u1' }, { message: 'what is injishi', surface: 'web' }, NOW);
    const [question, answer] = first.conversation.messages;
    await expect(service.feedback({ kind: 'user', userId: 'u2' }, answer.id, true, NOW)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.feedback({ kind: 'anon', tokenHash: null }, answer.id, true, NOW)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.feedback({ kind: 'user', userId: 'u1' }, question.id, true, NOW)).rejects.toBeInstanceOf(NotFoundException);
    const later = new Date('2027-01-30T10:00:00Z');
    await expect(service.feedback({ kind: 'user', userId: 'u1' }, answer.id, true, later)).rejects.toBeInstanceOf(NotFoundException);
  });
});
