import { readFileSync } from 'node:fs';
import path from 'node:path';

import { COUNTRY_NAMES, GUEST_RELATIONSHIPS, GuestHostKind, GuestRegistrationStatus, LEADER_ROLES, OversightRole, OversightScopeLevel } from '@injishi/contracts';

import { oversightRoleEnum, oversightScopeLevelEnum } from './enums';
import { guestHostKindEnum, guestRegistrationStatusEnum } from './guests';

/**
 * The guest tables and their reference lists stay in step with contracts
 * (P5): the database enums are the zod lists, and migration 0085 seeds
 * exactly contracts' countries (the kit's country picker shows the same) and
 * guest relationships.
 */
const MIGRATION = readFileSync(path.join(__dirname, 'migrations', '0091_guest_registrations.sql'), 'utf8');

describe('guests schema and reference data', () => {
  it('builds the guest enums from the contracts vocabulary', () => {
    expect(guestHostKindEnum.enumValues).toEqual(GuestHostKind.options);
    expect(guestRegistrationStatusEnum.enumValues).toEqual(GuestRegistrationStatus.options);
    expect(oversightRoleEnum.enumValues).toEqual(OversightRole.options);
    expect(oversightScopeLevelEnum.enumValues).toEqual(OversightScopeLevel.options);
    for (const role of LEADER_ROLES) expect(oversightRoleEnum.enumValues).toContain(role);
  });

  it('seeds every country contracts knows, Rwanda first, and nothing else', () => {
    const seeded = [...MIGRATION.matchAll(/^\t\('([A-Z]{2})', '((?:[^']|'')*)', (\d+)\)/gm)].map((m) => ({ code: m[1], name: m[2]!.replace(/''/g, "'"), order: Number(m[3]) }));
    expect(seeded.map((s) => s.code).sort()).toEqual(Object.keys(COUNTRY_NAMES).sort());
    for (const s of seeded) expect(s.name).toBe(COUNTRY_NAMES[s.code as keyof typeof COUNTRY_NAMES]);
    expect(seeded.filter((s) => s.order === 0).map((s) => s.code)).toEqual(['RW']);
  });

  it('seeds the guest relationships in the form’s order, with Other asking for words', () => {
    const seeded = [...MIGRATION.matchAll(/^\t\('([a-z_]+)', '((?:[^']|'')*)', (\d+), (true|false)\)/gm)].map((m) => ({
      code: m[1],
      label: m[2]!.replace(/''/g, "'"),
      needsDetail: m[4] === 'true',
    }));
    expect(seeded).toEqual(GUEST_RELATIONSHIPS.map((r) => ({ code: r.code, label: r.label, needsDetail: r.needsDetail })));
  });

  it('adds DGIE for the district immigration officer', () => {
    expect(MIGRATION).toMatch(/INSERT INTO "government_bodies"[\s\S]*'DGIE', 'Directorate General of Immigration and Emigration'/);
  });
});
