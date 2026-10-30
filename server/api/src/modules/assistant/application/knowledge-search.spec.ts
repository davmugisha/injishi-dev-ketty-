import { describe, expect, it } from 'vitest';

import { KNOWLEDGE, KnowledgeArticle } from '../content/knowledge';
import { searchKnowledge, tokens } from './knowledge-search';

describe('knowledge base (ADR-061 D-h)', () => {
  it('parses every entry and keeps ids unique', () => {
    for (const entry of KNOWLEDGE) expect(() => KnowledgeArticle.parse(entry)).not.toThrow();
    expect(new Set(KNOWLEDGE.map((e) => e.id)).size).toBe(KNOWLEDGE.length);
  });

  it('names a source for every entry, so each claim can be checked', () => {
    for (const entry of KNOWLEDGE) expect(entry.source.length).toBeGreaterThan(3);
  });
});

describe('searchKnowledge', () => {
  it('finds the publish blockers for "I can\'t publish my property"', () => {
    expect(searchKnowledge("I can't publish my property")[0]?.article.id).toBe(
      'cannot-publish-listing',
    );
  });

  it('finds host charges for "what does Injishi charge hosts"', () => {
    expect(searchKnowledge('what does Injishi charge hosts?')[0]?.article.id).toBe('host-charges');
  });

  it('finds payouts for "when do I get paid"', () => {
    expect(searchKnowledge('when do I get paid')[0]?.article.id).toBe('when-hosts-are-paid');
  });

  it('finds the sign in help for "I can\'t sign in" and a code that never came', () => {
    expect(searchKnowledge("I can't sign in")[0]?.article.id).toBe('signing-in');
    expect(searchKnowledge('my login code did not arrive')[0]?.article.id).toBe('signing-in');
  });

  it('matches plural and verb forms to the same words', () => {
    expect(tokens('properties listing fees houses')).toEqual(['property', 'list', 'fee', 'house']);
    expect(tokens('the business address')).toEqual(['business', 'address']);
  });

  it('returns nothing for a question the base does not cover', () => {
    expect(searchKnowledge('zxqv blorf')).toEqual([]);
    expect(searchKnowledge('the the and of')).toEqual([]);
  });

  it('answers the same question the same way every time', () => {
    const a = searchKnowledge('how do I list my hotel').map((h) => h.article.id);
    const b = searchKnowledge('how do I list my hotel').map((h) => h.article.id);
    expect(a).toEqual(b);
    expect(a.length).toBeLessThanOrEqual(3);
  });
});
