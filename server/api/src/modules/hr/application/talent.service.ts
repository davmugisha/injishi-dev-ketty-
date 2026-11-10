import type {
  AddOfferRoundRequest,
  AgreeOfferRequest,
  Candidate,
  CandidateStage,
  CreateCandidateRequest,
  CreateInterviewRequest,
  CreateReviewCycleRequest,
  CreateVacancyRequest,
  CurrentReviewCycle,
  Interview,
  InterviewStatus,
  MoveCandidateRequest,
  Review,
  ReviewCycle,
  ScoreCandidateRequest,
  TalentBoard,
  UpdateReviewRequest,
  UpdateVacancyRequest,
  Vacancy,
} from '@injishi/contracts';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { and, asc, desc, eq, gte, inArray, ne, or } from 'drizzle-orm';

import {
  candidateDocuments,
  candidateScores,
  candidates,
  employees,
  interviews,
  jobPositions,
  offerRounds,
  properties,
  reviewCycles,
  staffReviews,
  users,
  vacancies,
} from '../../../database/drizzle/schema';
import { coversProperty, type ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { StorageService } from '../../storage/application/storage.service';
import { kigaliToday } from '../domain/hr-calendar';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { TalentMailer } from '../infrastructure/talent.mailer';
import { displayNameOf } from './employee-presenter';
import { orgOf } from './hr-access';

type VacancyRow = typeof vacancies.$inferSelect;
type CandidateRow = typeof candidates.$inferSelect;

/** The order a candidate goes through; a turn-down leaves it. */
const ORDER: CandidateStage[] = ['applied', 'screening', 'interview', 'offer', 'hired'];

const addMonths = (iso: string, n: number): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Talent (058-talent): vacancies, the candidates who apply and their interviews and scores, and
 * review cycles. Everything is the business's own, read and written with `people.manage`, within
 * the branches the caller covers.
 */
@Injectable()
export class TalentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly mail: TalentMailer,
    private readonly storage: StorageService,
  ) {}

  /** An offer above the role's range is a pay decision: whoever confirms the pay run makes it. */
  private checkRange(ws: ScopedWorkspace, v: VacancyRow, amountRwf: number): void {
    if (v.wageToRwf !== null && amountRwf > v.wageToRwf && !ws.permissions.includes('payroll.run')) {
      throw new ForbiddenException(`RWF ${amountRwf.toLocaleString('en-US')} is above the role's range. The owner agrees to that.`);
    }
  }

  // --- Hiring -----------------------------------------------------------------------------

  /** Open roles and the ones closed in the last month, their candidates, and interviews from today. */
  async board(ws: ScopedWorkspace): Promise<TalentBoard> {
    const orgId = orgOf(ws);
    const monthAgo = new Date(Date.now() - 30 * 86_400_000);
    const vacs = (
      await this.db
        .select()
        .from(vacancies)
        .where(and(eq(vacancies.orgId, orgId), or(eq(vacancies.status, 'open'), gte(vacancies.updatedAt, monthAgo))))
        .orderBy(asc(vacancies.status), desc(vacancies.createdAt))
    ).filter((v) => coversProperty(ws.branchScope, v.propertyId));
    const ids = vacs.map((v) => v.id);
    const cands = ids.length
      ? await this.db.select().from(candidates).where(inArray(candidates.vacancyId, ids)).orderBy(desc(candidates.updatedAt))
      : [];
    const today = new Date(`${kigaliToday()}T00:00:00+02:00`);
    const ivs = cands.length
      ? await this.db
          .select()
          .from(interviews)
          .where(
            and(
              inArray(
                interviews.candidateId,
                cands.map((c) => c.id),
              ),
              gte(interviews.startsAt, today),
              ne(interviews.status, 'cancelled'),
            ),
          )
          .orderBy(asc(interviews.startsAt))
      : [];
    const presented = await this.presentCandidates(cands, vacs);
    return {
      vacancies: await this.presentVacancies(vacs, cands),
      candidates: presented,
      interviews: ivs.map((i) => {
        const c = presented.find((x) => x.id === i.candidateId);
        return {
          id: i.id,
          candidateId: i.candidateId,
          candidateName: c?.fullName ?? '',
          vacancyTitle: c?.vacancyTitle ?? '',
          startsAt: i.startsAt.toISOString(),
          place: i.place,
          interviewerName: i.interviewerName,
          status: i.status,
        } satisfies Interview;
      }),
    };
  }

  async createVacancy(ws: ScopedWorkspace, userId: string, body: CreateVacancyRequest): Promise<Vacancy> {
    const orgId = orgOf(ws);
    if (body.branchId && !coversProperty(ws.branchScope, body.branchId)) {
      throw new UnprocessableEntityException('That branch is outside the ones you cover.');
    }
    const [row] = await this.db
      .insert(vacancies)
      .values({
        orgId,
        title: body.title.trim(),
        propertyId: body.branchId ?? null,
        openings: body.openings ?? 1,
        wageFromRwf: body.wageFromRwf ?? null,
        wageToRwf: body.wageToRwf ?? null,
        closesOn: body.closesOn ?? null,
        managerEmployeeId: body.managerEmployeeId ?? null,
        note: body.note?.trim() || null,
        requiredDocuments: [...new Set((body.documents ?? []).map((d) => d.trim()))],
        createdByUserId: userId,
      })
      .returning();
    await writeHrAudit(this.db, {
      actorUserId: userId,
      subjectType: 'org',
      subjectId: orgId,
      eventType: 'hr.vacancy_opened',
      orgId,
      diff: { vacancyId: row.id },
    });
    return (await this.presentVacancies([row], []))[0];
  }

  async updateVacancy(ws: ScopedWorkspace, userId: string, id: string, body: UpdateVacancyRequest): Promise<Vacancy> {
    const v = await this.vacancy(ws, id);
    const [row] = await this.db
      .update(vacancies)
      .set({
        ...(body.status ? { status: body.status } : {}),
        ...(body.closesOn !== undefined ? { closesOn: body.closesOn } : {}),
        ...(body.note !== undefined ? { note: body.note?.trim() || null } : {}),
        ...(body.documents !== undefined ? { requiredDocuments: [...new Set(body.documents.map((d) => d.trim()))] } : {}),
        updatedAt: new Date(),
      })
      .where(eq(vacancies.id, v.id))
      .returning();
    await writeHrAudit(this.db, {
      actorUserId: userId,
      subjectType: 'org',
      subjectId: v.orgId,
      eventType: 'hr.vacancy_changed',
      orgId: v.orgId,
      diff: { vacancyId: id, fields: Object.keys(body) },
    });
    const cands = await this.db.select().from(candidates).where(eq(candidates.vacancyId, id));
    return (await this.presentVacancies([row], cands))[0];
  }

  async addCandidate(ws: ScopedWorkspace, userId: string, body: CreateCandidateRequest): Promise<Candidate> {
    const v = await this.vacancy(ws, body.vacancyId);
    if (v.status !== 'open') throw new ConflictException('That vacancy is not open.');
    const today = kigaliToday();
    const [row] = await this.db
      .insert(candidates)
      .values({
        orgId: v.orgId,
        vacancyId: v.id,
        fullName: body.fullName.trim(),
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        source: body.source.trim(),
        note: body.note?.trim() || null,
        talentPool: body.talentPool ?? false,
        expectedWageRwf: body.expectedWageRwf ?? null,
        accessToken: randomBytes(24).toString('base64url'),
        appliedOn: today,
        // Six months for the role, a year when they agreed to be kept for others.
        keepUntil: addMonths(today, body.talentPool ? 12 : 6),
      })
      .returning();
    await writeHrAudit(this.db, {
      actorUserId: userId,
      subjectType: 'org',
      subjectId: v.orgId,
      eventType: 'hr.candidate_added',
      orgId: v.orgId,
      diff: { candidateId: row.id, vacancyId: v.id },
    });
    void this.mail.notify(row.id, { kind: 'received' }, userId);
    return (await this.presentCandidates([row], [v]))[0];
  }

  /** The next step, an offer with its terms, the hire, or a turn-down with its reason. */
  async moveCandidate(ws: ScopedWorkspace, userId: string, id: string, body: MoveCandidateRequest): Promise<Candidate> {
    const c = await this.candidate(ws, id);
    if (body.hiredEmployeeId) await this.assertHireFile(ws, c.orgId, body.hiredEmployeeId);
    // The hire comes first and the staff file after it, so a hired candidate's file is named once it exists.
    if (c.stage === 'hired' && body.stage === 'hired' && body.hiredEmployeeId) {
      if (c.hiredEmployeeId && c.hiredEmployeeId !== body.hiredEmployeeId) {
        throw new ConflictException(`${c.fullName} already has a staff file.`);
      }
      await this.db.transaction(async (tx) => {
        await tx.update(candidates).set({ hiredEmployeeId: body.hiredEmployeeId, updatedAt: new Date() }).where(eq(candidates.id, id));
        await writeHrAudit(tx, {
          actorUserId: userId,
          subjectType: 'org',
          subjectId: c.orgId,
          eventType: 'hr.candidate_moved',
          orgId: c.orgId,
          diff: { candidateId: id, hiredEmployeeId: body.hiredEmployeeId },
        });
      });
      return this.presentCandidate(id);
    }
    if (c.stage === 'hired' || c.stage === 'rejected') {
      throw new ConflictException(`${c.fullName} is already ${c.stage === 'hired' ? 'hired' : 'turned down'}.`);
    }
    if (body.stage !== 'rejected' && ORDER.indexOf(body.stage) < ORDER.indexOf(c.stage)) {
      throw new UnprocessableEntityException('A candidate moves forward, or is turned down.');
    }
    if (body.stage === 'offer' && body.offerWageRwf !== undefined) {
      this.checkRange(ws, await this.vacancy(ws, c.vacancyId), body.offerWageRwf);
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(candidates)
        .set({
          stage: body.stage,
          ...(body.stage === 'offer' ? { offerWageRwf: body.offerWageRwf ?? null, offerStartsOn: body.offerStartsOn ?? null } : {}),
          ...(body.stage === 'rejected' ? { rejectReason: body.reason ?? null } : {}),
          ...(body.stage === 'hired' && body.hiredEmployeeId ? { hiredEmployeeId: body.hiredEmployeeId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, id));
      // An offer made by moving to the stage opens the salary talk with its first round.
      if (body.stage === 'offer' && body.offerWageRwf !== undefined) {
        await tx.insert(offerRounds).values({
          orgId: c.orgId,
          candidateId: id,
          side: 'business',
          amountRwf: body.offerWageRwf,
          startsOn: body.offerStartsOn ?? null,
          byUserId: userId,
        });
      }
      if (body.stage === 'hired') {
        // The role is filled once its openings are.
        const [v] = await tx.select().from(vacancies).where(eq(vacancies.id, c.vacancyId));
        const hired = await tx
          .select({ id: candidates.id })
          .from(candidates)
          .where(and(eq(candidates.vacancyId, c.vacancyId), eq(candidates.stage, 'hired')));
        if (v && hired.length >= v.openings) {
          await tx.update(vacancies).set({ status: 'filled', updatedAt: new Date() }).where(eq(vacancies.id, v.id));
        }
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: c.orgId,
        eventType: body.stage === 'rejected' ? 'hr.candidate_rejected' : 'hr.candidate_moved',
        orgId: c.orgId,
        diff: { candidateId: id, from: c.stage, to: body.stage },
        reason: body.reason ?? null,
      });
    });
    if (body.stage !== c.stage) {
      const step =
        body.stage === 'screening'
          ? ({ kind: 'screening' } as const)
          : body.stage === 'interview'
            ? ({ kind: 'interview_stage' } as const)
            : body.stage === 'offer' && body.offerWageRwf !== undefined
              ? ({ kind: 'offer', amountRwf: body.offerWageRwf, startsOn: body.offerStartsOn ?? null } as const)
              : body.stage === 'hired'
                ? ({ kind: 'hired', startsOn: c.offerStartsOn } as const)
                : body.stage === 'rejected'
                  ? ({ kind: 'closed', reason: body.reason ?? null } as const)
                  : null;
      if (step) void this.mail.notify(id, step, userId);
    }
    return this.presentCandidate(id);
  }

  /**
   * One more round of the salary talk, while the offer is open: the business offers again (its
   * figure becomes the offer on the table) or the candidate asks back.
   */
  async addOfferRound(ws: ScopedWorkspace, userId: string, id: string, body: AddOfferRoundRequest): Promise<Candidate> {
    const c = await this.candidate(ws, id);
    if (c.stage !== 'offer') throw new ConflictException(`Make ${c.fullName} an offer first.`);
    if (c.agreedWageRwf !== null) throw new ConflictException(`The wage is already agreed for ${c.fullName}.`);
    if (body.side === 'business') this.checkRange(ws, await this.vacancy(ws, c.vacancyId), body.amountRwf);
    await this.db.transaction(async (tx) => {
      await tx.insert(offerRounds).values({
        orgId: c.orgId,
        candidateId: id,
        side: body.side,
        amountRwf: body.amountRwf,
        startsOn: body.startsOn ?? null,
        note: body.note?.trim() || null,
        byUserId: userId,
      });
      if (body.side === 'business') {
        await tx
          .update(candidates)
          .set({
            offerWageRwf: body.amountRwf,
            ...(body.startsOn ? { offerStartsOn: body.startsOn } : {}),
            updatedAt: new Date(),
          })
          .where(eq(candidates.id, id));
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: c.orgId,
        eventType: 'hr.offer_round_added',
        orgId: c.orgId,
        diff: { candidateId: id, side: body.side, amountRwf: body.amountRwf },
      });
    });
    if (body.side === 'business') {
      void this.mail.notify(id, { kind: 'offer', amountRwf: body.amountRwf, startsOn: body.startsOn ?? c.offerStartsOn }, userId);
    }
    return this.presentCandidate(id);
  }

  /**
   * Both sides settle on a wage. Above the top of the role's range it is a pay decision, so it
   * takes whoever confirms the pay run (`payroll.run`, the owner unless they handed it on).
   */
  async agreeOffer(ws: ScopedWorkspace, userId: string, id: string, body: AgreeOfferRequest): Promise<Candidate> {
    const c = await this.candidate(ws, id);
    if (c.stage !== 'offer') throw new ConflictException(`Make ${c.fullName} an offer first.`);
    const v = await this.vacancy(ws, c.vacancyId);
    const aboveRange = v.wageToRwf !== null && body.amountRwf > v.wageToRwf;
    this.checkRange(ws, v, body.amountRwf);
    await this.db.transaction(async (tx) => {
      await tx
        .update(candidates)
        .set({
          agreedWageRwf: body.amountRwf,
          offerWageRwf: body.amountRwf,
          ...(body.startsOn ? { offerStartsOn: body.startsOn } : {}),
          updatedAt: new Date(),
        })
        .where(eq(candidates.id, id));
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: c.orgId,
        eventType: 'hr.offer_agreed',
        orgId: c.orgId,
        diff: { candidateId: id, amountRwf: body.amountRwf, aboveRange },
      });
    });
    void this.mail.notify(id, { kind: 'agreed', amountRwf: body.amountRwf, startsOn: body.startsOn ?? c.offerStartsOn }, userId);
    return this.presentCandidate(id);
  }

  async score(ws: ScopedWorkspace, userId: string, id: string, body: ScoreCandidateRequest): Promise<Candidate> {
    const c = await this.candidate(ws, id);
    await this.db
      .insert(candidateScores)
      .values({ candidateId: c.id, what: body.what.trim(), score: body.score, note: body.note?.trim() || null, byUserId: userId });
    return this.presentCandidate(id);
  }

  /** Book an interview; a candidate not yet at the interview stage moves to it. */
  async bookInterview(ws: ScopedWorkspace, userId: string, body: CreateInterviewRequest): Promise<Interview> {
    const c = await this.candidate(ws, body.candidateId);
    if (c.stage === 'hired' || c.stage === 'rejected') throw new ConflictException(`${c.fullName} is no longer in the running.`);
    const [row] = await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(interviews)
        .values({
          orgId: c.orgId,
          candidateId: c.id,
          startsAt: new Date(body.startsAt),
          place: body.place?.trim() || null,
          interviewerName: body.interviewerName?.trim() || null,
        })
        .returning();
      if (ORDER.indexOf(c.stage) < ORDER.indexOf('interview')) {
        await tx.update(candidates).set({ stage: 'interview', updatedAt: new Date() }).where(eq(candidates.id, c.id));
      }
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: c.orgId,
        eventType: 'hr.interview_booked',
        orgId: c.orgId,
        diff: { candidateId: c.id, interviewId: inserted[0].id },
      });
      return inserted;
    });
    void this.mail.notify(
      c.id,
      { kind: 'interview_booked', startsAt: row.startsAt, place: row.place, interviewerName: row.interviewerName },
      userId,
    );
    const [v] = await this.db.select({ title: vacancies.title }).from(vacancies).where(eq(vacancies.id, c.vacancyId));
    return {
      id: row.id,
      candidateId: c.id,
      candidateName: c.fullName,
      vacancyTitle: v?.title ?? '',
      startsAt: row.startsAt.toISOString(),
      place: row.place,
      interviewerName: row.interviewerName,
      status: row.status,
    };
  }

  async setInterviewStatus(ws: ScopedWorkspace, userId: string, id: string, status: InterviewStatus): Promise<void> {
    const [row] = await this.db.select().from(interviews).where(eq(interviews.id, id));
    if (!row || row.orgId !== orgOf(ws)) throw new NotFoundException();
    await this.candidate(ws, row.candidateId);
    await this.db.update(interviews).set({ status, updatedAt: new Date() }).where(eq(interviews.id, id));
    await writeHrAudit(this.db, {
      actorUserId: userId,
      subjectType: 'org',
      subjectId: row.orgId,
      eventType: 'hr.interview_changed',
      orgId: row.orgId,
      diff: { interviewId: id, status },
    });
  }

  // --- Reviews ----------------------------------------------------------------------------

  /** The open cycle, else the latest, with the reviews of the people the caller covers. */
  async currentCycle(ws: ScopedWorkspace): Promise<CurrentReviewCycle> {
    const orgId = orgOf(ws);
    const [cycle] = await this.db
      .select()
      .from(reviewCycles)
      .where(eq(reviewCycles.orgId, orgId))
      .orderBy(asc(reviewCycles.status), desc(reviewCycles.startsOn))
      .limit(1);
    if (!cycle) return { cycle: null };
    return { cycle: await this.presentCycle(ws, cycle) };
  }

  /** Open a cycle: one review for each person on staff in the caller's branches. */
  async openCycle(ws: ScopedWorkspace, userId: string, body: CreateReviewCycleRequest): Promise<ReviewCycle> {
    const orgId = orgOf(ws);
    const [open] = await this.db
      .select({ id: reviewCycles.id })
      .from(reviewCycles)
      .where(and(eq(reviewCycles.orgId, orgId), eq(reviewCycles.status, 'open')));
    if (open) throw new ConflictException('A review cycle is already open. Close it first.');
    const staff = (
      await this.db
        .select({ id: employees.id, workPropertyId: employees.workPropertyId })
        .from(employees)
        .where(and(eq(employees.orgId, orgId), eq(employees.status, 'active')))
    ).filter((e) => coversProperty(ws.branchScope, e.workPropertyId));
    const cycle = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(reviewCycles)
        .values({ orgId, name: body.name.trim(), startsOn: body.startsOn, endsOn: body.endsOn, createdByUserId: userId })
        .returning();
      if (staff.length) await tx.insert(staffReviews).values(staff.map((e) => ({ cycleId: row.id, employeeId: e.id })));
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'org',
        subjectId: orgId,
        eventType: 'hr.review_cycle_opened',
        orgId,
        diff: { cycleId: row.id, reviews: staff.length },
      });
      return row;
    });
    return this.presentCycle(ws, cycle);
  }

  async closeCycle(ws: ScopedWorkspace, userId: string, id: string): Promise<void> {
    const orgId = orgOf(ws);
    const [cycle] = await this.db.select().from(reviewCycles).where(eq(reviewCycles.id, id));
    if (!cycle || cycle.orgId !== orgId) throw new NotFoundException();
    await this.db.update(reviewCycles).set({ status: 'closed', updatedAt: new Date() }).where(eq(reviewCycles.id, id));
    await writeHrAudit(this.db, {
      actorUserId: userId,
      subjectType: 'org',
      subjectId: orgId,
      eventType: 'hr.review_cycle_closed',
      orgId,
      diff: { cycleId: id },
    });
  }

  async updateReview(ws: ScopedWorkspace, userId: string, id: string, body: UpdateReviewRequest): Promise<Review> {
    const orgId = orgOf(ws);
    const [row] = await this.db
      .select({ review: staffReviews, cycleOrg: reviewCycles.orgId, cycleStatus: reviewCycles.status, workPropertyId: employees.workPropertyId })
      .from(staffReviews)
      .innerJoin(reviewCycles, eq(reviewCycles.id, staffReviews.cycleId))
      .innerJoin(employees, eq(employees.id, staffReviews.employeeId))
      .where(eq(staffReviews.id, id));
    if (!row || row.cycleOrg !== orgId || !coversProperty(ws.branchScope, row.workPropertyId)) throw new NotFoundException();
    if (row.cycleStatus === 'closed') throw new ConflictException('That review cycle is closed.');
    await this.db
      .update(staffReviews)
      .set({ ...body, ...(body.note !== undefined ? { note: body.note?.trim() || null } : {}), updatedByUserId: userId, updatedAt: new Date() })
      .where(eq(staffReviews.id, id));
    await writeHrAudit(this.db, {
      actorUserId: userId,
      subjectType: 'employee',
      subjectId: row.review.employeeId,
      eventType: 'hr.review_changed',
      orgId,
      diff: { reviewId: id, fields: Object.keys(body) },
    });
    const people = await this.people([row.review.employeeId]);
    const [after] = await this.db.select().from(staffReviews).where(eq(staffReviews.id, id));
    return this.presentReview(after, people);
  }

  // --- Reading ----------------------------------------------------------------------------

  private async vacancy(ws: ScopedWorkspace, id: string): Promise<VacancyRow> {
    const [v] = await this.db.select().from(vacancies).where(eq(vacancies.id, id));
    if (!v || v.orgId !== orgOf(ws) || !coversProperty(ws.branchScope, v.propertyId)) throw new NotFoundException();
    return v;
  }

  private async candidate(ws: ScopedWorkspace, id: string): Promise<CandidateRow> {
    const [c] = await this.db.select().from(candidates).where(eq(candidates.id, id));
    if (!c || c.orgId !== orgOf(ws)) throw new NotFoundException();
    await this.vacancy(ws, c.vacancyId);
    return c;
  }

  /** The file a hire is linked to must be this business's, in a branch the caller covers. */
  private async assertHireFile(ws: ScopedWorkspace, orgId: string, employeeId: string): Promise<void> {
    const [person] = await this.db
      .select({ orgId: employees.orgId, workPropertyId: employees.workPropertyId })
      .from(employees)
      .where(eq(employees.id, employeeId));
    if (!person || person.orgId !== orgId || !coversProperty(ws.branchScope, person.workPropertyId)) {
      throw new NotFoundException('That staff file is not on file here.');
    }
  }

  private async people(ids: string[]): Promise<Map<string, { name: string; title: string | null; workPropertyId: string | null }>> {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map();
    const rows = await this.db
      .select({
        id: employees.id,
        legalName: employees.legalName,
        preferredName: employees.preferredName,
        title: jobPositions.title,
        workPropertyId: employees.workPropertyId,
      })
      .from(employees)
      .leftJoin(jobPositions, eq(jobPositions.id, employees.jobPositionId))
      .where(inArray(employees.id, unique));
    return new Map(rows.map((r) => [r.id, { name: displayNameOf(r), title: r.title, workPropertyId: r.workPropertyId }]));
  }

  private async presentVacancies(rows: VacancyRow[], cands: CandidateRow[]): Promise<Vacancy[]> {
    const branchIds = [...new Set(rows.map((r) => r.propertyId).filter((x): x is string => !!x))];
    const branches = branchIds.length
      ? new Map(
          (await this.db.select({ id: properties.id, name: properties.name }).from(properties).where(inArray(properties.id, branchIds))).map(
            (b) => [b.id, b.name],
          ),
        )
      : new Map<string, string>();
    const managers = await this.people(rows.map((r) => r.managerEmployeeId).filter((x): x is string => !!x));
    return rows.map((r) => {
      const mine = cands.filter((c) => c.vacancyId === r.id);
      return {
        id: r.id,
        title: r.title,
        branchId: r.propertyId,
        branchName: r.propertyId ? (branches.get(r.propertyId) ?? null) : null,
        openings: r.openings,
        wageFromRwf: r.wageFromRwf,
        wageToRwf: r.wageToRwf,
        closesOn: r.closesOn,
        status: r.status,
        managerName: r.managerEmployeeId ? (managers.get(r.managerEmployeeId)?.name ?? null) : null,
        note: r.note,
        documents: r.requiredDocuments,
        counts: {
          applied: mine.length,
          active: mine.filter((c) => c.stage !== 'rejected' && c.stage !== 'hired').length,
          declined: mine.filter((c) => c.stage === 'rejected').length,
          hired: mine.filter((c) => c.stage === 'hired').length,
        },
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  private async presentCandidates(rows: CandidateRow[], vacs: VacancyRow[]): Promise<Candidate[]> {
    if (!rows.length) return [];
    const scores = await this.db
      .select({
        id: candidateScores.id,
        candidateId: candidateScores.candidateId,
        what: candidateScores.what,
        score: candidateScores.score,
        note: candidateScores.note,
        byName: users.name,
        createdAt: candidateScores.createdAt,
      })
      .from(candidateScores)
      .leftJoin(users, eq(users.id, candidateScores.byUserId))
      .where(
        inArray(
          candidateScores.candidateId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(candidateScores.createdAt));
    const rounds = await this.db
      .select({
        id: offerRounds.id,
        candidateId: offerRounds.candidateId,
        side: offerRounds.side,
        amountRwf: offerRounds.amountRwf,
        startsOn: offerRounds.startsOn,
        note: offerRounds.note,
        byName: users.name,
        createdAt: offerRounds.createdAt,
      })
      .from(offerRounds)
      .leftJoin(users, eq(users.id, offerRounds.byUserId))
      .where(
        inArray(
          offerRounds.candidateId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(offerRounds.createdAt));
    const docs = await this.db
      .select()
      .from(candidateDocuments)
      .where(
        inArray(
          candidateDocuments.candidateId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(candidateDocuments.uploadedAt));
    const urls = new Map(await Promise.all(docs.map(async (d) => [d.id, await this.storage.signedUrl(d.objectKey)] as const)));
    return rows.map((r) => ({
      id: r.id,
      vacancyId: r.vacancyId,
      vacancyTitle: vacs.find((v) => v.id === r.vacancyId)?.title ?? '',
      fullName: r.fullName,
      phone: r.phone,
      email: r.email,
      source: r.source,
      stage: r.stage,
      note: r.note,
      talentPool: r.talentPool,
      appliedOn: r.appliedOn,
      keepUntil: r.keepUntil,
      expectedWageRwf: r.expectedWageRwf,
      offerWageRwf: r.offerWageRwf,
      offerStartsOn: r.offerStartsOn,
      agreedWageRwf: r.agreedWageRwf,
      rejectReason: r.rejectReason,
      hiredEmployeeId: r.hiredEmployeeId,
      scores: scores
        .filter((s) => s.candidateId === r.id)
        .map((s) => ({ id: s.id, what: s.what, score: s.score, note: s.note, byName: s.byName, createdAt: s.createdAt.toISOString() })),
      rounds: rounds
        .filter((x) => x.candidateId === r.id)
        .map((x) => ({
          id: x.id,
          side: x.side,
          amountRwf: x.amountRwf,
          startsOn: x.startsOn,
          note: x.note,
          byName: x.byName,
          createdAt: x.createdAt.toISOString(),
        })),
      documents: docs
        .filter((d) => d.candidateId === r.id)
        .map((d) => ({
          id: d.id,
          name: d.name,
          filename: d.filename,
          sizeBytes: d.sizeBytes,
          uploadedAt: d.uploadedAt.toISOString(),
          url: urls.get(d.id) ?? '',
        })),
      applicationLink: r.accessToken ? this.mail.link(r.accessToken) : null,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  private async presentCandidate(id: string): Promise<Candidate> {
    const [c] = await this.db.select().from(candidates).where(eq(candidates.id, id));
    if (!c) throw new NotFoundException();
    const [v] = await this.db.select().from(vacancies).where(eq(vacancies.id, c.vacancyId));
    return (await this.presentCandidates([c], v ? [v] : []))[0];
  }

  private presentReview(
    r: typeof staffReviews.$inferSelect,
    people: Map<string, { name: string; title: string | null }>,
  ): Review {
    const p = people.get(r.employeeId);
    return {
      id: r.id,
      employee: { employeeId: r.employeeId, displayName: p?.name ?? '', jobPositionTitle: p?.title ?? null },
      selfDone: r.selfDone,
      managerDone: r.managerDone,
      rating: r.rating,
      note: r.note,
    };
  }

  private async presentCycle(ws: ScopedWorkspace, cycle: typeof reviewCycles.$inferSelect): Promise<ReviewCycle> {
    const rows = await this.db.select().from(staffReviews).where(eq(staffReviews.cycleId, cycle.id));
    const people = await this.people(rows.map((r) => r.employeeId));
    const mine = rows.filter((r) => coversProperty(ws.branchScope, people.get(r.employeeId)?.workPropertyId ?? null));
    return {
      id: cycle.id,
      name: cycle.name,
      startsOn: cycle.startsOn,
      endsOn: cycle.endsOn,
      status: cycle.status,
      reviews: mine
        .map((r) => this.presentReview(r, people))
        .sort((a, b) => a.employee.displayName.localeCompare(b.employee.displayName)),
    };
  }
}
