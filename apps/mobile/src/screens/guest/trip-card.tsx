/**
 * The trip row on the Trips tab — one card per booking under the hero.
 *
 * Guest canvas artboard 9, `tripCard` in `screens-b.mjs`: title, location, a
 * status pill, then a footer of dates, nights, total and a chevron. The
 * anatomy is the artboard's; two things are Session 5's.
 *
 * **A past trip is muted, and mutes with opacity rather than with a paler
 * palette key.** The design brief's greyscale rule means a "dimmer" colour has
 * to stay legible, and hand-picking a second set of muted inks for one card is
 * how a surface ends up with two vocabularies for one idea. One opacity on the
 * whole card says "this is history" without inventing a colour.
 *
 * **No review row in v1.** It used to sit in the footer of a completed stay
 * and open `trip/[id]/review`. Reviews are hidden in the v1.0 cut and that
 * route is closed for everyone, so the row bounced the guest home, and the
 * footer's "you rated this stay" lines described a feature nobody can use
 * (mobile audit 2026-10-05, GK-11). It returns with the review feature.
 *
 * **A cancelled stay says so.** "Past" and "completed" are not the same word:
 * nobody stayed in a cancelled booking, so its card names what happened rather
 * than looking like any other past stay.
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
import type { Trip } from '@/data/trips';
import { tripDateLine } from './trip-format';

export interface TripCardProps {
  trip: Trip;
  onPress: () => void;
}

export function TripCard({ trip, onPress }: TripCardProps) {
  const { c, space, radius, shadow } = useTheme();
  const t = useT();

  const past = trip.state === 'completed' || trip.state === 'cancelled';
  const cancelled = trip.state === 'cancelled';

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

      {cancelled ? (
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
          <Icon name="xCircle" size={15} color={c.textMuted} />
          <Text size="xs" color="textMuted" style={{ flex: 1, lineHeight: 18 }}>
            {t('trip.cancelledNote')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
