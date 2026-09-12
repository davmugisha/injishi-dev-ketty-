/**
 * The bar at the foot of the Property detail page. Guest canvas artboard 4,
 * `stickyBar` in `screens-a.mjs`.
 *
 * Four facts and one action, and the order is the order the guest decides in:
 * which room, what it costs a night, which nights, and then the button.
 *
 * **The disabled CTA always carries its reason.** The canvas rule is that
 * consequences are printed under the button rather than discovered later, and
 * FL06 Path A disables the CTA until dates are chosen — so a bar with no dates
 * says so in a sentence above the button and the dates row beside it is the way
 * out. A disabled control whose disabled state has no exit is the orphaned
 * control the quality bar rules out.
 *
 * **The label follows the ROOM's booking mode, not the property's.** The
 * glossary puts booking mode on the Room type and F-B03 agrees;
 * `Stay.bookingMode` is Explore's facet. Until a room is picked there is
 * nothing to follow, so the property's value stands in — and the button is
 * disabled at that point anyway, so the guest never acts on the fallback.
 *
 * **The non-refundable rate is shown as a badge, not as a smaller number.**
 * `computeBreakdown` applies the discount to the ACCOMMODATION total and
 * rounds once, so a per-night figure derived from it would not multiply back to
 * the total the guest is charged. The bar prints the room's rate and says the
 * non-refundable rate is on; the policy sheet does the arithmetic.
 */
import { View } from 'react-native';
import { Badge, Button, Icon, MoneyAmount, PressableScale, StickyBar, Text } from '@/components';
import type { BookingMode } from '@injishi/contracts';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';
import type { RoomCard } from '@/data/property-detail';
import { modeKey, nightsLabel } from './listing-format';

export interface ListingStickyBarProps {
  room: RoomCard | undefined;
  /** The cheapest rate still bookable, shown while no room is picked. */
  fromRate: number | undefined;
  /** Already formatted by `formatDates`, or null when there are none. */
  dates: string | null;
  nights: number;
  nonRefundable: boolean;
  /** The property's mode, used only while no room is picked. */
  fallbackMode: BookingMode;
  blockedKey: MessageKey | null;
  onPressDates: () => void;
  onPressCta: () => void;
}

export function ListingStickyBar({
  room,
  fromRate,
  dates,
  nights,
  nonRefundable,
  fallbackMode,
  blockedKey,
  onPressDates,
  onPressCta,
}: ListingStickyBarProps) {
  const { c, radius, space } = useTheme();
  const t = useT();

  const rate = room?.summary.nightlyRateRwf ?? fromRate;
  const mode = room?.summary.bookingMode ?? fallbackMode;

  return (
    <StickyBar>
      {/* One child, laid out as a column, because the reason line spans the
          full width above the price and the button. `StickyBar` owns the
          surface, the hairline and the home-indicator padding either way. */}
      <View style={{ flex: 1, gap: blockedKey ? 10 : 0 }}>
        {blockedKey ? (
          <View
            accessible
            accessibilityRole="alert"
            accessibilityLabel={t(blockedKey)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 7,
              paddingHorizontal: 10,
              borderRadius: radius.sm,
              backgroundColor: c.bgTint,
            }}
          >
            <Icon name="info" size={14} color={c.textMuted} />
            <Text size="xs" color="textBody" style={{ flex: 1, lineHeight: 18 }}>
              {t(blockedKey)}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space[3],
          }}
        >
          <View style={{ flexShrink: 1, gap: 3 }}>
            <Text size="xs" color="textMuted" numberOfLines={1}>
              {room ? room.summary.name : t('listing.chooseRoom')}
            </Text>

            {rate === undefined ? null : (
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                {room ? null : (
                  <Text size="xs" color="textMuted">
                    {t('listing.from')}
                  </Text>
                )}
                <MoneyAmount value={rate} strong tone="brand" size="lg" />
                <Text size="xs" color="textMuted">
                  {t('listing.perNight')}
                </Text>
              </View>
            )}

            {nonRefundable ? (
              <Badge tone="warning">{t('listing.nonRefundableOn')}</Badge>
            ) : (
              <DatesRow dates={dates} nights={nights} onPress={onPressDates} />
            )}
          </View>

          <Button
            variant="primary"
            size="lg"
            disabled={blockedKey !== null}
            onPress={onPressCta}
          >
            {t(modeKey(mode))}
          </Button>
        </View>

        {/* With the non-refundable badge occupying the third line, the dates
            row moves under the whole block so it is never lost. */}
        {nonRefundable ? <DatesRow dates={dates} nights={nights} onPress={onPressDates} /> : null}
      </View>
    </StickyBar>
  );
}

/**
 * The dates, as a control. It is the page's only way to set them, so it is a
 * button in both states rather than a label that turns into one.
 */
function DatesRow({
  dates,
  nights,
  onPress,
}: {
  dates: string | null;
  nights: number;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const t = useT();
  const spoken = dates
    ? t('listing.a11yDates', { dates, nights: nightsLabel(nights, t) })
    : t('listing.a11yNoDates');

  return (
    <PressableScale
      accessibilityLabel={spoken}
      accessibilityHint={dates ? t('listing.changeDates') : undefined}
      onPress={onPress}
      hitSlop={8}
      testID="listing-dates"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
        // Drawn at 18pt of text; the padding plus the hit slop carry it over
        // the 44pt floor without growing the bar (design brief §7.2).
        paddingVertical: 6,
      }}
    >
      <Icon name="calendar" size={13} color={dates ? c.textBody : c.action} />
      <Text
        weight={dates ? 'medium' : 'semibold'}
        size="xs"
        color={dates ? 'textBody' : 'action'}
        numberOfLines={1}
      >
        {dates ? `${dates} · ${nightsLabel(nights, t)}` : t('listing.addDates')}
      </Text>
      <Icon name="chevronRight" size={13} color={c.textSubtle} />
    </PressableScale>
  );
}
