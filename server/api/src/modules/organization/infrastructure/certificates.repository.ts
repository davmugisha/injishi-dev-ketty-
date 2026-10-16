import type { OrgCertificateKind } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { orgCertificates, orgs, properties } from '../../../database/drizzle/schema';
import { inBranchScope, type BranchScope } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';

export interface CertificateRow {
  id: string;
  kind: OrgCertificateKind;
  kindOther: string | null;
  propertyId: string | null;
  propertyName: string | null;
  certificateNumber: string | null;
  issuedBy: string | null;
  issuedOn: string | null;
  expiresOn: string | null;
  status: 'requested' | 'on_file';
  followUp: string | null;
  objectKey: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

/**
 * The documents a business keeps about itself and its branches
 * (`org_certificates`): the ones it uploaded to register, and the ones it has
 * filed or asked for since.
 *
 * Scoped by the ORG the workspace belongs to, and then by the branches the
 * caller covers: a document about a branch they do not cover is not listed,
 * and a document about the whole business only for someone who covers every
 * branch (ADR-054 AC-T3, the rule `inBranchScope` keeps).
 */
@Injectable()
export class CertificatesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async org(
    orgId: string,
  ): Promise<{ legalName: string; tin: string | null; chamberOfTourismMember: boolean } | null> {
    const { rows } = await this.db.execute<{ legal_name: string; tin: string | null; chamber: boolean }>(sql`
      select legal_name, tin, chamber_of_tourism_member as chamber from ${orgs} where id = ${orgId}
    `);
    const row = rows[0];
    return row ? { legalName: row.legal_name, tin: row.tin, chamberOfTourismMember: row.chamber } : null;
  }

  async list(orgId: string, scope: BranchScope): Promise<CertificateRow[]> {
    const { rows } = await this.db.execute<{
      id: string;
      kind: OrgCertificateKind;
      kind_other: string | null;
      property_id: string | null;
      property_name: string | null;
      certificate_number: string | null;
      issued_by: string | null;
      issued_on: string | null;
      expires_on: string | null;
      status: 'requested' | 'on_file';
      follow_up: string | null;
      object_key: string | null;
      verified_at: Date | null;
      created_at: Date;
    }>(sql`
      select c.id, c.kind, c.kind_other, c.property_id, p.name as property_name,
             c.certificate_number, c.issued_by,
             to_char(c.issued_on, 'YYYY-MM-DD') as issued_on,
             to_char(c.expires_on, 'YYYY-MM-DD') as expires_on,
             c.status, c.follow_up, c.object_key, c.verified_at, c.created_at
        from ${orgCertificates} c
        left join ${properties} p on p.id = c.property_id
       where c.org_id = ${orgId}
         and ${inBranchScope(sql`c.property_id`, scope)}
       order by c.expires_on asc nulls last, c.created_at asc
    `);
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      kindOther: r.kind_other,
      propertyId: r.property_id,
      propertyName: r.property_name,
      certificateNumber: r.certificate_number,
      issuedBy: r.issued_by,
      issuedOn: r.issued_on,
      expiresOn: r.expires_on,
      status: r.status,
      followUp: r.follow_up,
      objectKey: r.object_key,
      verifiedAt: r.verified_at ? new Date(r.verified_at) : null,
      createdAt: new Date(r.created_at),
    }));
  }
}
