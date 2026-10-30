/**
 * The labels on a property's doors (setup after approval, 2026-09-13).
 *
 * A label is how a receptionist, a housekeeper and a lease all name the same
 * room, so two rooms on one property must never share one: "clean room 12"
 * has to mean exactly one room. Compared case and space insensitively, because
 * "Room 12" and "room  12" are the same door to the person reading the board.
 *
 * Pure, so the rule is tested without a database and read the same way by the
 * room type create (which may name its rooms) and the rooms route.
 */

/** The form two labels are compared in. */
export function labelKey(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Labels for rooms nobody named: the room type's name and a running number,
 * `Deluxe Double 1`, `Deluxe Double 2`.
 *
 * Numbered after the room type rather than bare `1, 2, 3` because a property
 * with two room types would otherwise mint two `1`s and refuse its own create.
 * Numbering starts after any rooms the type already has, so adding three more
 * to a type with four gives 5, 6 and 7.
 */
export function numberedLabels(
  roomTypeName: string,
  count: number,
  startAfter = 0,
): string[] {
  const stem = roomTypeName.trim().replace(/\s+/g, ' ');
  return Array.from({ length: count }, (_, i) => `${stem} ${startAfter + i + 1}`);
}

/**
 * Every label that would collide: repeated inside the request, or already on a
 * door of this property. Returned as the operator typed them, deduplicated, so
 * the refusal can name them.
 */
export function collidingLabels(
  requested: readonly string[],
  existing: readonly (string | null)[],
): string[] {
  const taken = new Set(existing.filter((l): l is string => l !== null).map(labelKey));
  const seen = new Set<string>();
  const clashes = new Map<string, string>();
  for (const label of requested) {
    const key = labelKey(label);
    if (taken.has(key) || seen.has(key)) clashes.set(key, label.trim());
    seen.add(key);
  }
  return [...clashes.values()];
}

/** The unique index behind the rule, for the race the read above cannot see. */
export const ROOM_LABEL_UNIQUE = 'rooms_property_label_uk';

/**
 * Did a rooms write lose a race for a label (platform audit step 3)?
 *
 * `collidingLabels` is read before the write, so two concurrent adds of the
 * same label both pass it; `rooms_property_label_uk` then refuses the second
 * with a 23505. That is the same collision and gets the same refusal, never a
 * 500. Only that constraint: any other unique violation is not a label clash.
 * Drizzle may wrap the driver error, so its `cause` is read too.
 */
export function isRoomLabelCollision(err: unknown): boolean {
  const candidates = [err, (err as { cause?: unknown } | null)?.cause];
  return candidates.some(
    (e) =>
      typeof e === 'object' &&
      e !== null &&
      (e as { code?: string }).code === '23505' &&
      (e as { constraint?: string }).constraint === ROOM_LABEL_UNIQUE,
  );
}
