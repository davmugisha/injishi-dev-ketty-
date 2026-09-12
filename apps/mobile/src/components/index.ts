/**
 * The component barrel. **Frozen after Session 0** (MOBILE-PROTOTYPE-PROMPTS.md
 * Part 3): every primitive the 37 frames need is exported here in one pass, so
 * thirteen parallel branches never collide in this file.
 *
 * A session that needs a shared component the kit does not have builds it
 * INSIDE its own folder and names it in its report; Session 11 lifts the ones
 * two surfaces actually share into here. That order matters — a primitive
 * promoted before a second caller exists is a primitive whose API was designed
 * against one screen.
 *
 * **Session 11 ran that lift.** Six things had a second implementation, and
 * each one is marked `lifted by Session 11` below with the surfaces it came
 * from. The rule held: every one of them arrived here with two callers whose
 * disagreements were the API's real questions — the undo bar's dwell, the
 * chip's role, whether the adapter chip owed an explanatory line — and not one
 * of those questions could have been answered from the first caller alone.
 */

/* Typography, glyphs, colour-bearing atoms */
export { Text } from './text';
export { Icon, type IconName } from './icon';
export { Badge } from './badge';
export { StatusBadge, statusTone } from './status-badge';
export { DomainBadge, type Domain } from './domain-badge';
export { TaxBadge } from './tax-badge';
export { PaymentStatus } from './payment-status';
/* The async payment state machine's UI, added with gaps.md phase 1's X1. Both
   money screens render it, so the two cannot come to describe the same rail
   differently. */
export { PaymentPrompt, type PaymentPromptProps } from './payment-prompt';
/* lifted by Session 11 — landlord/adapter-chip + guest/book-parts + host/host-chrome */
export { AdapterChip, AdapterNote, type AdapterChipProps } from './adapter-chip';
export { MoneyAmount, formatMoney, splitMoney } from './money-amount';
export { MoneyBreakdown } from './money-breakdown';
export { Avatar } from './avatar';
export { ScoreChip, scoreBand } from './score-chip';

/* Controls */
export { Button } from './button';
export { PressableScale, type PressableScaleProps } from './pressable-scale';
export { Tag } from './tag';
export { ChipGroup, type ChipItem } from './chip-group';
/* lifted by Session 11 — guest/explore-chips + broker/broker-chips */
export { FilterChip, SearchPill, type FilterChipProps, type SearchPillProps } from './filter-chip';
export { SegmentedTabs, type TabItem } from './segmented-tabs';
export { HeartButton } from './heart-button';
export { InputField, TextArea, type InputFieldProps, type TextAreaProps } from './input-field';
export { SignaturePad } from './signature-pad';
export { PhotoPicker, type PickedPhoto } from './photo-picker';

/* Containers and rows */
export { Card } from './card';
export { StatCard } from './stat-card';
export { StatRow, type StatRowProps } from './stat-row';
export { ListRow, type ListRowProps } from './list-row';
export { ListingCard, type Listing } from './listing-card';
export { SwipeableRow, type SwipeAction } from './swipeable-row';

/* Page scaffolding */
export { Screen, SectionLabel } from './screen';
export { Sheet, type SheetProps } from './sheet';
/* lifted by Session 11 — tenant/modal-sheet + work/inline-sheet */
export { ModalSheet, type ModalSheetProps } from './modal-sheet';
export { WorkspaceChip } from './workspace-chip';
export { BackHeader } from './back-header';
export { StickyBar } from './sticky-bar';
export { ComingSoon, type ComingSoonProps } from './coming-soon';

/* Photography, and the licence obligation that travels with it */
export { ImageHeader, Gallery, type ImageHeaderProps, type GalleryProps } from './image-header';
export { PhotoCredit, type PhotoCreditProps } from './photo-credit';

/* Progress, time and sequence */
export { Stepper } from './stepper';
export { ProgressSteps, type ProgressStep, type ProgressStepsProps } from './progress-steps';
export { Timeline, type TimelineEntry, type TimelineState } from './timeline';
export { Countdown, Elapsed, formatDuration, elapsedSeconds } from './countdown';
export {
  CalendarRange,
  nextRange,
  nightsBetween,
  todayIso,
  isoDay,
  type DateRange,
  type IsoDay,
} from './calendar-range';

/* The four states every list owes its reader */
export { EmptyState } from './empty-state';
export { ErrorState } from './error-state';
/* The inline form/sheet failure, added with gaps.md phase 1. `ErrorState`
   replaces a screen; this sits inside one that is still usable. */
export { WriteError, type WriteErrorProps } from './write-error';
export { Skeleton, SkeletonList } from './skeleton';
/* `useOffline` and `OfflineNote` lifted by Session 11 — eleven hand-written copies */
export { OfflineBanner, OfflineNote, useOffline } from './offline-banner';
/* The visible half of the offline write queue (X2). Mounted beside the offline
   banner: that one says the app cannot reach the network, this one says what
   the app is holding on the person's behalf because of it. */
export { QueueBanner } from './queue-banner';

/* Feedback */
export { ToastProvider, useToast, TOAST_MS, type ToastTone } from './toast';
/* lifted by Session 11 — saved/undo-bar + host/host-undo-bar */
export {
  UndoBar,
  UNDO_MS,
  UNDO_SCREEN_READER_MS,
  announcesExplicitly,
  type UndoBarProps,
  type UndoState,
} from './undo-bar';
