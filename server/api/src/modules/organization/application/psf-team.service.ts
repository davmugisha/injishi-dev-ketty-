import {
  PSF_TEAM_ROLE_LABEL,
  districtScopeOf,
  type AppointPsfTeamRequest,
  type OversightGrant,
  type PsfTeamRole,
  type PsfTeamView,
} from '@injishi/contracts';
import { ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { districts, oversightAssignments, provinces, users } from '../../../database/drizzle/schema';
import { resolveAppUrl } from '../../../shared/config/app-url';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { appointmentMail } from '../../guests/domain/guest-mail';
import { MAILER_PORT, type MailerPort } from '../../mailer/domain/mailer-port';
import { PsfMembershipRepository } from '../infrastructure/psf-membership.repository';
import { isPsfConsoleRole } from './psf-membership.service';
import { AuditWriter } from '../../../shared/audit/audit-writer';

type Scope = number[] | null;

const ROLE_OF: Record<PsfTeamRole, 'psf_membership_officer' | 'psf_business_officer'> = {
  district_manager: 'psf_membership_officer',
  business_officer: 'psf_business_officer',
};

const appointer = alias(users, 'psf_team_appointer');

/**
 * The PSF team (2026-11-02, the owner's decisions). Injishi's admin appoints
 * PSF's Province and National Managers; a Province Manager appoints its own
 * districts' District Managers, and a District Manager its own district's BDEs
 * (Business Development & Empowerment). Each ends the appointments it makes,
 * with a reason; a Province Manager may end any in its province. A National
 * Manager may do so anywhere. Every appointment records the person's ID.
 *
 * Every appointment is an `oversight_assignments` row at PSF, district level,
 * with an audit event, exactly as the admin console writes one; what differs
 * is who may write it.
 */
@Injectable()
export class PsfTeamService {
  private readonly log = new Logger(PsfTeamService.name);
  private readonly appUrl: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly repo: PsfMembershipRepository,
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
    config: ConfigService,
  ) {
    this.appUrl = resolveAppUrl({ appUrl: config.get<string>('APP_URL'), nodeEnv: config.get<string>('NODE_ENV') });
  }

  /**
   * The districts a posting covers. `managers`: where a Province or National Manager appoints District
   * Managers. `district`: a District Manager's own districts, where it appoints BDEs. `read`: every PSF
   * console posting's, a BDE's included.
   */
  private async scope(grants: OversightGrant[], which: 'managers' | 'district' | 'read'): Promise<Scope> {
    const own = grants.filter((g) =>
      which === 'managers'
        ? g.oversightRole === 'psf_membership_officer' && g.scopeLevel !== 'district'
        : which === 'district'
          ? g.oversightRole === 'psf_membership_officer' && g.scopeLevel === 'district'
          : isPsfConsoleRole(g.oversightRole),
    );
    const provinceIds = [...new Set(own.filter((g) => g.scopeLevel === 'province' && g.provinceId !== null).map((g) => g.provinceId as number))];
    return districtScopeOf(own, await this.repo.districtsByProvince(provinceIds));
  }

  /** Where the caller fills each post: District Managers from a province, BDEs from a district. */
  private async appointScopes(grants: OversightGrant[]): Promise<Record<PsfTeamRole, Scope>> {
    const [managers, district] = await Promise.all([this.scope(grants, 'managers'), this.scope(grants, 'district')]);
    return { district_manager: managers, business_officer: district };
  }

  async view(grants: OversightGrant[]): Promise<PsfTeamView> {
    const scopes = await this.appointScopes(grants);
    const fills = (Object.keys(scopes) as PsfTeamRole[]).filter((r) => scopes[r] === null || scopes[r]!.length > 0);
    // A manager's screen (2026-11-02): a BDE does not read it.
    if (fills.length === 0) throw new ForbiddenException('The team is kept by your PSF District and Province Managers.');
    // What the caller sees: the districts it appoints in, for either post.
    const read = fills.some((r) => scopes[r] === null) ? null : [...new Set(fills.flatMap((r) => scopes[r] as number[]))];
    const appoint = read;
    const inRead = read === null ? undefined : inArray(oversightAssignments.districtId, read.length ? read : [-1]);
    const inAppoint = appoint === null ? undefined : inArray(districts.id, appoint.length ? appoint : [-1]);
    const [members, places] = await Promise.all([
      this.db
        .select({
          assignmentId: oversightAssignments.id,
          role: oversightAssignments.oversightRole,
          title: oversightAssignments.governmentTitle,
          districtId: oversightAssignments.districtId,
          districtName: districts.name,
          appointedAt: oversightAssignments.grantedAt,
          name: users.name,
          email: users.email,
          appointedByName: appointer.name,
          idType: oversightAssignments.idDocumentType,
          idNumber: oversightAssignments.idDocumentNumber,
        })
        .from(oversightAssignments)
        .innerJoin(users, eq(users.id, oversightAssignments.userId))
        .leftJoin(districts, eq(districts.id, oversightAssignments.districtId))
        .leftJoin(appointer, eq(appointer.id, oversightAssignments.assignedByUserId))
        .where(
          and(
            isNull(oversightAssignments.revokedAt),
            eq(oversightAssignments.scopeLevel, 'district'),
            inArray(oversightAssignments.oversightRole, ['psf_membership_officer', 'psf_business_officer']),
            inRead,
          ),
        )
        .orderBy(asc(districts.name), asc(oversightAssignments.oversightRole), asc(users.name)),
      this.db
            .select({ id: districts.id, name: districts.name, provinceName: provinces.name })
            .from(districts)
            .leftJoin(provinces, eq(provinces.id, districts.provinceId))
            .where(inAppoint)
            .orderBy(asc(provinces.name), asc(districts.name)),
    ]);
    return {
      canAppoint: true,
      appointRoles: fills,
      districts: places.map((p) => ({ id: p.id, name: p.name, provinceName: p.provinceName ?? null })),
      members: members
        .filter((m) => m.districtId !== null)
        .map((m) => ({
          assignmentId: m.assignmentId,
          name: m.name ?? null,
          email: m.email,
          role: m.role === 'psf_business_officer' ? ('business_officer' as const) : ('district_manager' as const),
          title: m.title ?? null,
          districtId: m.districtId as number,
          districtName: m.districtName ?? null,
          appointedAt: m.appointedAt.toISOString(),
          appointedByName: m.appointedByName ?? null,
          idDocumentLine: m.idNumber
            ? `${m.idType === 'passport' ? 'Passport' : 'National ID'} ending ${m.idNumber.slice(-4)}`
            : null,
        })),
    };
  }

  async appoint(actorUserId: string, grants: OversightGrant[], body: AppointPsfTeamRequest): Promise<PsfTeamView> {
    const appoint = (await this.appointScopes(grants))[body.role];
    if (appoint !== null && !appoint.includes(body.districtId)) {
      throw new ForbiddenException(
        body.role === 'district_manager'
          ? 'District Managers are appointed by the PSF Province Manager, in its own province.'
          : 'BDEs are appointed by the PSF District Manager, in its own district.',
      );
    }
    const [place] = await this.db
      .select({ id: districts.id, name: districts.name, provinceId: districts.provinceId })
      .from(districts)
      .where(eq(districts.id, body.districtId))
      .limit(1);
    if (!place) throw new NotFoundException('That district was not found.');
    const role = ROLE_OF[body.role];
    const title = PSF_TEAM_ROLE_LABEL[body.role];
    const email = body.email.trim().toLowerCase();

    await this.db.transaction(async (tx) => {
      const [found] = await tx.select({ id: users.id, name: users.name }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
      let userId = found?.id;
      if (!userId) {
        const [created] = await tx.insert(users).values({ email, emailVerified: false, name: body.name }).returning({ id: users.id });
        if (!created) throw new Error('User insert returned no row.');
        userId = created.id;
      } else if (!found?.name?.trim()) {
        await tx.update(users).set({ name: body.name, updatedAt: new Date() }).where(eq(users.id, userId));
      }
      // One PSF post per person per district: a BDE made District Manager is ended first.
      const [held] = await tx
        .select({ id: oversightAssignments.id, role: oversightAssignments.oversightRole })
        .from(oversightAssignments)
        .where(
          and(
            eq(oversightAssignments.userId, userId),
            eq(oversightAssignments.districtId, place.id),
            inArray(oversightAssignments.oversightRole, ['psf_membership_officer', 'psf_business_officer']),
            isNull(oversightAssignments.revokedAt),
          ),
        )
        .limit(1);
      if (held?.role === role) throw new ConflictException(`They are already the ${title} for ${place.name}.`);
      if (held) {
        throw new ConflictException(
          `They already hold another PSF post in ${place.name}. End it first, then appoint them as ${title}.`,
        );
      }
      const [created] = await tx
        .insert(oversightAssignments)
        .values({
          userId,
          oversightRole: role,
          governmentBodyCode: 'PSF',
          governmentTitle: title,
          scopeLevel: 'district',
          provinceId: place.provinceId,
          districtId: place.id,
          assignedByUserId: actorUserId,
          idDocumentType: body.idDocument.documentType,
          idDocumentNumber: body.idDocument.documentNumber,
        })
        .returning({ id: oversightAssignments.id });
      if (!created) throw new Error('Appointment insert returned no row.');
      await AuditWriter.write(tx, {
        actorUserId,
        subjectType: 'user',
        subjectId: userId,
        eventType: 'psf.team.appointed',
        payloadDiff: { oversight: { assignmentId: created.id, oversightRole: role, governmentBodyCode: 'PSF', scopeLevel: 'district', districtId: place.id } } as never,
        reason: body.reason,
        districtId: place.id,
      });
    });

    void this.tell(email, title, `${place.name} district`);
    return this.view(grants);
  }

  /**
   * End an appointment, with a reason, never a delete: a Province Manager any District Manager's or BDE's
   * in its province, a District Manager a BDE's in its district.
   */
  async end(actorUserId: string, grants: OversightGrant[], assignmentId: string, reason: string): Promise<PsfTeamView> {
    const scopes = await this.appointScopes(grants);
    const [row] = await this.db
      .select({ id: oversightAssignments.id, userId: oversightAssignments.userId, role: oversightAssignments.oversightRole, districtId: oversightAssignments.districtId, scopeLevel: oversightAssignments.scopeLevel })
      .from(oversightAssignments)
      .where(and(eq(oversightAssignments.id, assignmentId), isNull(oversightAssignments.revokedAt)))
      .limit(1);
    if (!row || row.scopeLevel !== 'district' || row.districtId === null || !isPsfConsoleRole(row.role)) {
      throw new NotFoundException('No current District Manager or BDE appointment has that id.');
    }
    const covers = (scope: Scope): boolean => scope === null || scope.includes(row.districtId as number);
    const mayEnd = covers(scopes.district_manager) || (row.role === 'psf_business_officer' && covers(scopes.business_officer));
    if (!mayEnd) throw new ForbiddenException('You end the appointments you may make, in your own area only.');
    if (row.userId === actorUserId) throw new ConflictException('You cannot end your own appointment.');
    await this.db.transaction(async (tx) => {
      await tx.update(oversightAssignments).set({ revokedAt: new Date() }).where(eq(oversightAssignments.id, row.id));
      await AuditWriter.write(tx, {
        actorUserId,
        subjectType: 'user',
        subjectId: row.userId,
        eventType: 'psf.team.ended',
        payloadDiff: { oversight: { assignmentId: row.id, oversightRole: row.role, governmentBodyCode: 'PSF' } } as never,
        reason,
        districtId: row.districtId,
      });
    });
    return this.view(grants);
  }

  /** The appointment email. Best effort: the post stands whatever happens to the mail. */
  private async tell(email: string, roleLabel: string, area: string): Promise<void> {
    try {
      const mail = appointmentMail({ appUrl: this.appUrl, roleLabel: `PSF ${roleLabel}`, area, next: '/psf' });
      await this.mailer.send({ to: email, subject: mail.subject, text: mail.text, html: mail.html });
    } catch (cause) {
      this.log.error(`PSF team appointment mail to ${email} failed: ${cause instanceof Error ? cause.message : 'failed'}.`);
    }
  }
}

