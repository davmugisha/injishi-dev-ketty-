import { inArray } from 'drizzle-orm';

import { departments, jobPositions, leaveTypes, properties, shiftTemplates } from '../../../database/drizzle/schema';
import type { Database } from '../../../shared/database/database.module';

/**
 * Names for the ids a grouped HR list shows (058-list-framework): a page
 * grouped by branch heads each group with the branch's name, not its id.
 *
 * Keyed by the list field, because every HR list names a reference the same
 * way (`branch`, `jobPosition`, `department`, `shift`, `leaveType`). A field
 * this does not know gets no names, and `groupsOf` falls back to the raw value.
 */
export async function refLabels(
  db: Database,
  field: string | undefined,
  keys: readonly unknown[],
): Promise<Map<string, string>> {
  const ids = [...new Set(keys.filter((k): k is string => typeof k === 'string'))];
  if (ids.length === 0) return new Map();
  let rows: { id: string; name: string }[];
  switch (field) {
    case 'branch':
      rows = await db.select({ id: properties.id, name: properties.name }).from(properties).where(inArray(properties.id, ids));
      break;
    case 'jobPosition':
      rows = await db
        .select({ id: jobPositions.id, name: jobPositions.title })
        .from(jobPositions)
        .where(inArray(jobPositions.id, ids));
      break;
    case 'department':
      rows = await db
        .select({ id: departments.id, name: departments.name })
        .from(departments)
        .where(inArray(departments.id, ids));
      break;
    case 'shift':
      rows = await db
        .select({ id: shiftTemplates.id, name: shiftTemplates.name })
        .from(shiftTemplates)
        .where(inArray(shiftTemplates.id, ids));
      break;
    case 'leaveType':
      rows = await db.select({ id: leaveTypes.id, name: leaveTypes.name }).from(leaveTypes).where(inArray(leaveTypes.id, ids));
      break;
    default:
      return new Map();
  }
  return new Map(rows.map((r) => [r.id, r.name]));
}
