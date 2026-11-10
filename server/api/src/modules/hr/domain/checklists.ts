/**
 * Checklists (ADR-058): the arithmetic of copying a template onto a person.
 *
 * Pure: every input is a value, so the same template, person and day always
 * give the same tasks.
 */

export type ChecklistKind = 'onboarding' | 'offboarding';

export interface TemplateItem {
  label: string;
  sortOrder: number;
  byEmployee: boolean;
  dueAfterDays: number;
  /** Only for people in this job; null is everybody. */
  jobPositionId: string | null;
  code?: string | null;
  detail?: string | null;
  ownerOnly?: boolean;
}

export interface TaskToWrite {
  label: string;
  sortOrder: number;
  byEmployee: boolean;
  dueOn: string;
  code: string | null;
  detail: string | null;
  ownerOnly: boolean;
}

/** A date some days on, or back. UTC arithmetic on a calendar date, so no clock is involved. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The day a checklist's due dates count from.
 *
 * Joining counts from the first day, whenever the checklist is started: a task
 * due on day three of somebody who began a week ago is late, and should read
 * so. Leaving counts from the last day; before one is on file it counts from
 * today, which is the earliest a last day can be.
 */
export function anchorFor(
  kind: ChecklistKind,
  employee: { hiredOn: string; offboardedOn: string | null },
  today: string,
): string {
  return kind === 'onboarding' ? employee.hiredOn : (employee.offboardedOn ?? today);
}

/**
 * The tasks a person is given from a template: every task that is everybody's
 * and those for their own job, in the template's order, each with its day.
 */
export function tasksFor(
  items: readonly TemplateItem[],
  jobPositionId: string | null,
  anchorOn: string,
): TaskToWrite[] {
  return items
    .filter((item) => item.jobPositionId === null || item.jobPositionId === jobPositionId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({
      label: item.label,
      sortOrder: index,
      byEmployee: item.byEmployee,
      dueOn: addDays(anchorOn, item.dueAfterDays),
      code: item.code ?? null,
      detail: item.detail ?? null,
      ownerOnly: item.ownerOnly ?? false,
    }));
}

/** Tasks not done whose day has passed. A task due today is not late yet. */
export function overdueCount(tasks: readonly { dueOn: string; doneAt: Date | string | null }[], today: string): number {
  return tasks.filter((task) => task.doneAt === null && task.dueOn < today).length;
}
