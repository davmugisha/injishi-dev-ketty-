/**
 * Leaving a review — F-B14, two-sided and double-blind. A `formSheet` over the
 * trip, registered in `app/_layout.tsx` at the 0.55 / 0.95 detents.
 *
 * Six categories and a comment. The six are the spec's own, in the spec's own
 * order, and they are not a preference: they aggregate to the Room type and
 * then to the property, so a seventh invented here would aggregate to nothing.
 *
 * ## The double-blind block is the point, not a footnote
 *
 * The whole feature exists so neither side can retaliate, and that only works
 * if the guest knows it before they write. So the explanation sits above the
 * submit button, not under it and not on a help screen: "your host is writing
 * one about you at the same time, and neither shows until both are in or the
 * 14-day window closes". A reader who learns that afterwards has already
 * softened what they wrote.
 *
 * ## The overall rating is derived
 *
 * F-B14 collects "overall + six categories". `overallFromScores` averages the
 * six rather than asking for a seventh tap, because a hand-entered overall that
 * disagrees with its own categories is an aggregate nobody can explain — the
 * same mistake `score` and `rating` had already made in `@/data/stays`.
 *
 * ## One review per stay, per side
 *
 * DB-enforced on the server; enforced here by refusing to open on a stay that
 * already has one, with the date it went in. A form that accepted a second
 * review would be a form whose submit is a 409 nobody can act on.
 *
 * ## Hidden in v1, and honest while it waits
 *
 * Reviews are out of the v1.0 cut and the route is closed for everyone in
 * `app/_layout.tsx`; nothing links here any more (GK-11). What the sheet still
 * owes, for the day it returns (mobile audit 2026-10-05):
 *
 *   - a loading and an error state, rather than flashing "nothing to review"
 *     on a cold read or a failed one (GK-17);
 *   - the success toast only after the write lands (brief item 1);
 *   - the reviewer's name from the server, never the fixture persona, and no
 *     name line at all when the server has none (brief item 2).
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  ErrorState,
  Icon,
  PressableScale,
  Sheet,
  SkeletonList,
  Text,
  TextArea,
  useToast,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import { useMyIdentity } from '@/queries/profile';
import { formatDay } from '@/data/search';
import { reviewWindowOpen, useTrip } from '@/data/trips';
import {
  CATEGORY_LABEL,
  EMPTY_SCORES,
  REVIEW_CATEGORIES,
  reviewComplete,
  useSubmitReview,
  useTripReviews,
  type CategoryScores,
  type ReviewCategory,
  type Stars,
} from '@/data/trip-reviews';
import { shortName, starsSpokenLabel, tripDates, unratedCount } from './trip-format';
import { useNow } from './trip-clock';

const MAX_COMMENT = 1200;

export function TripReviewSheet({ id }: { id: string | undefined }) {
  const { c, space, radius } = useTheme();
  const t = useT();
  const router = useRouter();
  const toast = useToast();

  const { trip, status: readStatus, retry } = useTrip(id);
  const { reviewFor } = useTripReviews();
  const { submit, status } = useSubmitReview();
  const now = useNow();
  const me = useMyIdentity();

  const [scores, setScores] = useState<CategoryScores>(EMPTY_SCORES);
  const [comment, setComment] = useState('');

  const existing = trip ? reviewFor(trip.id) : undefined;
  const open = !!trip && reviewWindowOpen(trip, now);
  const saving = status === 'saving';

  if (readStatus === 'loading') {
    return (
      <Sheet title={t('review.title')} grabber>
        <SkeletonList rows={3} label={t('state.loadingList', { label: t('trips.listLabel') })} />
      </Sheet>
    );
  }

  if (readStatus === 'error') {
    return (
      <Sheet title={t('review.title')} grabber>
        <ErrorState
          title={t('state.errorTitle')}
          body={t('state.errorBody', { label: t('trips.listLabel') })}
          onRetry={retry}
        />
      </Sheet>
    );
  }

  if (!trip || (!open && !existing)) {
    return (
      <Sheet title={t('review.notFoundTitle')} grabber>
        <Note icon="calendar" text={t('review.notFoundBody')} />
      </Sheet>
    );
  }

  if (existing) {
    return (
      <Sheet
        title={t('review.alreadyTitle')}
        subtitle={t('review.subtitle', { property: trip.property, dates: tripDates(trip, t) })}
        grabber
      >
        <Note
          icon="checkCircle"
          text={t('review.alreadyBody', {
            date: formatDay(new Date(existing.submittedAt).toISOString().slice(0, 10), t),
          })}
        />
        <Note
          icon="eyeOff"
          text={existing.published ? t('trips.reviewPublished') : t('trips.reviewPending')}
        />
      </Sheet>
    );
  }

  const missing = unratedCount(scores);
  const ready = reviewComplete(scores);

  const send = async () => {
    const outcome = await submit({ bookingId: trip.id, scores, comment });
    if (outcome !== 'done') {
      // The review did not go in. Stay on the sheet with what was written.
      toast.show(t('write.failedTitle'), 'danger');
      return;
    }
    toast.show(t('review.doneToast'), 'success');
    router.back();
  };

  return (
    <Sheet
      title={t('review.title')}
      subtitle={t('review.subtitle', { property: trip.property, dates: tripDates(trip, t) })}
      grabber
      footer={
        <>
          {/* The reason lives with the disabled button, never on its own. */}
          {!ready ? (
            <View
              accessible
              accessibilityRole="alert"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Icon name="alertCircle" size={15} color={c.warning600} />
              <Text size="xs" color="textBody" style={{ flex: 1, lineHeight: 18 }}>
                {missing === 1 ? t('review.blockedOne') : t('review.blockedMany', { count: missing })}
              </Text>
            </View>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            block
            leadingIcon="send"
            disabled={!ready || saving}
            onPress={() => void send()}
          >
            {saving ? t('review.submitting') : t('review.submit')}
          </Button>
        </>
      }
    >
      <View style={{ gap: space[4] }}>
        {REVIEW_CATEGORIES.map((category) => (
          <StarRow
            key={category}
            category={category}
            value={scores[category]}
            onChange={(value) => setScores((prev) => ({ ...prev, [category]: value }))}
            t={t}
          />
        ))}
      </View>

      <TextArea
        label={t('review.commentLabel')}
        value={comment}
        onChangeText={setComment}
        placeholder={t('review.commentPlaceholder')}
        maxLength={MAX_COMMENT}
        rows={4}
      />

      {/* The double-blind explanation, above the button and not below it. */}
      <View
        accessible
        accessibilityRole="summary"
        style={{
          gap: 8,
          padding: space[4],
          borderRadius: radius.lg,
          backgroundColor: c.bgTint,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="eyeOff" size={16} color={c.brand700} />
          <Text weight="semibold" size="sm" color="brand900">
            {t('review.doubleBlindTitle')}
          </Text>
        </View>
        <Text size="sm" color="brand900" style={{ lineHeight: 19 }}>
          {t('review.doubleBlindBody')}
        </Text>
        {/* F-B14: individual reviews show as first name plus last initial, and
            only a name the server holds; never a guessed one. */}
        {me.fromServer ? (
          <Text size="sm" color="brand900" style={{ lineHeight: 19 }}>
            {t('review.nameShown', { name: shortName(me.name) })}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

/**
 * One category, five stars.
 *
 * The group carries the spoken label and the stars are hidden from assistive
 * tech behind it: five buttons that each announce "star, button" is a row a
 * screen-reader user has to count. What they hear instead is "Cleanliness, 4 of
 * 5 stars", and each star's own label says what tapping it would set.
 */
function StarRow({
  category,
  value,
  onChange,
  t,
}: {
  category: ReviewCategory;
  value: Stars;
  onChange: (value: Stars) => void;
  t: Translate;
}) {
  const { c, space } = useTheme();
  const label = t(CATEGORY_LABEL[category]);

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={starsSpokenLabel(label, value, t)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space[3],
        minHeight: 44,
      }}
    >
      <Text weight="medium" size="sm" color="textStrong" style={{ flex: 1 }}>
        {label}
      </Text>

      <View style={{ flexDirection: 'row', gap: 2 }}>
        {([1, 2, 3, 4, 5] as const).map((star) => {
          const on = value >= star;
          return (
            <PressableScale
              key={star}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t('review.a11ySetStars', { category: label, count: star })}
              haptic
              // Tapping the star you already sit on clears back to it minus one,
              // which is the only way to lower a rating on a five-star row
              // without a separate control.
              onPress={() => onChange((value === star ? star - 1 : star) as Stars)}
              // Drawn at 30 with hitSlop to the 44pt floor: five targets have
              // to fit beside a label on a 393pt viewport.
              hitSlop={7}
              style={{
                width: 30,
                height: 34,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="star" size={23} color={on ? c.warning500 : c.borderStrong} />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function Note({ icon, text }: { icon: 'calendar' | 'checkCircle' | 'eyeOff'; text: string }) {
  const { c, space, radius } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="summary"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space[3],
        padding: space[4],
        borderRadius: radius.lg,
        backgroundColor: c.surface2,
      }}
    >
      <Icon name={icon} size={17} color={c.textMuted} />
      <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 20 }}>
        {text}
      </Text>
    </View>
  );
}
