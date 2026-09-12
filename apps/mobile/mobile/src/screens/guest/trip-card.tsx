/**
 * The trip row on the Trips tab — one card per booking under the hero.
 *
 * Guest canvas artboard 9, `tripCard` in `screens-b.mjs`: title, location, a
 * status pill, then a footer of dates, nights, total and a chevron. The
 * anatomy is the artboard's; three things are Session 5's.
 *
 * **A past trip is muted, and mutes with opacity rather than with a paler
 * palette key.** The design brief's greyscale rule means a "dimmer" colour has
 * to stay legible, and hand-picking a second set of muted inks for one card is
 * how a surface ends up with two vocabularies for one idea. One opacity on the
 * whole card says "this is history" without inventing a colour.
 *
 * **The review row is part of the card, not a second card.** F-B14 gives the
 * CTA once per completed stay within the window, and a separate card for it
 * would be a card whose only content is a button — the "orphaned control" the
 * quality bar rules out. So it sits in the footer, under a hairline, and it
 * appears only where a review does not already exist.
 *
 * **A cancelled stay never offers a review.** "Past" and "completed" are not
 * the same word: nobody stayed in a cancelled booking, and F-B14 is explicit
 * that the CTA belongs to a completed stay. The card says what happened
 * instead, so the row is not simply missing without explanation.
 */
import { View } from 'react-native';
import {
  Icon,
  MoneyAmount,
  PressableScale,
  StatusBadge,
  Text,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { departureAt, REVIEW_WINDOW_MS, reviewWindowOpen, type Trip } from '@/data/trips';
import { overallFromScores, type TripReview } from '@/data/trip-reviews';
import { tripDateLine } from './trip-format';

export interface TripCardProps {
  trip: Trip;
  /** The guest's own review of this stay, if they have written one. */
  review: TripReview | undefined;
  onPress: () => void;
  /** Opens the review sheet. Absent on a card that cannot be reviewed. */
  onReview?: () => void;
  /** Injected so the whole list shares one clock rather than one each. */
  now: number;
}

export function TripCard({ trip, review, onPress, onReview, now }: TripCardProps) {
  const { c, space, radius, shadow } = useTheme();
  const t = useT();

  const past = trip.state === 'completed' || trip.state === 'cancelled';
  const canReview = !review && reviewWindowOpen(trip, now) && !!onReview;
  const footer = pastFooter();

  return (
    <View
      style={{
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderSubtle,
        borderRadius: radius.lg,
        overflow: 'hidden',
        // History, said once, in a way that survives greyscale.
        opacity: past ? 0.78 : 1,
        ...shadow.sm,
      }}
    >
      <PressableScale
        accessibilityLabel={t('trips.open', { property: trip.property })}
        accessibilityHint={tripDateLine(trip, t)}
        onPress={onPress}
        style={{ padding: space[4], gap: space[3] }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text family="display" weight="medium" size="lg" color="textStrong" numberOfLines={1}>
              {trip.property}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="mapPin" size={13} color={c.textMuted} />
              <Text size="sm" color="textMuted" numberOfLines={1} style={{ flex: 1 }}>
                {trip.location}
              </Text>
            </View>
          </View>
          <StatusBadge domain="booking" state={trip.state} />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingTop: 11,
            borderTopWidth: 1,
            borderTopColor: c.borderSubtle,
          }}
        >
          <Icon name="calendar" size={14} color={c.textMuted} />
          <Text size="sm" color="textBody" style={{ flex: 1 }} numberOfLines={1}>
            {tripDateLine(trip, t)}
          </Text>
          <MoneyAmount value={trip.total} strong size="sm" />
          <Icon name="chevronRight" size={17} color={c.textSubtle} />
        </View>
      </PressableScale>

      {canReview ? (
        <PressableScale
          accessibilityLabel={t('trips.leaveReview')}
          accessibilityHint={t('trips.reviewPrompt', { property: trip.property })}
          haptic
          onPress={onReview}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            // 44pt floor without growing the card: the row is the target.
            minHeight: 52,
            paddingHorizontal: space[4],
            paddingVertical: space[2],
            backgroundColor: c.bgTint,
            borderTopWidth: 1,
            borderTopColor: c.borderSubtle,
          }}
        >
          <Icon name="star" size={17} color={c.brand700} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text weight="semibold" size="sm" color="brand900">
              {t('trips.leaveReview')}
            </Text>
            <Text size="xs" color="textMuted" numberOfLines={1}>
              {reviewWindowText(trip, now, t)}
            </Text>
          </View>
          <Icon name="chevronRight" size={17} color={c.brand700} />
        </PressableScale>
      ) : footer ? (
        <View
          accessible
          accessibilityRole="summary"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[2],
            paddingHorizontal: space[4],
            paddingVertical: space[3],
            backgroundColor: c.surface2,
            borderTopWidth: 1,
            borderTopColor: c.borderSubtle,
          }}
        >
          <Icon name={footer.icon} size={15} color={c.textMuted} />
          <Text size="xs" color="textMuted" style={{ flex: 1, lineHeight: 18 }}>
            {footer.text}
          </Text>
        </View>
      ) : null}
    </View>
  );

  /**
   * What a past card says where the review row would be. Four answers, and
   * every one of them is a different fact:
   * reviewed and published, reviewed and waiting on the host, the window has
   * closed, or the booking was cancelled and there is nothing to review.
   */
  function pastFooter(): { icon: 'star' | 'clock' | 'xCircle'; text: string } | null {
    if (trip.state === 'cancelled') {
      return { icon: 'xCircle', text: t('trip.cancelledNote') };
    }
    if (review) {
      const score = overallFromScores(review.scores).toFixed(1);
      const status = review.published ? t('trips.reviewPublished') : t('trips.reviewPending');
      return { icon: 'star', text: `${t('trips.reviewed', { score })} ${status}` };
    }
    if (trip.state === 'completed') {
      return { icon: 'clock', text: t('trips.reviewClosed') };
    }
    return null;
  }
}

/** How long is left of F-B14's ~14 days, as the sentence under the CTA. */
function reviewWindowText(trip: Trip, now: number, t: ReturnType<typeof useT>): string {
  const left = REVIEW_WINDOW_MS - (now - departureAt(trip));
  const days = Math.max(1, Math.ceil(left / (24 * 60 * 60 * 1000)));
  return days === 1 ? t('trips.reviewDay') : t('trips.reviewDays', { count: days });
}
