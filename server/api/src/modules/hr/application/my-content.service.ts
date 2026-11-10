import type {
  HrFeaturesOff,
  HrTargets,
  MyAnnouncementList,
  MyReview,
  MyReviewList,
  SendSelfReviewRequest,
} from '@injishi/contracts';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';

import { reviewCycles, staffReviews } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { kigaliToday } from '../domain/hr-calendar';
import { EmployeesRepository, type EmployeeRow } from '../infrastructure/employees.repository';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { HrContentRepository } from '../infrastructure/hr-content.repository';
import { HrFeaturesService } from './hr-features.service';
import { MyWorkRepository } from '../infrastructure/my-work.repository';

type ReviewRow = { review: typeof staffReviews.$inferSelect; cycle: typeof reviewCycles.$inferSelect };

/**
 * Who a targeted announcement reaches (058-people-file AC-PF7, AC-PF9): a person named is always in; a
 * department and positions named together narrow it, so both must match.
 */
export function inAudience(
  targets: HrTargets | undefined,
  person: { id: string; jobPositionId: string | null; departmentIds: ReadonlySet<string> },
): boolean {
  if (!targets) return false;
  if (targets.employeeIds.includes(person.id)) return true;
  if (targets.departmentIds.length === 0 && targets.jobPositionIds.length === 0) return false;
  const department =
    targets.departmentIds.length === 0 || targets.departmentIds.some((id) => person.departmentIds.has(id));
  const position =
    targets.jobPositionIds.length === 0 ||
    (person.jobPositionId !== null && targets.jobPositionIds.includes(person.jobPositionId));
  return department && position;
}

/**
 * What HR shares with a person, on their own file (`me/work`): the announcements that are for them,
 * and their own reviews, where they write their part. Ownership is the guard, as on every `me/work`
 * route: any id that is not the caller's answers 404, and a file the person has left is read only.
 *
 * A review keeps the person's part in the columns it already has: `self_done`, and their words in
 * `note`. The rating stays the manager's and HR's (`PATCH /ops/reviews/:id`).
 */
@Injectable()
export class MyContentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly work: MyWorkRepository,
    private readonly employees: EmployeesRepository,
    private readonly content: HrContentRepository,
    private readonly hrFeatures: HrFeaturesService,
  ) {}

  /** What the person's business has switched off. */
  async features(userId: string, employeeId: string): Promise<HrFeaturesOff> {
    const me = await this.mine(userId, employeeId);
    return { off: [...(await this.hrFeatures.offFor(me.orgId))] };
  }

  /** What is published, not past its date, and for this person, newest first. A leaver reads none. */
  async announcements(userId: string, employeeId: string): Promise<MyAnnouncementList> {
    const me = await this.mine(userId, employeeId);
    if (me.status !== 'active') return { announcements: [] };
    const today = kigaliToday();
    const live = (await this.content.announcements(me.orgId)).filter(
      (r) => r.status === 'published' && (r.expiresOn === null || r.expiresOn >= today),
    );
    const targets = await this.content.targetsOf(
      'announcement',
      live.filter((r) => r.audience === 'targeted').map((r) => r.id),
    );
    const departmentIds = new Set((await this.employees.departmentsOf(me.id)).map((d) => d.departmentId));
    const person = { id: me.id, jobPositionId: me.jobPositionId, departmentIds };
    return {
      announcements: live
        .filter((r) => r.audience === 'all' || inAudience(targets.get(r.id), person))
        .map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          postedAt: r.createdAt.toISOString(),
          expiresOn: r.expiresOn,
        })),
    };
  }

  /** The person's reviews, the latest cycle first. */
  async reviews(userId: string, employeeId: string): Promise<MyReviewList> {
    const me = await this.mine(userId, employeeId);
    const rows = await this.db
      .select({ review: staffReviews, cycle: reviewCycles })
      .from(staffReviews)
      .innerJoin(reviewCycles, eq(reviewCycles.id, staffReviews.cycleId))
      .where(eq(staffReviews.employeeId, me.id))
      .orderBy(desc(reviewCycles.startsOn));
    return { reviews: rows.map(present) };
  }

  /** The person's own words. They can change them until the cycle closes or the review is rated. */
  async sendSelfReview(
    userId: string,
    employeeId: string,
    reviewId: string,
    body: SendSelfReviewRequest,
  ): Promise<MyReview> {
    const me = await this.mine(userId, employeeId);
    if (me.status !== 'active') throw new ConflictException('You no longer work here, so this file is read only.');
    const row = await this.one(me.id, reviewId);
    if (row.cycle.status === 'closed') throw new ConflictException('That review cycle is closed.');
    if (row.review.rating !== null) throw new ConflictException('Your review is finished, so it can no longer change.');
    await this.db.transaction(async (tx) => {
      await tx
        .update(staffReviews)
        .set({ selfDone: true, note: body.note.trim(), updatedByUserId: userId, updatedAt: new Date() })
        .where(eq(staffReviews.id, reviewId));
      await writeHrAudit(tx, {
        actorUserId: userId,
        subjectType: 'employee',
        subjectId: me.id,
        eventType: 'hr.review_changed',
        orgId: me.orgId,
        diff: { reviewId, fields: ['selfDone', 'note'] },
      });
    });
    return present(await this.one(me.id, reviewId));
  }

  private async one(employeeId: string, reviewId: string): Promise<ReviewRow> {
    const [row] = await this.db
      .select({ review: staffReviews, cycle: reviewCycles })
      .from(staffReviews)
      .innerJoin(reviewCycles, eq(reviewCycles.id, staffReviews.cycleId))
      .where(and(eq(staffReviews.id, reviewId), eq(staffReviews.employeeId, employeeId)));
    if (!row) throw new NotFoundException();
    return row;
  }

  /** The caller's file, or 404: a probe for any other id learns nothing. */
  private async mine(userId: string, employeeId: string): Promise<EmployeeRow> {
    if (!(await this.work.owned(userId, employeeId))) throw new NotFoundException();
    const employee = await this.employees.find(employeeId);
    if (!employee) throw new NotFoundException();
    return employee;
  }
}

function present({ review, cycle }: ReviewRow): MyReview {
  return {
    id: review.id,
    cycleName: cycle.name,
    startsOn: cycle.startsOn,
    endsOn: cycle.endsOn,
    cycleOpen: cycle.status === 'open',
    selfDone: review.selfDone,
    managerDone: review.managerDone,
    rating: review.rating,
    note: review.note,
  };
}
