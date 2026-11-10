import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';

import { candidateDocuments, candidates, orgs, properties, users, vacancies } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { resolveAppUrl } from '../../../shared/config/app-url';
import { MAILER_PORT, type MailerPort } from '../../mailer/domain/mailer-port';
import { applicationLink, talentMail, type TalentMailEvent } from '../domain/talent-mail';

/**
 * Mails an applicant each step of their application (058-talent), through the mailer seam.
 *
 * The shape `StayInvitationMailer` set: an origin read once (`APP_URL`, since the applicant's page is
 * in the app), an 8 second ceiling, and a send that NEVER THROWS. An applicant's email is a courtesy around a decision HR has already saved; a relay
 * that is down is no reason to undo the move. A failure is logged and `false` comes back.
 *
 * Replies go to whoever made the move (their sign-in address), so a candidate who answers the mail
 * writes to a person at the business, not to a no-reply box.
 */
@Injectable()
export class TalentMailer {
  private static readonly SEND_TIMEOUT_MS = 8_000;
  private readonly logger = new Logger(TalentMailer.name);
  private readonly appUrl: string;

  constructor(
    @Inject(MAILER_PORT) private readonly mailer: MailerPort,
    @Inject(DRIZZLE) private readonly db: Database,
    config: ConfigService,
  ) {
    this.appUrl = resolveAppUrl({ appUrl: config.get<string>('APP_URL'), nodeEnv: config.get<string>('NODE_ENV') });
  }

  /** The applicant's progress page, for the email and for HR to share another way. */
  link(token: string): string {
    return applicationLink(this.appUrl, token);
  }

  /** Mail one step to the applicant. Resolves to whether it went; never rejects. */
  async notify(candidateId: string, event: TalentMailEvent, byUserId: string | null): Promise<boolean> {
    try {
      const [c] = await this.db.select().from(candidates).where(eq(candidates.id, candidateId));
      if (!c?.email || !c.accessToken) return false;
      const [v] = await this.db.select().from(vacancies).where(eq(vacancies.id, c.vacancyId));
      const [org] = await this.db.select({ name: orgs.legalName }).from(orgs).where(eq(orgs.id, c.orgId));
      const [branch] = v?.propertyId
        ? await this.db.select({ name: properties.name }).from(properties).where(eq(properties.id, v.propertyId))
        : [];
      const sent = await this.db
        .select({ name: candidateDocuments.name })
        .from(candidateDocuments)
        .where(eq(candidateDocuments.candidateId, c.id));
      const [by] = byUserId ? await this.db.select({ email: users.email }).from(users).where(eq(users.id, byUserId)) : [];
      const have = new Set(sent.map((d) => d.name));
      const mail = talentMail(event, {
        firstName: c.fullName.split(' ')[0],
        role: v?.title ?? 'the role',
        business: branch?.name ?? org?.name ?? 'the business',
        link: this.link(c.accessToken),
        documentsToSend: (v?.requiredDocuments ?? []).filter((d) => !have.has(d)),
      });
      await this.withTimeout(this.mailer.send({ to: c.email, ...mail, ...(by?.email ? { replyTo: by.email } : {}) }));
      this.logger.log(`Applicant mail "${event.kind}" for candidate ${c.id} sent.`);
      return true;
    } catch (cause) {
      this.logger.error(
        `Applicant mail "${event.kind}" for candidate ${candidateId} was not sent: ${
          cause instanceof Error ? cause.message : 'mail transport failed'
        }. The step stands.`,
      );
      return false;
    }
  }

  private async withTimeout(send: Promise<void>): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        send,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`mail transport did not respond within ${TalentMailer.SEND_TIMEOUT_MS}ms`)),
            TalentMailer.SEND_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
