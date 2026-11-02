import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type AppointOfficerRequest,
  LEADER_ROLE_LABEL,
  LEADER_ROLE_SCOPE,
  CHAIN_ROLES,
  type LeaderCoverage,
  type LeaderRole,
  OVERSIGHT_COUNTRY_SCOPE_LABEL,
  OVERSIGHT_ROLE_LABEL,
  OVERSIGHT_ROLE_POSTING,
  OVERSIGHT_ROLE_SCOPES,
  type OversightAppointment,
  type OversightAppointmentList,
  type OversightAppointmentQuery,
  type OversightScopeLevel,
  type WaitingArea,
  appointmentKindOf,
  isLeaderRole,
  kigaliToday,
  tidyPlaceName,
} from '@injishi/contracts';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { auditEvents, oversightAssignments, users } from '../../../database/drizzle/schema';
import { GuestRoutingService } from '../../../modules/guests/application/guest-routing.service';
import { appointmentMail } from '../../../modules/guests/domain/guest-mail';
import { placeWords, toCsv } from '../../../modules/guests/domain/guest-words';
import { GuestNotifier } from '../../../modules/guests/infrastructure/guest-notifier';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { type AppointmentRow, LocalLeadersRepository, type ResolvedArea, type WaitingRow } from './local-leaders.repository';
import { OversightGrantsService } from './oversight-grants.service';

/** The area of an appointment in words: village up to district, or the province, or Rwanda. */
/** Each level's name as people write it. */
function tidyNames<T extends Record<string, string | null>>(names: T): T {
  return Object.fromEntries(Object.entries(names).map(([k, v]) => [k, v ? tidyPlaceName(v) : v])) as T;
}

export function appointmentArea(row: Pick<AppointmentRow, 'scopeLevel' | 'provinceName' | 'districtName' | 'sectorName' | 'cellName' | 'villageName'>): string {
  if (row.scopeLevel === 'country') return OVERSIGHT_COUNTRY_SCOPE_LABEL;
  if (row.scopeLevel === 'province') return row.provinceName ? tidyPlaceName(row.provinceName) : 'Province';
  return (
    placeWords({
      villageName: row.scopeLevel === 'village' ? row.villageName : null,
      cellName: row.scopeLevel === 'village' || row.scopeLevel === 'cell' ? row.cellName : null,
      sectorName: row.scopeLevel === 'district' ? null : row.sectorName,
      districtName: row.districtName,
    }) || 'Area not on record'
  );
}

function presentAppointment(row: AppointmentRow): OversightAppointment {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role,
    roleLabel: isLeaderRole(row.role)
      ? LEADER_ROLE_LABEL[row.role]
      : // A PSF manager is named by the level they are posted at (2026-11-02).
        row.role === 'psf_membership_officer' && row.scopeLevel === 'province'
        ? 'PSF Province Manager'
        : row.role === 'psf_membership_officer' && row.scopeLevel === 'country'
          ? 'PSF National Manager'
          : OVERSIGHT_ROLE_LABEL[row.role],
    kind: appointmentKindOf(row.role),
    bodyCode: row.bodyCode,
    bodyName: row.bodyName,
    title: row.title,
    scopeLevel: row.scopeLevel as OversightScopeLevel,
    area: appointmentArea(row),
    provinceId: row.provinceId,
    districtId: row.districtId,
    sectorId: row.sectorId,
    cellId: row.cellId,
    villageId: row.villageId,
    grantedAt: new Date(row.grantedAt).toISOString(),
    grantedBy: row.grantedBy,
    delivered: row.delivered,
    seen: row.seen,
  };
}

function presentWaiting(w: WaitingRow): WaitingArea {
  const level = LEADER_ROLE_SCOPE[w.role];
  const located = level === 'village' ? w.villageId !== null : level === 'cell' ? w.cellId !== null : level === 'sector' ? w.sectorId !== null : w.districtId !== null;
  const known = placeWords({
    villageName: level === 'village' ? w.villageName : null,
    cellName: level === 'village' || level === 'cell' ? w.cellName : null,
    sectorName: level === 'district' ? null : w.sectorName,
    districtName: w.districtName,
  });
  const missing = level === 'village' ? 'No village on record' : level === 'cell' ? 'No cell on record' : 'Not on record';
  return {
    role: w.role,
    roleLabel: LEADER_ROLE_LABEL[w.role],
    level,
    area: located ? known : [missing, known].filter(Boolean).join(', '),
    located,
    provinceId: w.provinceId,
    districtId: w.districtId,
    sectorId: w.sectorId,
    cellId: w.cellId,
    villageId: w.villageId,
    names: tidyNames({ province: w.provinceName, district: w.districtName, sector: w.sectorName, cell: w.cellName, village: w.villageName }),
    reports: w.reports,
    oldestArrival: w.oldestArrival,
  };
}

/**
 * Local leaders and officers, appointed by Injishi admin (P5).
 *
 * One list of every oversight appointment: the local leaders a guest is
 * reported to, the business reviewers, and the other officers. A person is
 * appointed by email (found, or created to sign in with an emailed code) to a
 * role, a government body, that body's own title for the post, and an area at
 * the level the role covers; a business reviewer still passes the separation
 * of duties and conflict of interest rules. Ending an appointment says why
 * and keeps the row (`revoked_at`). Both write their `audit_events` row in the
 * same transaction, and both are `admin.user.role.grant` behind the staff
 * step-up (the controller's guard).
 *
 * Appointing a local leader hands them the guests that waited for one in
 * their area; ending one hands current guests to the next holder of the post,
 * or back to waiting.
 */
@Injectable()
export class LocalLeadersService {
  private readonly log = new Logger(LocalLeadersService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly repo: LocalLeadersRepository,
    private readonly grants: OversightGrantsService,
    private readonly routing: GuestRoutingService,
    private readonly notifier: GuestNotifier,
  ) {}

  /** The clock, as a method so a test can pin it. */
  protected now(): Date {
    return new Date();
  }

  async list(query: OversightAppointmentQuery): Promise<OversightAppointmentList> {
    const [rows, waiting] = await Promise.all([
      this.repo.list(query),
      this.repo.waiting(kigaliToday(this.now()), isLeaderRole(query.role ?? '') ? query : { ...query, role: undefined }),
    ]);
    const appointments = rows.map(presentAppointment);
    const counts = { leader: 0, reviewer: 0, officer: 0 };
    for (const a of appointments) counts[a.kind] += 1;
    const shownWaiting = query.kind && query.kind !== 'leader' ? [] : waiting;
    return {
      appointments,
      counts,
      waiting: shownWaiting.slice(0, 100).map(presentWaiting),
      waitingReports: shownWaiting.reduce((n, w) => n + w.reports, 0),
    };
  }

  /** Every level of the area the request names, checked against the map. */
  private async area(body: AppointOfficerRequest): Promise<ResolvedArea> {
    if (body.scopeLevel === 'country') return { provinceId: null, districtId: null, sectorId: null, cellId: null, villageId: null };
    const id = { province: body.provinceId, district: body.districtId, sector: body.sectorId, cell: body.cellId, village: body.villageId }[body.scopeLevel];
    const field = `${body.scopeLevel}Id`;
    const where = { province: 'province', district: 'district', sector: 'sector', cell: 'cell', village: 'village' }[body.scopeLevel];
    if (!id) throw this.fieldError(field, `Pick the ${where}.`);
    const area = await this.repo.resolve(body.scopeLevel, id);
    if (!area) throw this.fieldError(field, `That ${where} does not exist. Pick one from the list.`);
    // Any level above that the form sent must be the one the place is in.
    const above: [keyof ResolvedArea, string][] = [
      ['provinceId', 'province'],
      ['districtId', 'district'],
      ['sectorId', 'sector'],
      ['cellId', 'cell'],
    ];
    for (const [key, word] of above) {
      const sent = body[key];
      if (sent && area[key] !== null && sent !== area[key]) {
        throw this.fieldError(field, `That ${where} is not in the ${word} you picked. Pick them again.`);
      }
    }
    return area;
  }

  private fieldError(field: string, message: string): BadRequestException {
    return new BadRequestException({ message: 'Validation failed', issues: [{ code: 'custom', path: [field], message }] });
  }

  async appoint(actorUserId: string, body: AppointOfficerRequest): Promise<OversightAppointment> {
    if (!OVERSIGHT_ROLE_SCOPES[body.role].includes(body.scopeLevel)) {
      throw this.fieldError('scopeLevel', 'Pick an area at the level this role covers.');
    }
    const posting = OVERSIGHT_ROLE_POSTING[body.role];
    if (posting && (body.governmentBodyCode !== posting.governmentBodyCode || !posting.scopeLevels.includes(body.scopeLevel))) {
      throw new UnprocessableEntityException(posting.message);
    }
    const area = await this.area(body);
    const email = body.email.trim().toLowerCase();
    const leader = isLeaderRole(body.role) ? body.role : null;
    const now = this.now();

    const result = await this.db.transaction(async (tx) => {
      const govBody = await this.repo.body(body.governmentBodyCode, tx as unknown as Database);
      if (!govBody) throw this.fieldError('governmentBodyCode', 'Pick a government body from the list.');
      if (!govBody.active) throw new ConflictException('That government body is retired and cannot take new appointments.');

      const [found] = await tx.select({ id: users.id, name: users.name }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
      let userId = found?.id;
      let createdUser = false;
      if (!userId) {
        const [created] = await tx.insert(users).values({ email, emailVerified: false, name: body.name ?? null }).returning({ id: users.id });
        if (!created) throw new Error('User insert returned no row.');
        userId = created.id;
        createdUser = true;
      } else if (!found?.name?.trim() && body.name) {
        await tx.update(users).set({ name: body.name, updatedAt: now }).where(eq(users.id, userId));
      }

      const [dupe] = await tx
        .select({ id: oversightAssignments.id })
        .from(oversightAssignments)
        .where(
          and(
            eq(oversightAssignments.userId, userId),
            sql`${oversightAssignments.oversightRole}::text = ${body.role}`,
            isNull(oversightAssignments.revokedAt),
            sql`${oversightAssignments.scopeLevel}::text = ${body.scopeLevel}`,
            sql`${oversightAssignments.provinceId} is not distinct from ${body.scopeLevel === 'province' ? area.provinceId : body.scopeLevel === 'district' ? area.provinceId : null}`,
            sql`${oversightAssignments.districtId} is not distinct from ${area.districtId}`,
            sql`${oversightAssignments.sectorId} is not distinct from ${body.scopeLevel === 'district' ? null : area.sectorId}`,
            sql`${oversightAssignments.cellId} is not distinct from ${area.cellId}`,
            sql`${oversightAssignments.villageId} is not distinct from ${area.villageId}`,
          ),
        )
        .limit(1);
      if (dupe) throw new ConflictException('They already hold this post.');

      if (!leader) {
        await this.grants.assertMayHold(tx as unknown as Database, {
          userId,
          oversightRole: body.role,
          scope: {
            scopeLevel: body.scopeLevel,
            provinceId: body.scopeLevel === 'province' ? area.provinceId : null,
            districtId: body.scopeLevel === 'district' ? area.districtId : null,
          },
        });
      }

      const values = {
        userId,
        oversightRole: body.role,
        governmentBodyCode: body.governmentBodyCode,
        governmentTitle: body.governmentTitle,
        scopeLevel: body.scopeLevel,
        // A district post keeps its province as the denormalised parent; a
        // local post names every level down to its own.
        provinceId: body.scopeLevel === 'province' || body.scopeLevel === 'district' ? area.provinceId : null,
        districtId: body.scopeLevel === 'country' || body.scopeLevel === 'province' ? null : area.districtId,
        sectorId: body.scopeLevel === 'sector' || body.scopeLevel === 'cell' || body.scopeLevel === 'village' ? area.sectorId : null,
        cellId: body.scopeLevel === 'cell' || body.scopeLevel === 'village' ? area.cellId : null,
        villageId: body.scopeLevel === 'village' ? area.villageId : null,
        assignedByUserId: actorUserId,
      };
      const [created] = await tx.insert(oversightAssignments).values(values).returning({ id: oversightAssignments.id });
      if (!created) throw new Error('Appointment insert returned no row.');

      await tx.insert(auditEvents).values({
        actorUserId,
        subjectType: 'user',
        subjectId: userId,
        eventType: 'admin.user.oversight_granted',
        payloadDiff: {
          oversight: {
            assignmentId: created.id,
            oversightRole: body.role,
            governmentBodyCode: body.governmentBodyCode,
            governmentTitle: body.governmentTitle,
            scopeLevel: body.scopeLevel,
            provinceId: values.provinceId,
            districtId: values.districtId,
            sectorId: values.sectorId,
            cellId: values.cellId,
            villageId: values.villageId,
            createdUser,
          },
        } as never,
        reason: body.reason,
        districtId: values.districtId,
      });

      const handedOver = leader
        ? await this.routing.handOverOnAppointment(tx, {
            assignmentId: created.id,
            role: leader,
            area: { villageId: values.villageId, cellId: values.cellId, sectorId: values.sectorId, districtId: values.districtId, provinceId: values.provinceId },
          })
        : [];
      return { assignmentId: created.id, handedOver, area: values };
    });

    const row = await this.repo.one(result.assignmentId);
    if (!row) throw new NotFoundException('That appointment was not found.');
    const appointment = presentAppointment(row);
    void this.tell(email, appointment, leader, result.handedOver, result.area);
    return appointment;
  }

  /** The appointment email, then (for a leader) the hand-over summary. Never throws. */
  private async tell(
    email: string,
    appointment: OversightAppointment,
    leader: LeaderRole | null,
    handedOver: string[],
    area: { villageId: number | null; cellId: number | null; sectorId: number | null; districtId: number | null },
  ): Promise<void> {
    try {
      await this.notifier.send(
        email,
        appointmentMail({
          appUrl: this.notifier.appUrl,
          roleLabel: appointment.roleLabel,
          area: appointment.area,
          next: leader ? '/officer/guests' : '/officer',
        }),
        'appointment',
      );
      if (leader) await this.routing.tellHandOver({ email, role: leader, area }, handedOver);
    } catch (cause) {
      this.log.error(`Appointment mail to ${email} failed: ${cause instanceof Error ? cause.message : 'failed'}.`);
    }
  }

  /** End an appointment, with a reason. `revoked_at`, never a delete: what they saw stays on record. */
  async end(actorUserId: string, assignmentId: string, reason: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(oversightAssignments)
        .set({ revokedAt: this.now() })
        .where(and(eq(oversightAssignments.id, assignmentId), isNull(oversightAssignments.revokedAt)))
        .returning({
          id: oversightAssignments.id,
          userId: oversightAssignments.userId,
          role: oversightAssignments.oversightRole,
          governmentBodyCode: oversightAssignments.governmentBodyCode,
          provinceId: oversightAssignments.provinceId,
          districtId: oversightAssignments.districtId,
          sectorId: oversightAssignments.sectorId,
          cellId: oversightAssignments.cellId,
          villageId: oversightAssignments.villageId,
        });
      if (!row) throw new NotFoundException('No live appointment has that id.');
      await tx.insert(auditEvents).values({
        actorUserId,
        subjectType: 'user',
        subjectId: row.userId,
        eventType: 'admin.user.oversight_revoked',
        payloadDiff: { oversight: { assignmentId: row.id, oversightRole: row.role, governmentBodyCode: row.governmentBodyCode } } as never,
        reason,
        districtId: row.districtId,
      });
      if (isLeaderRole(row.role)) {
        const moved = await this.routing.releaseOnEnd(tx, {
          assignmentId: row.id,
          role: row.role,
          area: { villageId: row.villageId, cellId: row.cellId, sectorId: row.sectorId, districtId: row.districtId, provinceId: row.provinceId ?? null },
        });
        if (moved) this.log.log(`Appointment ${row.id} ended: ${moved} current guest step(s) handed on or back to waiting.`);
      }
    });
  }

  /**
   * The coverage report: for each leader role, the areas in Rwanda and those
   * with rented homes on Injishi, and how many have someone in the post; the
   * areas with homes and nobody in the post; the guests waiting; and the
   * leaders who have guests delivered and never opened one.
   */
  async coverage(): Promise<LeaderCoverage> {
    const today = kigaliToday(this.now());
    const [nationwide, waiting, neverOpened, ...perRole] = await Promise.all([
      this.repo.nationwide(),
      this.repo.waiting(today),
      this.repo.neverOpened(),
      ...CHAIN_ROLES.map((role) => this.repo.withHomes(role, today)),
    ]);
    const roles = CHAIN_ROLES.map((role, i) => {
      const level = LEADER_ROLE_SCOPE[role];
      const areas = perRole[i] ?? [];
      return {
        role,
        roleLabel: LEADER_ROLE_LABEL[role],
        level,
        nationwide: { areas: nationwide[level].areas, covered: nationwide[level].covered[role] ?? 0 },
        withHomes: { areas: areas.length, covered: areas.filter((a) => a.covered).length },
      };
    });
    const uncovered = CHAIN_ROLES.flatMap((role, i) =>
      (perRole[i] ?? [])
        .filter((a) => !a.covered)
        .map((a) => {
          const level = LEADER_ROLE_SCOPE[role];
          return {
            role,
            roleLabel: LEADER_ROLE_LABEL[role],
            level,
            area:
              placeWords({
                villageName: level === 'village' ? a.villageName : null,
                cellName: level === 'village' || level === 'cell' ? a.cellName : null,
                sectorName: level === 'district' ? null : a.sectorName,
                districtName: a.districtName,
              }) || 'Area not on record',
            provinceId: a.provinceId,
            districtId: a.districtId,
            sectorId: a.sectorId,
            cellId: a.cellId,
            villageId: a.villageId,
            names: tidyNames({ province: a.provinceName, district: a.districtName, sector: a.sectorName, cell: a.cellName, village: a.villageName }),
            homes: a.homes,
            waitingReports: a.waitingReports,
          };
        }),
    ).sort((a, b) => b.waitingReports - a.waitingReports || b.homes - a.homes || a.area.localeCompare(b.area));
    return {
      generatedAt: this.now().toISOString(),
      roles,
      uncovered: uncovered.slice(0, 500),
      waiting: waiting.map(presentWaiting),
      neverOpened: neverOpened.map((n) => ({
        assignmentId: n.assignmentId,
        name: n.name,
        email: n.email,
        role: n.role,
        roleLabel: LEADER_ROLE_LABEL[n.role],
        area: appointmentArea({ ...n, provinceName: null }),
        delivered: n.delivered,
        firstDeliveredAt: new Date(n.firstDeliveredAt).toISOString(),
        grantedAt: new Date(n.grantedAt).toISOString(),
      })),
    };
  }

  /** The coverage report as CSV, a section per table. */
  async coverageCsv(): Promise<string> {
    const c = await this.coverage();
    const blank: string[] = [];
    return toCsv(['Local leader coverage', c.generatedAt.slice(0, 10)], [
      blank,
      ['Role', 'Areas in Rwanda', 'With someone in the post', 'Areas with rented homes', 'With someone in the post'],
      ...c.roles.map((r) => [r.roleLabel, r.nationwide.areas, r.nationwide.covered, r.withHomes.areas, r.withHomes.covered]),
      blank,
      ['Areas with homes and nobody in the post'],
      ['Role', 'Area', 'Homes', 'Guests waiting'],
      ...c.uncovered.map((u) => [u.roleLabel, u.area, u.homes, u.waitingReports]),
      blank,
      ['Guests waiting for a leader'],
      ['Role', 'Area', 'Guests', 'Earliest arrival'],
      ...c.waiting.map((w) => [w.roleLabel, w.area, w.reports, w.oldestArrival]),
      blank,
      ['Leaders who never opened a guest'],
      ['Name', 'Email', 'Role', 'Area', 'Guests delivered', 'First delivered', 'Appointed'],
      ...c.neverOpened.map((n) => [n.name, n.email, n.roleLabel, n.area, n.delivered, n.firstDeliveredAt.slice(0, 10), n.grantedAt.slice(0, 10)]),
    ]);
  }
}
