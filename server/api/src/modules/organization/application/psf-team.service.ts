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

import { auditEvents, districts, oversightAssignments, provinces, users } from '../../../database/drizzle/schema';
import { resolveAppUrl } from '../../../shared/config/app-url';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { appointmentMail } from '../../guests/domain/guest-mail';
import { MAILER_PORT, type MailerPort } from '../../mailer/domain/mailer-port';
import { PsfMembershipRepository } from '../infrastructure/psf-membership.repository';
import { isPsfConsoleRole } from './psf-membership.service';

type Scope = number[] | null;

const ROLE_OF: Record<PsfTeamRole, 'psf_membership_officer' | 'psf_business_officer'> = {
  district_manager: 'psf_membership_officer',
  business_officer: 'psf_business_officer',
};

const appointer = alias(users, 'psf_team_appointer');

/**
 * The PSF team (2026-11-02, the owner's decisions). Injishi's admin appoints
 * PSF's Province and National Managers; a Province Manager appoints its own
 * districts' District Managers and District Business Officers (DBOs), and ends
 * those appointments with a reason. A National Manager may do so anywhere.
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

  /** The districts a posting reads (a DBO's included), or where it appoints (a Province or National Manager's). */
  private async scope(grants: OversightGrant[], appointing: boolean): Promise<Scope> {
    const own = grants.filter((g) =>
      appointing ? g.oversightRole === 'psf_membership_officer' && g.scopeLevel !== 'district' : isPsfConsoleRole(g.oversightRole),
    );
    const provinceIds = [...new Set(own.filter((g) => g.scopeLevel === 'province' && g.provinceId !== null).map((g) => g.provinceId as number))];
    return districtScopeOf(own, await this.repo.districtsByProvince(provinceIds));
  }

  async view(grants: OversightGrant[]): Promise<PsfTeamView> {
    const [read, appoint] = await Promise.all([this.scope(grants, false), this.scope(grants, true)]);
    // The Province Manager's screen alone (2026-11-02): a District Manager or DBO does not read it.
    if (appoint !== null && appoint.length === 0) {
      throw new ForbiddenException('The team is kept by your PSF Province Manager.');
    }
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
      appoint !== null && appoint.length === 0
        ? Promise.resolve([])
        : this.db
            .select({ id: districts.id, name: districts.name, provinceName: provinces.name })
            .from(districts)
            .leftJoin(provinces, eq(provinces.id, districts.provinceId))
            .where(inAppoint)
            .orderBy(asc(provinces.name), asc(districts.name)),
    ]);
    return {
      canAppoint: appoint === null || appoint.length > 0,
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
        })),
    };
  }

  async appoint(actorUserId: string, grants: OversightGrant[], body: AppointPsfTeamRequest): Promise<PsfTeamView> {
    const appoint = await this.scope(grants, true);
    if (appoint !== null && !appoint.includes(body.districtId)) {
      throw new ForbiddenException('You appoint the District Managers and DBOs of your own province only.');
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
      // One PSF post per person per district: a DBO made District Manager is ended first.
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
        })
        .returning({ id: oversightAssignments.id });
      if (!created) throw new Error('Appointment insert returned no row.');
      await tx.insert(auditEvents).values({
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

  /** End a District Manager's or DBO's appointment in the caller's province, with a reason. Never a delete. */
  async end(actorUserId: string, grants: OversightGrant[], assignmentId: string, reason: string): Promise<PsfTeamView> {
    const appoint = await this.scope(grants, true);
    const [row] = await this.db
      .select({ id: oversightAssignments.id, userId: oversightAssignments.userId, role: oversightAssignments.oversightRole, districtId: oversightAssignments.districtId, scopeLevel: oversightAssignments.scopeLevel })
      .from(oversightAssignments)
      .where(and(eq(oversightAssignments.id, assignmentId), isNull(oversightAssignments.revokedAt)))
      .limit(1);
    if (!row || row.scopeLevel !== 'district' || row.districtId === null || !isPsfConsoleRole(row.role)) {
      throw new NotFoundException('No current District Manager or DBO appointment has that id.');
    }
    if (appoint !== null && !appoint.includes(row.districtId)) {
      throw new ForbiddenException('You end appointments in your own province only.');
    }
    if (row.userId === actorUserId) throw new ConflictException('You cannot end your own appointment.');
    await this.db.transaction(async (tx) => {
      await tx.update(oversightAssignments).set({ revokedAt: new Date() }).where(eq(oversightAssignments.id, row.id));
      await tx.insert(auditEvents).values({
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

