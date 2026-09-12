/**
 * Reviews — the guest half of F-B14's two-sided, double-blind pair.
 *
 * Six categories and a comment, one review per stay per side, and neither side
 * visible until both have submitted or the ~14-day window closes. The mobile
 * app writes the guest's half and never reads the host's, which is not a
 * simplification — it is the double-blind rule. A screen that could read the
 * host's review before publication would be the leak the feature exists to
 * prevent, so there is no fixture for it and no hook that would return one.
 *
 * What the app CAN say is whether the pair has published, and that is
 * `ReviewPair.published`. Until it flips, the trip shows "waiting on the host",
 * which is the honest reading of a pending pair and the copy F-B14 asks for.
 *
 * The categories are the spec's own six, in the spec's own order. They are not
 * a preference: they aggregate to the Room type and then to the property, and a
 * seventh invented here would aggregate to nothing.
 */
import { useCallback } from 'react';
import type { MessageKey } from '@/i18n/i18n';
import { readFixture, useFixtureMutation, useFixtureValue } from './use-fixture-mutation';

/** F-B14 §6, verbatim and in order. */
export const REVIEW_CATEGORIES = [
  'cleanliness',
  'accuracy',
  'checkIn',
  'communication',
  'location',
  'value',
] as const;

export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<ReviewCategory, MessageKey> = {
  cleanliness: 'review.cleanliness',
  accuracy: 'review.accuracy',
  checkIn: 'review.checkIn',
  communication: 'review.communication',
  location: 'review.location',
  value: 'review.value',
};

/** Five stars per category. `0` is "not rated yet", never a rating of zero. */
export type Stars = 0 | 1 | 2 | 3 | 4 | 5;

export type CategoryScores = Record<ReviewCategory, Stars>;

export const EMPTY_SCORES: CategoryScores = {
  cleanliness: 0,
  accuracy: 0,
  checkIn: 0,
  communication: 0,
  location: 0,
  value: 0,
};

export interface TripReview {
  bookingId: string;
  scores: CategoryScores;
  comment: string;
  /** Epoch ms the guest submitted. */
  submittedAt: number;
  /**
   * Whether the PAIR has published — both sides in, or the window closed. The
   * host's own review is never in this app; this is the only fact about it the
   * guest is entitled to before publication.
   */
  published: boolean;
}

/**
 * The overall rating out of five: the mean of the categories that were rated.
 *
 * F-B14 collects "overall + six categories". Deriving the overall rather than
 * asking for a seventh tap is a deliberate call and worth reading twice: a
 * hand-entered overall that disagrees with its own categories is a review whose
 * aggregate nobody can explain, and the web listing page already learned that
 * lesson with `score` and `rating` in `./stays`. Rounded to one decimal, which
 * is what a property page prints.
 */
export function overallFromScores(scores: CategoryScores): number {
  const rated: number[] = REVIEW_CATEGORIES.map((key) => scores[key]).filter((n) => n > 0);
  if (rated.length === 0) return 0;
  const mean = rated.reduce((sum, n) => sum + n, 0) / rated.length;
  return Math.round(mean * 10) / 10;
}

/** Every category rated. One unrated category is an aggregate with a hole in it. */
export function reviewComplete(scores: CategoryScores): boolean {
  return REVIEW_CATEGORIES.every((key) => scores[key] > 0);
}

/** The fixture key, and the shape of the endpoint that replaces it. */
export const REVIEWS_KEY = 'guest.reviews';

/**
 * One review already written, so the Trips list can draw BOTH past states.
 *
 * Without it "Leave a review" would render on every completed stay and the
 * branch where a stay has been reviewed would be code nobody had ever seen.
 * `BK-4310` in `./trips` is the stay it belongs to; the pair has published,
 * which is what a review 140 days old would be.
 */
export const TRIP_REVIEW_SEEDS: TripReview[] = [
  {
    bookingId: 'BK-4310',
    scores: {
      cleanliness: 4,
      accuracy: 4,
      checkIn: 5,
      communication: 4,
      location: 5,
      value: 5,
    },
    comment:
      'Plain and spotless, two minutes from the beach, and the watchman opened the gate at midnight without a word of complaint. Hot water only in the mornings, which they tell you up front.',
    submittedAt: Date.now() - 130 * 24 * 60 * 60 * 1000,
    published: true,
  },
];

export interface TripReviews {
  all: readonly TripReview[];
  reviewFor: (bookingId: string) => TripReview | undefined;
  /** One review per stay per side, DB-enforced. This is the client half of it. */
  hasReviewed: (bookingId: string) => boolean;
}

export function useTripReviews(): TripReviews {
  const all = useFixtureValue<TripReview[]>(REVIEWS_KEY, () => TRIP_REVIEW_SEEDS);
  const reviewFor = useCallback(
    (bookingId: string) => all.find((r) => r.bookingId === bookingId),
    [all],
  );
  return { all, reviewFor, hasReviewed: (id) => !!reviewFor(id) };
}

export interface SubmitReviewInput {
  bookingId: string;
  scores: CategoryScores;
  comment: string;
}

/**
 * A submitted review replaces any earlier one for the same booking rather than
 * appending. One per stay per side is enforced by the database; a client that
 * appended would be a client whose list disagreed with the server's after one
 * double tap on a slow connection.
 *
 * `published: false` on the way in, always. The pair publishes when the host
 * submits or the window closes, and neither is something this app can observe —
 * so claiming otherwise at write time would be the one lie F-B14 rules out.
 */
function applyReview(current: TripReview[], input: SubmitReviewInput): TripReview[] {
  const others = current.filter((r) => r.bookingId !== input.bookingId);
  return [
    ...others,
    {
      bookingId: input.bookingId,
      scores: input.scores,
      comment: input.comment.trim(),
      submittedAt: Date.now(),
      published: false,
    },
  ];
}

export function useSubmitReview() {
  const { mutate, status, error, reset } = useFixtureMutation<TripReview[], SubmitReviewInput>(
    REVIEWS_KEY,
    applyReview,
    () => TRIP_REVIEW_SEEDS,
  );
  return { submit: mutate, status, error, reset };
}

/** Read once, outside a component — for a selector that is not in a render. */
export function readReview(bookingId: string): TripReview | undefined {
  return readFixture<TripReview[]>(REVIEWS_KEY, TRIP_REVIEW_SEEDS).find(
    (r) => r.bookingId === bookingId,
  );
}
