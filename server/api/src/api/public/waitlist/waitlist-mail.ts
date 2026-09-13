/**
 * The welcome note's job contract (ADR-048 AC-11).
 *
 * THE JOB CARRIES A ROW ID AND NOTHING ELSE, which is the rule
 * `BookingMailProcessor` already set and which matters more here than there.
 *
 * No personal data goes into Redis. A queued job is a row in a second store
 * with its own retention and its own backups, and the whole point of this
 * feature under Law 058/2021 is that somebody's name, address and phone number
 * live in one place, under one privacy notice, with one route to erasure. A job
 * payload carrying the address would quietly be a second copy nobody promised
 * to delete.
 *
 * It also means a retry cannot deliver a stale fact. If the person unsubscribed
 * between the insert and the send, the processor reads that and sends nothing.
 */

export const WAITLIST_WELCOME_JOB = 'waitlist.welcome';

export interface WaitlistWelcomeJob {
  signupId: string;
}
