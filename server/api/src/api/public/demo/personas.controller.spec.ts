import { describe, expect, it, vi } from 'vitest';

import { DemoPersona, type OversightConsoleGrant, type WorkspaceAccess } from '@injishi/contracts';
import { NotFoundException } from '@nestjs/common';

import type { WorkspaceService } from '../../../shared/auth/workspace.service';
import type { Platform } from '../../../shared/config/platform';
import type { Database } from '../../../shared/database/database.module';
import { DemoPersonasController, __testing } from './personas.controller';

/**
 * `GET /api/v1/demo/personas` (ADR-043 AC-18, AC-20).
 *
 * What these pin: every seat carries a worded role, a person who is ONLY a
 * government officer is listed (they hold no workspace and used to drop off),
 * duplicate assignments collapse, a multi-seat persona keeps every seat in
 * rank order, and the route is a 404 off the demo.
 */

/** A drizzle query builder stand-in: every step returns itself, awaiting it yields `rows`. */
function query(rows: unknown[]): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  for (const step of ['from', 'where', 'orderBy', 'innerJoin', 'leftJoin']) {
    q[step] = () => q;
  }
  q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return q;
}

function business(
  over: Partial<WorkspaceAccess> & Pick<WorkspaceAccess, 'orgName' | 'orgRole' | 'domain'>,
): WorkspaceAccess {
  return {
    workspaceId: `ws-${over.orgName}-${over.orgRole}`,
    kind: 'business',
    orgId: 'org',
    registrationStatus: 'active',
    permissions: [],
    departments: [],
    propertyName: null,
    branches: [],
    branchCoverage: 'all',
    psfMembership: null,
    ...over,
  };
}

function personalSeat(kind: 'personal' | 'broker'): WorkspaceAccess {
  return {
    workspaceId: `ws-${kind}`,
    kind,
    orgId: null,
    orgName: null,
    domain: null,
    orgRole: null,
    registrationStatus: null,
    permissions: [],
    departments: [],
    propertyName: null,
    branches: [],
    branchCoverage: null,
    psfMembership: null,
  };
}

function grant(over: Partial<OversightConsoleGrant> = {}): OversightConsoleGrant {
  return {
    assignmentId: '5b7f0a52-3d0e-4d8e-9b8e-0c6f4a1d2e31',
    console: 'verification',
    oversightRole: 'business_field_verifier',
    bodyCode: 'PSF',
    bodyName: 'Private Sector Federation',
    title: 'Business Registration Officer',
    scopeLevel: 'district',
    provinceId: null,
    districtId: 102,
    sectorId: null,
    cellId: null,
    villageId: null,
    scopeLabel: 'Gasabo',
    ...over,
  };
}

const ROSTER = [
  { id: 'u-beatha', email: 'beatha@demo.injishi.rw', name: 'Beatha Mukeshimana' },
  { id: 'u-claudine', email: 'claudine@demo.injishi.rw', name: 'Claudine Mukamana' },
  { id: 'u-jeanbosco', email: 'jeanbosco@demo.injishi.rw', name: 'Jean-Bosco Nkurunziza' },
  { id: 'u-nobody', email: 'nobody@demo.injishi.rw', name: null },
  { id: 'u-ops', email: 'ops@demo.injishi.rw', name: 'Olivier Habimana' },
  { id: 'u-samuel', email: 'samuel@demo.injishi.rw', name: 'Samuel Kayitare' },
];

function controller(environment: 'demo' | 'production' = 'demo'): DemoPersonasController {
  const held: Record<string, WorkspaceAccess[]> = {
    'u-beatha': [business({ orgName: 'Amahoro Hospitality Group', orgRole: 'housekeeper', domain: 'hospitality' })],
    'u-samuel': [
      personalSeat('personal'),
      personalSeat('broker'),
      business({ orgName: 'Kivu Crest Hotel', orgRole: 'housekeeper', domain: 'hospitality' }),
      business({ orgName: 'Umurage Guesthouse', orgRole: 'owner', domain: 'hospitality' }),
      business({ orgName: 'Kayitare Court', orgRole: 'owner', domain: 'residence', registrationStatus: 'submitted' }),
    ],
  };
  const grants: Record<string, OversightConsoleGrant[]> = {
    // The same posting twice reads as one seat.
    'u-jeanbosco': [grant(), grant({ assignmentId: 'dup' })],
    'u-claudine': [
      grant({ console: 'approval', oversightRole: 'business_approver', bodyCode: 'MINALOC', title: 'BDO' }),
    ],
  };

  const select = vi
    .fn()
    .mockReturnValueOnce(query(ROSTER))
    // Samuel's department positions: head of front office at the guesthouse.
    .mockReturnValue(
      query([{ workspaceId: 'ws-Umurage Guesthouse-owner', position: 'department_head', department: 'Front Office' }]),
    );
  const db = { select } as unknown as Database;

  const workspaces = {
    listForUser: vi.fn((id: string) => Promise.resolve(held[id] ?? [])),
    oversightConsoleGrantsForUser: vi.fn((id: string) => Promise.resolve(grants[id] ?? [])),
    staffAccessForUser: vi.fn((id: string) =>
      Promise.resolve(
        id === 'u-ops'
          ? { isStaff: true, roles: ['ops'], permissions: [] }
          : { isStaff: false, roles: [], permissions: [] },
      ),
    ),
  } as unknown as WorkspaceService;

  return new DemoPersonasController({ environment } as unknown as Platform, db, workspaces);
}

describe('DemoPersonasController.list', () => {
  it('is a 404 off the demo', async () => {
    await expect(controller('production').list()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers the contract shape, with a worded role on every seat', async () => {
    const personas = await controller().list();
    expect(() => DemoPersona.array().parse(personas)).not.toThrow();
    for (const p of personas) {
      for (const seat of p.seats) {
        expect(seat.role.length).toBeGreaterThan(0);
        expect(seat.roleKey.length).toBeGreaterThan(0);
      }
    }
  });

  it('lists a person who is only a government officer, as an oversight seat', async () => {
    const personas = await controller().list();
    const jb = personas.find((p) => p.email === 'jeanbosco@demo.injishi.rw');
    expect(jb?.seats).toEqual([
      {
        label: 'PSF · Gasabo district',
        surface: 'oversight',
        role: 'Document reviewer',
        roleKey: 'business_field_verifier',
        detail: 'Business Registration Officer',
      },
    ]);
    const claudine = personas.find((p) => p.email === 'claudine@demo.injishi.rw');
    expect(claudine?.seats.map((s) => s.role)).toEqual(['Approver']);
  });

  it('keeps every seat of a multi-seat persona, in rank order, with detail', async () => {
    const personas = await controller().list();
    const samuel = personas.find((p) => p.email === 'samuel@demo.injishi.rw');
    expect(samuel?.seats.map((s) => `${s.role} @ ${s.label}`)).toEqual([
      'Owner @ Umurage Guesthouse',
      'Owner @ Kayitare Court',
      'Housekeeper @ Kivu Crest Hotel',
      'Guest / tenant @ Personal',
      'Broker @ Brokerage',
    ]);
    expect(samuel?.seats[0].detail).toBe('Head of Front Office');
    expect(samuel?.seats[1].detail).toBe('Not yet approved (submitted)');
  });

  it('words the staff seat and the business roles', async () => {
    const personas = await controller().list();
    const ops = personas.find((p) => p.email === 'ops@demo.injishi.rw');
    expect(ops?.seats).toEqual([
      { label: 'Admin console', surface: 'staff', role: 'Platform staff · Ops', roleKey: 'staff', detail: null },
    ]);
    const beatha = personas.find((p) => p.email === 'beatha@demo.injishi.rw');
    expect(beatha?.seats[0]).toMatchObject({ role: 'Housekeeper', surface: 'work' });
    const receptionist = __testing.workspaceSeat(
      business({ orgName: 'Amahoro Hospitality Group', orgRole: 'receptionist', domain: 'hospitality' }),
      [],
    );
    expect(receptionist).toMatchObject({ surface: 'host', roleKey: 'receptionist', detail: null });
    expect(receptionist.role).toContain('Receptionist');
  });

  it('leaves out a persona with no seat at all', async () => {
    const personas = await controller().list();
    expect(personas.find((p) => p.email === 'nobody@demo.injishi.rw')).toBeUndefined();
  });
});

describe('oversightSeats', () => {
  it('words province and country scopes', () => {
    const seats = __testing.oversightSeats([
      grant({ scopeLevel: 'province', provinceId: 1, districtId: null, scopeLabel: 'KIGALI' }),
      grant({ scopeLevel: 'country', provinceId: null, districtId: null, scopeLabel: 'Rwanda', oversightRole: 'tax_compliance_officer', bodyCode: 'RRA', title: null, bodyName: 'Rwanda Revenue Authority' }),
    ]);
    expect(seats.map((s) => [s.label, s.role, s.detail])).toEqual([
      ['PSF · Kigali province', 'Document reviewer', 'Business Registration Officer'],
      ['RRA · Rwanda', 'Tax compliance officer', 'Rwanda Revenue Authority'],
    ]);
  });
});
