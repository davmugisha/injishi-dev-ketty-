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
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { districts, oversightAssignments, provinces, userProfiles, users } from '../../../database/drizzle/schema';
import { resolveAppUrl } from '../../../shared/config/app-url';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { appointmentMail } from '../../guests/domain/guest-mail';
import { MAILER_PORT, type MailerPort } from '../../mailer/domain/mailer-port';
import { PsfMembershipRepository } from '../infrastructure/psf-membership.repository';
import { isPsfConsoleRole } from './psf-membership.service';
import { AuditWriter } from '../../../shared/audit/audit-writer';

type Scope = number[] | null;

/** Where a PSF post sits: a Regional Manager over a province, the others in a district. */
type PsfPlace =
  | { level: 'province'; name: string; provinceId: number; districtId: null }
  | { level: 'district'; name: string; provinceId: number; districtId: number };

const ROLE_OF: Record<PsfTeamRole, 'psf_membership_officer' | 'psf_business_officer'> = {
  regional_manager: 'psf_membership_officer',
  district_manager: 'psf_membership_officer',
  business_officer: 'psf_business_officer',
};

/** A National Manager: PSF's membership post over the whole country. */
const isNational = (grants: OversightGrant[]): boolean =>
  grants.some((g) => g.oversightRole === 'psf_membership_officer' && g.scopeLevel === 'country');

const appointer = alias(users, 'psf_team_appointer');

/**
 * The PSF team (2026-11-02, the owner's decisions). Injishi's admin appoints
 * PSF's National Managers. A National Manager appoints Regional Managers, District
 * Managers and BDEs anywhere (2026-11-09); a Regional Manager appoints its own
 * districts' District Managers. Each ends the appointments it may make, with a
 * reason, and a District Manager reads its district's team. Every appointment
 * records the person's ID.
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
   * The districts a posting covers. `managers`: where a Regional or National Manager appoints District
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

  /**
   * Where the caller fills each post, as districts (a Regional Manager's province is checked apart). A
   * National Manager fills every post anywhere (2026-11-09); a Regional Manager only District Managers.
   */
  private async appointScopes(grants: OversightGrant[]): Promise<Record<PsfTeamRole, Scope>> {
    const national = isNational(grants);
    return {
      regional_manager: national ? null : [],
      district_manager: await this.scope(grants, 'managers'),
      business_officer: national ? null : [],
    };
  }

  async view(grants: OversightGrant[]): Promise<PsfTeamView> {
    const [appoint, own] = await Promise.all([this.scope(grants, 'managers'), this.scope(grants, 'district')]);
    const national = isNational(grants);
    const fills: PsfTeamRole[] = national
      ? ['regional_manager', 'district_manager', 'business_officer']
      : appoint === null || appoint.length > 0
        ? ['district_manager']
        : [];
    // A manager's screen (2026-11-02): a BDE does not read it. A District Manager reads its district's.
    if (fills.length === 0 && own !== null && own.length === 0) throw new ForbiddenException('The team is kept by your PSF District and Regional Managers.');
    const read = appoint === null || own === null ? null : [...new Set([...appoint, ...own])];
    const inRead = read === null ? undefined : inArray(oversightAssignments.districtId, read.length ? read : [-1]);
    const inAppoint = appoint === null ? undefined : inArray(districts.id, appoint.length ? appoint : [-1]);
    const [members, places, provinceList] = await Promise.all([
      this.db
        .select({
          assignmentId: oversightAssignments.id,
          role: oversightAssignments.oversightRole,
          title: oversightAssignments.governmentTitle,
          districtId: oversightAssignments.districtId,
          districtName: districts.name,
          provinceId: oversightAssignments.provinceId,
          provinceName: provinces.name,
          scopeLevel: oversightAssignments.scopeLevel,
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
        .leftJoin(provinces, eq(provinces.id, oversightAssignments.provinceId))
        .leftJoin(appointer, eq(appointer.id, oversightAssignments.assignedByUserId))
        .where(
          and(
            isNull(oversightAssignments.revokedAt),
            inArray(oversightAssignments.oversightRole, ['psf_membership_officer', 'psf_business_officer']),
            // District posts in the caller's area; a National Manager also reads the Regional Managers.
            national
              ? or(
                  eq(oversightAssignments.scopeLevel, 'district'),
                  and(
                    eq(oversightAssignments.scopeLevel, 'province'),
                    eq(oversightAssignments.oversightRole, 'psf_membership_officer'),
                  ),
                )
              : and(eq(oversightAssignments.scopeLevel, 'district'), inRead),
          ),
        )
        .orderBy(asc(provinces.name), asc(districts.name), asc(oversightAssignments.oversightRole), asc(users.name)),
      this.db
            .select({ id: districts.id, name: districts.name, provinceName: provinces.name })
            .from(districts)
            .leftJoin(provinces, eq(provinces.id, districts.provinceId))
            .where(inAppoint)
            .orderBy(asc(provinces.name), asc(districts.name)),
      national
        ? this.db.select({ id: provinces.id, name: provinces.name }).from(provinces).orderBy(asc(provinces.name))
        : Promise.resolve([] as { id: number; name: string }[]),
    ]);
    return {
      canAppoint: fills.length > 0,
      appointRoles: fills,
      districts: places.map((p) => ({ id: p.id, name: p.name, provinceName: p.provinceName ?? null })),
      provinces: provinceList,
      members: members
        .filter((m) => (m.scopeLevel === 'province' ? m.provinceId !== null : m.districtId !== null))
        .map((m) => ({
          assignmentId: m.assignmentId,
          name: m.name ?? null,
          email: m.email,
          role:
            m.role === 'psf_business_officer'
              ? ('business_officer' as const)
              : m.scopeLevel === 'province'
                ? ('regional_manager' as const)
                : ('district_manager' as const),
          title: m.title ?? null,
          districtId: m.scopeLevel === 'province' ? null : m.districtId,
          districtName: m.scopeLevel === 'province' ? null : (m.districtName ?? null),
          provinceId: m.provinceId ?? null,
          provinceName: m.provinceName ?? null,
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
    const refusal =
      body.role === 'regional_manager'
        ? 'Regional Managers are appointed by PSF’s National Manager.'
        : body.role === 'district_manager'
          ? 'District Managers are appointed by the PSF Regional Manager, in its own province.'
          : 'BDEs are appointed by PSF’s National Manager or Injishi’s admin.';
    // A post at a level: a Regional Manager over a province, the others in a district.
    const place =
      body.role === 'regional_manager'
        ? await this.provinceOf(body.provinceId)
        : await this.districtOf(body.districtId, appoint, refusal);
    if (body.role === 'regional_manager' && appoint !== null) throw new ForbiddenException(refusal);
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
      // One PSF post per person per place: a BDE made District Manager is ended first.
      const [held] = await tx
        .select({ id: oversightAssignments.id, role: oversightAssignments.oversightRole })
        .from(oversightAssignments)
        .where(
          and(
            eq(oversightAssignments.userId, userId),
            place.level === 'province'
              ? and(eq(oversightAssignments.scopeLevel, 'province'), eq(oversightAssignments.provinceId, place.provinceId))
              : eq(oversightAssignments.districtId, place.districtId as number),
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
          scopeLevel: place.level,
          provinceId: place.provinceId,
          districtId: place.districtId,
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
        payloadDiff: {
          oversight: {
            assignmentId: created.id,
            oversightRole: role,
            governmentBodyCode: 'PSF',
            scopeLevel: place.level,
            provinceId: place.provinceId,
            districtId: place.districtId,
          },
        } as never,
        reason: body.reason,
        districtId: place.districtId,
      });
    });

    void this.tell(email, title, place.level === 'province' ? place.name : `${place.name} district`);
    return this.view(grants);
  }

  private async provinceOf(provinceId: number | undefined): Promise<PsfPlace> {
    const [p] = provinceId
      ? await this.db.select({ id: provinces.id, name: provinces.name }).from(provinces).where(eq(provinces.id, provinceId)).limit(1)
      : [];
    if (!p) throw new NotFoundException('That province was not found.');
    return { level: 'province' as const, name: p.name, provinceId: p.id, districtId: null };
  }

  private async districtOf(districtId: number | undefined, appoint: Scope, refusal: string): Promise<PsfPlace> {
    if (!districtId) throw new NotFoundException('That district was not found.');
    if (appoint !== null && !appoint.includes(districtId)) throw new ForbiddenException(refusal);
    const [d] = await this.db
      .select({ id: districts.id, name: districts.name, provinceId: districts.provinceId })
      .from(districts)
      .where(eq(districts.id, districtId))
      .limit(1);
    if (!d) throw new NotFoundException('That district was not found.');
    return { level: 'district' as const, name: d.name, provinceId: d.provinceId, districtId: d.id };
  }

  /**
   * End an appointment, with a reason, never a delete: a National Manager any PSF post; a Regional Manager
   * any District Manager's or BDE's in its province.
   */
  async end(actorUserId: string, grants: OversightGrant[], assignmentId: string, reason: string): Promise<PsfTeamView> {
    const scopes = await this.appointScopes(grants);
    const [row] = await this.db
      .select({ id: oversightAssignments.id, userId: oversightAssignments.userId, role: oversightAssignments.oversightRole, districtId: oversightAssignments.districtId, scopeLevel: oversightAssignments.scopeLevel })
      .from(oversightAssignments)
      .where(and(eq(oversightAssignments.id, assignmentId), isNull(oversightAssignments.revokedAt)))
      .limit(1);
    const regional = row?.scopeLevel === 'province' && row.role === 'psf_membership_officer';
    if (!row || (!regional && (row.scopeLevel !== 'district' || row.districtId === null)) || !isPsfConsoleRole(row.role)) {
      throw new NotFoundException('No current Regional Manager, District Manager or BDE appointment has that id.');
    }
    const covers = (scope: Scope): boolean => scope === null || (row.districtId !== null && scope.includes(row.districtId));
    // A Regional Manager's post and a BDE's end where the National Manager appoints them; a District
    // Manager's where its Regional Manager does.
    const mayEnd = regional
      ? scopes.regional_manager === null
      : row.role === 'psf_business_officer'
        ? covers(scopes.business_officer) || covers(scopes.district_manager)
        : covers(scopes.district_manager);
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
      const [profile] = await this.db
        .select({ locale: userProfiles.locale })
        .from(users)
        .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
        .where(sql`lower(${users.email}) = lower(${email})`)
        .limit(1);
      const mail = appointmentMail({
        appUrl: this.appUrl,
        roleLabel: `PSF ${roleLabel}`,
        area,
        next: '/psf',
        locale: profile?.locale === 'fr' || profile?.locale === 'rw' ? profile.locale : 'en',
      });
      await this.mailer.send({ to: email, subject: mail.subject, text: mail.text, html: mail.html });
    } catch (cause) {
      this.log.error(`PSF team appointment mail to ${email} failed: ${cause instanceof Error ? cause.message : 'failed'}.`);
    }
  }
}

