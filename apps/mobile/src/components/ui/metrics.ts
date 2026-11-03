/**
 * Every fixed dimension the UI kit draws with, named (mobile spec 0002, D-m). In dp.
 *
 * Nothing in `src/components/ui/` types a size: it reads one of these, a step of the
 * package's `rnSpace` (the 4 px grid, D-v), or a role of the type table in `text.tsx`.
 *
 * The entries after `errorTile` are the prototype's classes (`.design/mobile-prototype/proto/base.css`),
 * each named for the part that draws it, at the prototype's size or the nearest size that keeps the
 * 48 touch floor. Screens read them too (`metrics.photo.card`), so a re-tune moves every caller.
 */
export const metrics = {
  /** The floor for every pressable, by padding or minimum size, never `hitSlop` (D-p). */
  touch: 48,
  /** The circle an `IconButton` draws inside its 48 box. */
  iconButton: 40,
  /** `Button` heights: `lg` for staff and desk surfaces, `md` everywhere else (D-o). */
  buttonHeight: { sm: 36, md: 48, lg: 56 },
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

  /** `.li.big`: a list row with a thumbnail or two lines of subtitle. */
  rowLarge: 64,
  /** `.top`: a tab root's header, at least this tall. */
  header: 52,
  /** `.tile-ic.lg`: the large icon tile (a choice, a receipt row). */
  iconTileLarge: 48,
  /** `.ava` sizes: s, m (the row avatar), l, xl. */
  avatarSize: { s: 32, m: 40, l: 56, xl: 76 },
  /** `.dot`: the unread dot on an icon button; `.tdot` on a tab. */
  badgeDot: 10,
  /** `.count`: a number badge's height and minimum width. */
  countBadge: 18,
  /** `.live`: the live dot, and the soft halo around it. */
  liveDot: 8,
  liveHalo: 14,
  /** `.fchip`: a filter chip's pill, inside its 48 press area. */
  filterChip: 36,
  /** `.seg > span`: a segment's pill, inside its 48 press area. */
  segment: 40,
  /** `.input`: a field's minimum height; `.input.area` for several lines. */
  input: 52,
  textArea: 96,
  /** `.search` and the guest search pill. */
  searchBar: 52,
  /** `.composer .input`: the message field. */
  composerInput: 48,
  /** `.otp span`: one code box. */
  otpBox: 56,
  /** `.keypad span`: one key. */
  keypadKey: 64,
  /** `.pinrow i`: one PIN dot. */
  pinDot: 14,
  /** `.toggle`: the track, its thumb, and the thumb's gap to the track's edge. */
  toggle: { width: 48, height: 28, thumb: 22, inset: 3 },
  /** `.radio`: the ring and its dot; `.check`: the box. */
  radio: 22,
  radioDot: 10,
  checkbox: 24,
  /** `.stepper span.b`: the round minus and plus. */
  stepperButton: 36,
  /** `.tl .st .d`: a timeline step's disc, and the line between discs. */
  timelineDot: 28,
  timelineLine: 2,
  /** `.bar`: a progress bar, and its thin form; `.steps i`. */
  progress: { md: 8, thin: 4 },
  stepBar: 4,
  /** `.spark`: a KPI's bar chart. */
  sparkline: 28,
  /** `ring()`: the default progress ring and its stroke. */
  ring: { size: 76, stroke: 7 },
  /** `.spinner`: the three spinner sizes. */
  spinner: { sm: 20, md: 32, lg: 64 },
  /** `.sheet::before`: the grabber. */
  grabber: { width: 40, height: 5 },
  /** `.rcell`: a room cell's minimum height. */
  roomCell: 76,
  /** `.scanframe`: the frame, its corner marks and their stroke. */
  scanFrame: { size: 240, corner: 48, stroke: 4 },
  /** `qr()`: the default code side. */
  qr: 168,
  /** `.map`: the card map's height. */
  map: 180,
  /** `.pin`: a map price pin. */
  mapPin: 28,
  /** `.dots i`: a pager dot, and the stretched current one. */
  pagerDot: 6,
  pagerDotActive: 16,
  /** Photo heights: `.rx-room .im`, `.gx-ex .im`, `.gx-photo-up`, `.gx-pcard .ph-im`, `.hero`, the guest home bleed. */
  photo: { thumb: 84, tile: 116, banner: 170, card: 210, hero: 300, bleed: 380 },
} as const;

/** The six icon sizes (AC-10). */
export const iconSizes = [12, 16, 20, 24, 32, 40] as const;
export type IconSize = (typeof iconSizes)[number];
