/**
 * The cancellation policy — Guest canvas artboard 6a, `cancellationPolicy` in
 * `screens-b.mjs`.
 *
 * The canvas draws the tier, the non-refundable paragraph and the "locked at
 * booking time" note. This adds the two things the artboard leaves implied and
 * a guest cannot decide without:
 *
 *   - **The switch that takes the non-refundable rate**, which is a decision
 *     made here and carried into the booking. It writes the per-property draft,
 *     so the sticky bar behind the sheet already says so when it closes.
 *   - **What it actually costs**, from `computeBreakdown` in
 *     `@injishi/contracts` — the ONE implementation of the service fee and its
 *     rounding. A sheet that offered "about 10% off" and left the arithmetic to
 *     the checkout would be the second copy of a rounding rule that ADR-014
 *     exists to prevent, and the guest reads the quote.
 *
 * Three refusals worth keeping:
 *
 *   - **The tier belongs to the Room type, not the property** (glossary, F-B03).
 *     With no room chosen there is no tier to state, so the sheet says that
 *     rather than showing the first room's terms as if they were the house's.
 *   - **A room whose `nonrefundableEligible` is false gets a disabled switch
 *     with the reason**, not a hidden one. A control that vanishes is one the
 *     guest cannot tell from a control they failed to find.
 *   - **The figures are for one night until dates exist**, and the sheet says
 *     so on the line above them. A total that silently assumed a night would be
 *     a number the guest could act on and be wrong about.
 */
import { useCallback } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { computeBreakdown, NON_REFUNDABLE_DISCOUNT } from '@injishi/contracts';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';
import {
  Badge,
  Button,
  Icon,
  MoneyBreakdown,
  PressableScale,
  Sheet,
  Text,
  nightsBetween,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion, MOTION_MS } from '@/motion';
import { useFixtureValue } from '@/data/use-fixture-mutation';
import { useBookingDraft } from '@/data/booking-draft';
import { DEFAULT_SEARCH, SEARCH_KEY, type StaySearch } from '@/data/search';
import { getStayDetail, initialRoom } from '@/data/property-detail';
import { moneyText, nightsLabel, tierBodyKey, tierKey } from './listing-format';

export function ListingPolicySheet({ id }: { id: string }) {
  const { c, space } = useTheme();
  const t = useT();
  const router = useRouter();

  const detail = getStayDetail(id);
  const search = useFixtureValue<StaySearch>(SEARCH_KEY, () => DEFAULT_SEARCH);
  const { draft, setNonRefundable } = useBookingDraft(id);

  if (!detail) {
    return (
      <Sheet title={t('listing.notFoundTitle')} grabber>
        <Text size="sm" color="textMuted" style={{ lineHeight: 21 }}>
          {t('listing.notFoundBody')}
        </Text>
      </Sheet>
    );
  }

  const selectedId = draft.roomTypeId ?? initialRoom(detail)?.summary.id ?? null;
  const room = detail.rooms.find((r) => r.summary.id === selectedId);
  const tier = room?.summary.cancellationTier ?? null;
  const eligible = room?.summary.nonrefundableEligible ?? false;

  const hasDates = !!search.dates.start && !!search.dates.end;
  const nights = hasDates
    ? nightsBetween(search.dates.start as string, search.dates.end as string)
    : 1;

  const rate = room?.summary.nightlyRateRwf ?? null;
  const money =
    rate === null
      ? undefined
      : computeBreakdown({
          nightlyRateRwf: rate,
          nights,
          nonRefundable: draft.nonRefundable && eligible,
        });

  return (
    <Sheet
      title={t('listing.policy')}
      eyebrow={room ? t('listing.policyForRoom', { room: room.summary.name }) : undefined}
      grabber
      footer={
        <Button variant="primary" size="lg" block onPress={() => router.back()}>
          {t('listing.policyDone')}
        </Button>
      }
    >
      {/* ------------------------------------------------------- the tier -- */}
      <View style={{ gap: 10 }}>
        <Badge tone={tier ? 'brand' : 'neutral'} size="lg">
          {t(tierKey(tier))}
        </Badge>
        <Text size="sm" color="textBody" style={{ lineHeight: 22 }}>
          {room ? t(tierBodyKey(tier)) : t('listing.policyNoRoom')}
        </Text>
      </View>

      <Rule />

      {/* --------------------------------------------- the non-refundable -- */}
      <View style={{ gap: 10 }}>
        <Text weight="semibold" size="md" color="textStrong">
          {t('listing.policyNonRefundableTitle')}
        </Text>
        <Text size="sm" color="textBody" style={{ lineHeight: 22 }}>
          {t('listing.policyNonRefundableBody')}
        </Text>

        {room ? (
          <PolicySwitch
            on={draft.nonRefundable && eligible}
            disabled={!eligible}
            label={t('listing.policyToggle')}
            hint={
              eligible
                ? t('listing.policyToggleHint', {
                    percent: Math.round(NON_REFUNDABLE_DISCOUNT * 100),
                  })
                : t('listing.policyIneligible', { room: room.summary.name })
            }
            onToggle={setNonRefundable}
          />
        ) : null}
      </View>

      {/* -------------------------------------------------- what it costs -- */}
      {money && room ? (
        <>
          <Rule />
          <View style={{ gap: 10 }}>
            <Text weight="semibold" size="md" color="textStrong">
              {t('listing.policyWhatYouPay')}
            </Text>
            {hasDates ? null : (
              <Text size="xs" color="textMuted" style={{ lineHeight: 19 }}>
                {t('listing.policyOneNight')}
              </Text>
            )}
            <MoneyBreakdown
              items={[
                {
                  label: t('listing.policyAccommodation'),
                  sub: `${moneyText(money.nightlyRateRwf)} × ${nightsLabel(nights, t)}`,
                  value: money.accommodationRwf,
                },
                // Only when it is actually applied. A zero line for a discount
                // nobody took reads as an offer that failed.
                ...(money.nonRefundableDiscountRwf > 0
                  ? [
                      {
                        label: t('listing.policyDiscount'),
                        value: -money.nonRefundableDiscountRwf,
                      },
                    ]
                  : []),
                { label: t('listing.policyFee'), value: money.serviceFeeRwf },
              ]}
              total={{ label: t('listing.policyTotal'), value: money.grossRwf }}
            />
          </View>
        </>
      ) : null}

      <Rule />

      {/* ------------------------------------------------- the two promises */}
      <View style={{ gap: space[3] }}>
        <Note icon="shield">{t('listing.policyLocked')}</Note>
        <Note icon="rotateCcw">{t('listing.policyHostCancels')}</Note>
      </View>
    </Sheet>
  );
}

/**
 * The switch, drawn rather than taken from React Native.
 *
 * RN's `Switch` paints from platform colours and its track cannot be resolved
 * through the palette on both platforms, which design brief §8.4 rules out.
 * This is the canvas's own control: a track, a knob that travels, and — because
 * colour is never the only signal (§7.5) — a tick inside the knob when it is on.
 * Reduced motion drops the travel and keeps the change of state.
 */
function PolicySwitch({
  on,
  disabled,
  label,
  hint,
  onToggle,
}: {
  on: boolean;
  disabled: boolean;
  label: string;
  hint: string;
  onToggle: (next: boolean) => void;
}) {
  const { c, radius, shadow } = useTheme();
  const reduced = useReducedMotion();

  const travel = useDerivedValue(() =>
    withTiming(on ? 22 : 0, { duration: reduced ? 1 : MOTION_MS / 2 }),
  );
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: travel.get() }] }));

  const press = useCallback(() => onToggle(!on), [on, onToggle]);

  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: on, disabled }}
      disabled={disabled}
      onPress={press}
      testID="policy-non-refundable"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 44,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: on ? c.borderBrand : c.borderSubtle,
        backgroundColor: on ? c.actionSubtle : c.surface2,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text weight="semibold" size="sm" color="textStrong">
          {label}
        </Text>
        <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
          {hint}
        </Text>
      </View>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 50,
          height: 28,
          borderRadius: radius.pill,
          padding: 2,
          justifyContent: 'center',
          backgroundColor: on ? c.action : c.neutral200,
        }}
      >
        <Animated.View
          style={[
            {
              width: 24,
              height: 24,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.surface1,
              ...shadow.xs,
            },
            knob,
          ]}
        >
          {on ? <Icon name="check" size={13} color={c.action} /> : null}
        </Animated.View>
      </View>
    </PressableScale>
  );
}

function Rule() {
  const { c } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: 1, backgroundColor: c.borderSubtle }}
    />
  );
}

function Note({ icon, children }: { icon: 'shield' | 'rotateCcw'; children: string }) {
  const { c } = useTheme();
  return (
    <View accessible accessibilityLabel={children} style={{ flexDirection: 'row', gap: 10 }}>
      <Icon name={icon} size={16} color={c.textMuted} />
      <Text size="sm" color="textMuted" style={{ flex: 1, lineHeight: 19 }}>
        {children}
      </Text>
    </View>
  );
}
