import { describe, expect, it } from 'vitest';

import {
  allowedRelationshipsFor,
  disallowedPairSentence,
  FAIL_CLOSED_POLICY,
  firstFreeSlug,
  readRelationshipPolicy,
  slugBase,
  taxEntityFor,
} from './outlet-rules';

const ALL_SIX = [
  'hotel_operated',
  'third_party_managed',
  'leased_tenant',
  'concession',
  'franchise',
  'revenue_share',
];

describe('outlet relationship policy (ADR-050 D-i, AC-14)', () => {
  const seeded = readRelationshipPolicy({ restaurant: ALL_SIX, bar: ALL_SIX, '*': ['hotel_operated'] });

  it('lets a restaurant and a bar carry every arrangement', () => {
    expect(allowedRelationshipsFor(seeded, 'restaurant')).toEqual(ALL_SIX);
    expect(allowedRelationshipsFor(seeded, 'bar')).toEqual(ALL_SIX);
  });

  it('falls back to `*` for a kind the row does not name', () => {
    expect(allowedRelationshipsFor(seeded, 'spa')).toEqual(['hotel_operated']);
  });

  it('lets a config edit open spa with no code change', () => {
    const edited = readRelationshipPolicy({ restaurant: ALL_SIX, spa: ['hotel_operated', 'concession'], '*': ['hotel_operated'] });
    expect(allowedRelationshipsFor(edited, 'spa')).toContain('concession');
  });

  it('fails closed when the row is missing or unreadable', () => {
    for (const value of [null, undefined, 'restaurant', [], 42, {}]) {
      expect(readRelationshipPolicy(value)).toEqual(FAIL_CLOSED_POLICY);
      expect(allowedRelationshipsFor(readRelationshipPolicy(value), 'restaurant')).toEqual(['hotel_operated']);
    }
  });

  it('keeps only arrangements it can name, and drops a key left with none', () => {
    const policy = readRelationshipPolicy({ bar: ['concession', 'timeshare'], spa: ['nonsense'], '*': ['hotel_operated'] });
    expect(policy.bar).toEqual(['concession']);
    expect(policy.spa).toBeUndefined();
    expect(allowedRelationshipsFor(policy, 'spa')).toEqual(['hotel_operated']);
  });

  it('fails closed when a row has no `*` and does not name the kind', () => {
    expect(allowedRelationshipsFor(readRelationshipPolicy({ bar: ALL_SIX }), 'gym')).toEqual(['hotel_operated']);
  });

  it('refuses with a sentence naming the kind and what it may be', () => {
    expect(disallowedPairSentence('spa', 'concession', ['hotel_operated'])).toBe(
      'A spa outlet cannot be concession. It may be: hotel operated.',
    );
  });
});

describe('tax entity (ADR-050 D-j)', () => {
  it('is the property org for a hotel operated outlet', () => {
    expect(taxEntityFor({ relationshipType: 'hotel_operated', propertyOrgId: 'p', workspaceOrgId: 'w', operatorOrgId: 'o' })).toBe('p');
  });
  it('is the workspace org for a hotel operated outlet with no property', () => {
    expect(taxEntityFor({ relationshipType: 'hotel_operated', propertyOrgId: null, workspaceOrgId: 'w', operatorOrgId: null })).toBe('w');
  });
  it('is the operator org for any other arrangement', () => {
    expect(taxEntityFor({ relationshipType: 'leased_tenant', propertyOrgId: 'p', workspaceOrgId: 'w', operatorOrgId: 'o' })).toBe('o');
    expect(taxEntityFor({ relationshipType: 'franchise', propertyOrgId: 'p', workspaceOrgId: 'w', operatorOrgId: null })).toBeNull();
  });
});

describe('standalone outlet slug (ADR-050 D-l)', () => {
  it('folds accents and punctuation into hyphens', () => {
    expect(slugBase('  Café Néo & Bar! ')).toBe('cafe-neo-bar');
  });
  it('is never empty', () => {
    expect(slugBase('!!!')).toBe('outlet');
  });
  it('caps the length without leaving a trailing hyphen', () => {
    const slug = slugBase(`${'a'.repeat(59)} b`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
  it('suffixes -2, -3 on collision', () => {
    expect(firstFreeSlug('cafe', new Set())).toBe('cafe');
    expect(firstFreeSlug('cafe', new Set(['cafe']))).toBe('cafe-2');
    expect(firstFreeSlug('cafe', new Set(['cafe', 'cafe-2']))).toBe('cafe-3');
  });
});
