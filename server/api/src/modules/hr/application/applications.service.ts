import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import type { ApplicationCodeSent, ApplicationSession, ApplicationView, RespondToOfferRequest } from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, desc, eq, ne } from 'drizzle-orm';

import {
  candidateDocuments,
  candidates,
  interviews,
  offerRounds,
  orgs,
  properties,
  vacancies,
  workspaces,
} from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { StorageService } from '../../storage/application/storage.service';
import { maskEmail } from '../domain/talent-mail';
import { writeHrAudit } from '../infrastructure/hr-audit';
import { TalentMailer } from '../infrastructure/talent.mailer';

type CandidateRow = typeof candidates.$inferSelect;

const CODE_TTL_MS = 10 * 60_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60_000;
const MAX_ATTEMPTS = 5;

const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const same = (a: string, b: string): boolean => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * An applicant's own progress page (058-talent), with no account. The link in their emails names
 * the application; a six digit code sent to the email on file opens it for a week on that device.
 * They see their steps, their interview, the documents the role asks for (and send them), and the
 * offer, which they may take or answer with another figure. Nothing here reaches another
 * applicant: every read starts from the one link and checks its own session.
 */
@Injectable()
export class ApplicationsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly mail: TalentMailer,
    private readonly storage: StorageService,
  ) {}

  /** Mail a fresh code to the address on the application. */
  async sendCode(token: string): Promise<ApplicationCodeSent> {
    const c = await this.byToken(token);
    if (!c.email) throw new UnprocessableEntityException('This application has no email on it. Ask HR for help.');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.db
      .update(candidates)
      .set({
        accessCodeHash: hash(`${c.id}:${code}`),
        accessCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
        accessCodeAttempts: 0,
      })
      .where(eq(candidates.id, c.id));
    await this.mail.notify(c.id, { kind: 'code', code }, null);
    return { sentTo: maskEmail(c.email) };
  }

  /** The code they typed: a week's session on a match, one fewer try on a miss. */
  async verify(token: string, code: string): Promise<ApplicationSession> {
    const c = await this.byToken(token);
    if (!c.accessCodeHash || !c.accessCodeExpiresAt || c.accessCodeExpiresAt.getTime() < Date.now()) {
      throw new UnprocessableEntityException('That code has expired. Ask for a new one.');
    }
    if (c.accessCodeAttempts >= MAX_ATTEMPTS) {
      throw new UnprocessableEntityException('Too many tries. Ask for a new code.');
    }
    if (!same(hash(`${c.id}:${code}`), c.accessCodeHash)) {
      await this.db
        .update(candidates)
        .set({ accessCodeAttempts: c.accessCodeAttempts + 1 })
        .where(eq(candidates.id, c.id));
      throw new UnprocessableEntityException('That code is not right.');
    }
    const session = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.db
      .update(candidates)
      .set({
        accessSessionHash: hash(session),
        accessSessionExpiresAt: expiresAt,
        accessCodeHash: null,
        accessCodeExpiresAt: null,
        accessCodeAttempts: 0,
      })
      .where(eq(candidates.id, c.id));
    return { session, expiresAt: expiresAt.toISOString() };
  }

  async view(token: string, session: string | undefined): Promise<ApplicationView> {
    return this.present(await this.opened(token, session));
  }

  /** One of the documents the role asks for; a second file of the same document replaces the first. */
  async upload(
    token: string,
    session: string | undefined,
    file: { name: string; body: Buffer; filename: string },
  ): Promise<ApplicationView> {
    const c = await this.opened(token, session);
    if (c.stage === 'rejected') throw new ConflictException('This application is closed.');
    const [v] = await this.db.select().from(vacancies).where(eq(vacancies.id, c.vacancyId));
    if (!v?.requiredDocuments.includes(file.name)) {
      throw new UnprocessableEntityException('That is not one of the documents this role asks for.');
    }
    const [ws] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(and(eq(workspaces.orgId, c.orgId), eq(workspaces.kind, 'business')));
    if (!ws) throw new NotFoundException();
    const put = await this.storage.putCandidateDocument({ body: file.body, filename: file.filename, workspaceId: ws.id });
    await this.db.transaction(async (tx) => {
      await tx
        .delete(candidateDocuments)
        .where(and(eq(candidateDocuments.candidateId, c.id), eq(candidateDocuments.name, file.name)));
      await tx.insert(candidateDocuments).values({
        orgId: c.orgId,
        candidateId: c.id,
        name: file.name,
        objectKey: put.objectKey,
        filename: file.filename.slice(0, 200),
        sizeBytes: put.sizeBytes,
      });
      await writeHrAudit(tx, {
        actorUserId: null,
        subjectType: 'org',
        subjectId: c.orgId,
        eventType: 'hr.candidate_document_sent',
        orgId: c.orgId,
        diff: { candidateId: c.id, document: file.name, source: 'application_page' },
      });
    });
    return this.present(c);
  }

  /** Take the business's last figure, or ask for another one. */
  async respond(token: string, session: string | undefined, body: RespondToOfferRequest): Promise<ApplicationView> {
    const c = await this.opened(token, session);
    const rounds = await this.db
      .select()
      .from(offerRounds)
      .where(eq(offerRounds.candidateId, c.id))
      .orderBy(desc(offerRounds.createdAt));
    const last = rounds[0];
    if (c.stage !== 'offer' || c.agreedWageRwf !== null || !last || last.side !== 'business') {
      throw new ConflictException('There is no offer waiting for your answer.');
    }
    await this.db.transaction(async (tx) => {
      if ('accept' in body) {
        await tx
          .update(candidates)
          .set({ agreedWageRwf: last.amountRwf, offerWageRwf: last.amountRwf, updatedAt: new Date() })
          .where(eq(candidates.id, c.id));
      } else {
        await tx.insert(offerRounds).values({
          orgId: c.orgId,
          candidateId: c.id,
          side: 'candidate',
          amountRwf: body.askRwf,
          note: body.note?.trim() || null,
          byUserId: null,
        });
      }
      await writeHrAudit(tx, {
        actorUserId: null,
        subjectType: 'org',
        subjectId: c.orgId,
        eventType: 'accept' in body ? 'hr.offer_agreed' : 'hr.offer_round_added',
        orgId: c.orgId,
        diff:
          'accept' in body
            ? { candidateId: c.id, amountRwf: last.amountRwf, source: 'application_page' }
            : { candidateId: c.id, side: 'candidate', amountRwf: body.askRwf, source: 'application_page' },
      });
    });
    if ('accept' in body) {
      void this.mail.notify(c.id, { kind: 'agreed', amountRwf: last.amountRwf, startsOn: c.offerStartsOn }, null);
    }
    const [after] = await this.db.select().from(candidates).where(eq(candidates.id, c.id));
    return this.present(after);
  }

  private async byToken(token: string): Promise<CandidateRow> {
    const [c] = await this.db.select().from(candidates).where(eq(candidates.accessToken, token));
    if (!c) throw new NotFoundException('That link is not right, or the application was removed.');
    return c;
  }

  /** The application, when the session presented is this one's and still good. */
  private async opened(token: string, session: string | undefined): Promise<CandidateRow> {
    const c = await this.byToken(token);
    if (
      !session ||
      !c.accessSessionHash ||
      !c.accessSessionExpiresAt ||
      c.accessSessionExpiresAt.getTime() < Date.now() ||
      !same(hash(session), c.accessSessionHash)
    ) {
      throw new UnauthorizedException('Open the page with the code we email you.');
    }
    return c;
  }

  private async present(c: CandidateRow): Promise<ApplicationView> {
    const [v] = await this.db.select().from(vacancies).where(eq(vacancies.id, c.vacancyId));
    const [org] = await this.db.select({ name: orgs.legalName }).from(orgs).where(eq(orgs.id, c.orgId));
    const [branch] = v?.propertyId
      ? await this.db.select({ name: properties.name }).from(properties).where(eq(properties.id, v.propertyId))
      : [];
    const [interview] = await this.db
      .select()
      .from(interviews)
      .where(and(eq(interviews.candidateId, c.id), ne(interviews.status, 'cancelled')))
      .orderBy(desc(interviews.startsAt))
      .limit(1);
    const docs = await this.db.select().from(candidateDocuments).where(eq(candidateDocuments.candidateId, c.id));
    const rounds = await this.db
      .select()
      .from(offerRounds)
      .where(eq(offerRounds.candidateId, c.id))
      .orderBy(asc(offerRounds.createdAt));
    const last = rounds.at(-1);
    return {
      firstName: c.fullName.split(' ')[0],
      role: v?.title ?? '',
      business: org?.name ?? '',
      branch: branch?.name ?? null,
      stage: c.stage,
      appliedOn: c.appliedOn,
      interview: interview
        ? {
            startsAt: interview.startsAt.toISOString(),
            place: interview.place,
            interviewerName: interview.interviewerName,
          }
        : null,
      documents: (v?.requiredDocuments ?? []).map((name) => {
        const d = docs.find((x) => x.name === name);
        return { name, filename: d?.filename ?? null, uploadedAt: d?.uploadedAt.toISOString() ?? null };
      }),
      offer:
        (c.stage === 'offer' || c.stage === 'hired') && (c.offerWageRwf !== null || last)
          ? {
              // The business's figure on the table: an ask of theirs is in the rounds, not the headline.
              amountRwf: c.agreedWageRwf ?? c.offerWageRwf ?? [...rounds].reverse().find((r) => r.side === 'business')?.amountRwf ?? 0,
              startsOn: c.offerStartsOn,
              agreedRwf: c.agreedWageRwf,
              rounds: rounds.map((r) => ({
                side: r.side,
                amountRwf: r.amountRwf,
                note: r.note,
                createdAt: r.createdAt.toISOString(),
              })),
              canRespond: c.stage === 'offer' && c.agreedWageRwf === null && last?.side === 'business',
            }
          : null,
      closedReason: c.stage === 'rejected' ? c.rejectReason : null,
    };
  }
}
