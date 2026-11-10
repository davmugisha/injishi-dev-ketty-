import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import {
  departmentMembers,
  employees,
  hrCounters,
  hrSettings,
  orgMemberships,
  users,
} from '../../../database/drizzle/schema';
import type { Database } from '../../../shared/database/database.module';
import { kigaliToday } from '../domain/hr-calendar';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Plain functions over a transaction, rather than repository methods, because
 * two modules write a file: HR when a person is put on file, and the
 * organization module when somebody accepts a Team invitation (AC-J2). Both
 * must mint numbers the same way, inside their own transaction.
 */

/** The business's number prefix (058-people-file AC-PF12), or none. */
async function employeeNumberPrefixTx(tx: Tx | Database, orgId: string): Promise<string> {
  const [row] = await tx
    .select({ prefix: hrSettings.employeeNumberPrefix })
    .from(hrSettings)
    .where(eq(hrSettings.orgId, orgId))
    .limit(1);
  return row?.prefix ?? '';
}

/**
 * The next free employee number for a business: `0001`, or `EMP0001` with a
 * prefix (AC-P1, AC-PF12).
 *
 * `INSERT … ON CONFLICT DO UPDATE … RETURNING` takes the number and moves the
 * counter in one statement, so two creates at once take two numbers. The
 * counter is the business's whatever the prefix: setting one changes how new
 * numbers read, and never re-issues or renames one. A number somebody TYPED
 * onto a file is skipped rather than minted a second time.
 */
export async function mintEmployeeNumberTx(tx: Tx, orgId: string): Promise<string> {
  const prefix = await employeeNumberPrefixTx(tx, orgId);
  for (let attempt = 0; attempt < 1000; attempt++) {
    const [row] = await tx
      .insert(hrCounters)
      .values({ orgId, nextEmployeeNumber: 2 })
      .onConflictDoUpdate({
        target: hrCounters.orgId,
        set: {
          nextEmployeeNumber: sql`${hrCounters.nextEmployeeNumber} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning({ minted: sql<number>`${hrCounters.nextEmployeeNumber} - 1` });
    const candidate = `${prefix}${String(row.minted).padStart(4, '0')}`;
    const [taken] = await tx
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.orgId, orgId), eq(employees.employeeNumber, candidate)))
      .limit(1);
    if (!taken) return candidate;
  }
  throw new Error('Could not mint an employee number.');
}

/**
 * Every way into a business ends with a file (058-self-service AC-J2).
 *
 * Called inside the transaction that wrote or reactivated a membership. An
 * active file already on the membership is kept. A file HR wrote BEFORE the
 * login is linked rather than doubled (HR onboarding): the file the invitation
 * was given for (`employeeId`), else the one active file of the business with
 * no account whose email is the account's. Otherwise a thin file is
 * written, as migration 0053's backfill wrote one for every member: the name
 * from the account (else its email), its email and proved phone, today in
 * Kigali as the hire date, a minted number, and the statutory fields empty so
 * `detailsMissing` names them. A returning person's new file names their last
 * one at this business in `previous_employee_id` (AC-PF14), and their department
 * rows that name no file are pointed at it.
 */
export async function ensureStaffFileTx(
  tx: Tx,
  input: { orgId: string; membershipId: string; employeeId?: string | null },
): Promise<string> {
  const [active] = await tx
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.orgMembershipId, input.membershipId), eq(employees.status, 'active')))
    .limit(1);
  if (active) return active.id;

  const [person] = await tx
    .select({ name: users.name, email: users.email, phone: users.phoneNumber })
    .from(orgMemberships)
    .innerJoin(users, eq(users.id, orgMemberships.userId))
    .where(eq(orgMemberships.id, input.membershipId))
    .limit(1);
  if (!person) throw new Error('A membership with no account cannot have a file written for it.');

  const onFile = await unlinkedFileTx(tx, input.orgId, input.employeeId ?? null, person.email);
  if (onFile) {
    await tx
      .update(employees)
      .set({ orgMembershipId: input.membershipId, updatedAt: new Date() })
      .where(eq(employees.id, onFile));
    await tx
      .update(departmentMembers)
      .set({ employeeId: onFile, updatedAt: new Date() })
      .where(
        and(
          eq(departmentMembers.orgMembershipId, input.membershipId),
          isNull(departmentMembers.employeeId),
        ),
      );
    return onFile;
  }

  const [previous] = await tx
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.orgId, input.orgId),
        eq(employees.orgMembershipId, input.membershipId),
        eq(employees.status, 'offboarded'),
      ),
    )
    .orderBy(desc(employees.offboardedOn))
    .limit(1);

  const today = kigaliToday();
  const employeeNumber = await mintEmployeeNumberTx(tx, input.orgId);
  const legalName = person.name?.trim() || person.email.split('@')[0];
  const [row] = await tx
    .insert(employees)
    .values({
      orgId: input.orgId,
      orgMembershipId: input.membershipId,
      employeeNumber,
      legalName,
      phone: person.phone,
      email: person.email.toLowerCase(),
      hiredOn: today,
      serviceFrom: today,
      previousEmployeeId: previous?.id ?? null,
    })
    .returning({ id: employees.id });

  await tx
    .update(departmentMembers)
    .set({ employeeId: row.id, updatedAt: new Date() })
    .where(
      and(
        eq(departmentMembers.orgMembershipId, input.membershipId),
        isNull(departmentMembers.employeeId),
      ),
    );
  return row.id;
}

/**
 * The file HR wrote for this person before they had a login: active, of this business, with no
 * account yet. The one named, when it still qualifies; else the single such file carrying the
 * account's email (two of them is ambiguous, and then none is guessed).
 */
async function unlinkedFileTx(
  tx: Tx,
  orgId: string,
  employeeId: string | null,
  email: string,
): Promise<string | null> {
  const unlinked = and(
    eq(employees.orgId, orgId),
    eq(employees.status, 'active'),
    isNull(employees.orgMembershipId),
  );
  if (employeeId) {
    const [named] = await tx
      .select({ id: employees.id })
      .from(employees)
      .where(and(unlinked, eq(employees.id, employeeId)))
      .limit(1);
    if (named) return named.id;
  }
  const byEmail = await tx
    .select({ id: employees.id })
    .from(employees)
    .where(and(unlinked, sql`lower(${employees.email}) = ${email.toLowerCase()}`))
    .limit(2);
  return byEmail.length === 1 ? byEmail[0].id : null;
}
