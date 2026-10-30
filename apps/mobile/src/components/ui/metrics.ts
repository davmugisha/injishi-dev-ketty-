/**
 * Every fixed dimension the UI kit draws with, named (mobile spec 0002, D-m). In dp.
 *
 * Nothing in `src/components/ui/` types a size: it reads one of these, a step of the
 * package's `rnSpace` (the 4 px grid, D-v), or a role of the type table in `text.tsx`.
 */
export const metrics = {
  /** The floor for every pressable, by padding or minimum size, never `hitSlop` (D-p). */
  touch: 48,
  /** The circle an `IconButton` draws inside its 48 box. */
  iconButton: 40,
  /** `Button` heights: `lg` for staff and desk surfaces, `md` everywhere else (D-o). */
  buttonHeight: { md: 48, lg: 56 },
  /** A row is at least this tall, or its leading item plus `rowInset` above and below. */
  rowMin: 56,
  rowInset: 12,
  /** Row leading items: icon tile, avatar, thumbnail. */
  iconTile: 40,
  avatar: 40,
  thumb: 48,
  /** The icon tiles of the empty and error views (`shared-10-empty`, `shared-11-error`). */
  emptyTile: 120,
  errorTile: 112,
} as const;

/** The six icon sizes (AC-10). */
export const iconSizes = [12, 16, 20, 24, 32, 40] as const;
export type IconSize = (typeof iconSizes)[number];
