/**
 * One Room type, as a card the guest picks. Guest canvas artboard 4, the
 * `rooms` block in `screens-a.mjs`.
 *
 * The canvas draws the chosen card with a 1.5px accent border and the others
 * with a hairline. That is a real difference in weight, but it is a difference
 * in COLOUR alone at a glance, which design brief §7.5 rules out — so the
 * selected card also carries a filled check and the word, and announces
 * `selected` to a screen reader. Three signals, one of them shape.
 *
 * A sold-out Room type is drawn, not dropped. `remaining: 0` is a fact the
 * guest needs (the room exists; it is taken for these nights), and a row that
 * disappears is one they cannot tell apart from a room that never existed. It
 * is dimmed, unpressable, and says so in words.
 */
import { View } from 'react-native';
import { Badge, Icon, MoneyAmount, PressableScale, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import type { RoomCard as RoomCardData } from '@/data/property-detail';
import { modeKey, remainingLabel, roomSpokenLabel, tierKey } from './listing-format';

export interface ListingRoomCardProps {
  room: RoomCardData;
  selected: boolean;
  onSelect: () => void;
}

export function ListingRoomCard({ room, selected, onSelect }: ListingRoomCardProps) {
  const { c, radius, shadow, space } = useTheme();
  const t = useT();
  const { summary } = room;
  const out = room.remaining <= 0;

  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={roomSpokenLabel(room, t)}
      accessibilityHint={out ? undefined : t('listing.roomChoose', { room: summary.name })}
      accessibilityState={{ selected, disabled: out }}
      disabled={out}
      // The one haptic on this page. Choosing a room is its primary
      // interaction, and a buzz per tap across a whole screen is what makes
      // people turn them off. It rides on top of the border, the check and the
      // word, never instead of them.
      haptic
      onPress={onSelect}
      testID={`room-${summary.id}`}
      style={{
        gap: space[2],
        padding: space[4],
        borderRadius: radius.lg,
        backgroundColor: c.surface1,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? c.borderBrand : c.borderSubtle,
        ...shadow.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[3] }}>
        <Text
          family="display"
          weight="medium"
          size="lg"
          color="textStrong"
          style={{ flex: 1, lineHeight: 23 }}
        >
          {summary.name}
        </Text>
        {/* The mode chip. Solid for instant book because that is the one that
            ends in a booking rather than a request, and the canvas fills it. */}
        <Badge tone={summary.bookingMode === 'instant_book' ? 'brand' : 'neutral'} solid={summary.bookingMode === 'instant_book'}>
          {t(modeKey(summary.bookingMode))}
        </Badge>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <Icon name="users" size={14} color={c.textMuted} />
        <Text size="sm" color="textMuted">
          {t('listing.sleeps', { count: summary.capacity ?? 0 })}
        </Text>
        <Dot />
        <Text size="sm" color="textMuted">
          {t(room.beds)}
        </Text>
        <Dot />
        <Text size="sm" color="textMuted">
          {t(tierKey(summary.cancellationTier))}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: space[3],
          marginTop: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <MoneyAmount
            value={summary.nightlyRateRwf ?? 0}
            strong
            tone={out ? undefined : 'brand'}
            size="lg"
          />
          <Text size="xs" color="textMuted">
            {t('listing.perNight')}
          </Text>
        </View>

        {selected ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Icon name="checkCircle" size={15} color={c.action} />
            <Text weight="semibold" size="xs" color="textStrong">
              {t('listing.roomSelected')}
            </Text>
          </View>
        ) : (
          <Text
            weight={out ? 'semibold' : 'medium'}
            size="xs"
            color={out ? 'textSubtle' : room.remaining <= 3 ? 'warning600' : 'textMuted'}
          >
            {remainingLabel(room.remaining, t)}
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

/** The middle dot the meta rows are joined by, hidden from assistive tech. */
function Dot() {
  const { c } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: c.neutral400 }}
    />
  );
}
