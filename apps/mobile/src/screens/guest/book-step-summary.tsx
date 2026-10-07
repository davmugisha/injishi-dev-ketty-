/**
 * Step 2 of 3 — your booking. Guest canvas artboard 6, `bookSummary` in
 * `screens-b.mjs`.
 *
 * What the guest is buying, what it costs, and the two things FL07 §4 step 3
 * requires before payment: the `MoneyBreakdown`, and the cancellation policy.
 *
 * **The non-refundable switch is rendered only where the room sells one.**
 * ADR-020 AC-19 is explicit, and the artboard is not — it draws the toggle
 * unconditionally, which is prototype simplification rather than the spec. A
 * room with `nonrefundableEligible: false` gets the row with a disabled control
 * and the reason, never a row that quietly disappears: a control that vanishes
 * cannot be told apart from one the guest failed to find.
 *
 * **The tier is read off the room and never hardcoded** (AC-18). The canvas
 * writes "Flexible" and its sentence into the artboard; here both come from
 * `cancellationTier` through Session 3's `tierKey` and `tierBodyKey`, which is
 * also what the policy sheet this row opens will say. One vocabulary.
 *
 * **The discount line appears only when it is taken.** A zero line for a
 * discount nobody took reads as an offer that failed — the canvas hides the row
 * with `display: none` for the same reason, and the policy sheet already does.
 */
import { useCallback } from 'react';
import { View } from 'react-native';
import { NON_REFUNDABLE_DISCOUNT, type MoneyBreakdown } from '@injishi/contracts';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';
import {
  Badge,
  Card,
  Icon,
  MoneyBreakdown as Breakdown,
  PressableScale,
  SectionLabel,
  Text,
  type DateRange,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion, MOTION_MS } from '@/motion';
import { formatDates, type GuestParty, billableGuests } from '@/data/search';
import { houseRuleLines, type RoomCard, type StayDetail } from '@/data/property-detail';
import { nightsLabel, rateLine, tierBodyKey, tierKey } from './listing-format';
import { nightsIn } from './book-format';
import { AdapterChip, CheckRow, FactRow, Note } from './book-parts';

export interface StepSummaryProps {
  detail: StayDetail;
  room: RoomCard;
  dates: DateRange;
  party: GuestParty;
  money: MoneyBreakdown;
  nonRefundable: boolean;
  acceptedRules: boolean;
  onNonRefundable: (next: boolean) => void;
  onAcceptRules: (next: boolean) => void;
  onOpenPolicy: () => void;
}

export function BookStepSummary({
  detail,
  room,
  dates,
  party,
  money,
  nonRefundable,
  acceptedRules,
  onNonRefundable,
  onAcceptRules,
  onOpenPolicy,
}: StepSummaryProps) {
  const { c, space } = useTheme();
  const t = useT();

  const nights = nightsIn(dates);
  const eligible = room.summary.nonrefundableEligible;
  const tier = room.summary.cancellationTier;
  const rules = houseRuleLines(detail.property);

  const heads = billableGuests(party);

  return (
    <View style={{ gap: space[5] }}>
      {/* ------------------------------------------------------ the facts */}
      <Card variant="flat">
        <View style={{ gap: 11 }}>
          <Text family="display" weight="medium" size="lg" color="textStrong">
            {detail.stay.title}
          </Text>
          <FactRow label={t('book.factRoom')} value={room.summary.name} />
          <FactRow label={t('book.factDates')} value={formatDates(dates, t) ?? ''} />
          <FactRow
            label={t('book.factGuests')}
            value={t('book.factParty', {
              guests: heads === 1 ? t('search.oneGuest') : t('search.guestCount', { count: heads }),
              nights: nightsLabel(nights, t),
            })}
          />
          <FactRow label={t('book.factHost')} value={detail.stay.agent} />
        </View>
      </Card>

      {/* --------------------------------------------- the non-refundable rate */}
      <NonRefundableRow
        on={nonRefundable && eligible}
        disabled={!eligible}
        label={t('book.nonRefundableTitle')}
        body={
          eligible
            ? t('book.nonRefundableBody', {
                percent: Math.round(NON_REFUNDABLE_DISCOUNT * 100),
              })
            : t('listing.policyIneligible', { room: room.summary.name })
        }
        onToggle={onNonRefundable}
      />

      {/* -------------------------------------------------------- the price */}
      <View style={{ gap: space[3] }}>
        <SectionLabel>{t('book.price')}</SectionLabel>
        <Card variant="flat">
          <Breakdown
            items={[
              {
                label: t('book.accommodation'),
                // The guests are named because they are multiplied: the line
                // used to read "rate × nights" beside a per-person total
                // (mobile audit 2026-10-05, GK-14).
                sub: rateLine(money.nightlyRateRwf, money.guests ?? heads, money.nights, t),
                value: money.accommodationRwf,
              },
              ...(money.nonRefundableDiscountRwf > 0
                ? [{ label: t('book.discount'), value: -money.nonRefundableDiscountRwf }]
                : []),
              { label: t('book.fee'), value: money.serviceFeeRwf, muted: true },
            ]}
            total={{ label: t('book.totalLabel'), value: money.grossRwf }}
          />
        </Card>
      </View>

      {/* ------------------------------------------------- the policy, as a row */}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${t('listing.policy')}. ${t(tierKey(tier))}. ${t(tierBodyKey(tier))}`}
        accessibilityHint={t('book.readPolicy')}
        onPress={onOpenPolicy}
        testID="book-policy-row"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          minHeight: 44,
          padding: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.borderSubtle,
          backgroundColor: c.surface1,
        }}
      >
        <View style={{ flex: 1, gap: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text weight="semibold" size="sm" color="textStrong">
              {t('listing.policy')}
            </Text>
            <Badge tone={nonRefundable && eligible ? 'warning' : 'brand'}>
              {nonRefundable && eligible ? t('book.nonRefundableOn') : t(tierKey(tier))}
            </Badge>
          </View>
          <Text size="sm" color="textMuted" style={{ lineHeight: 19 }}>
            {nonRefundable && eligible
              ? t('listing.policyNonRefundableBody')
              : t(tierBodyKey(tier))}
          </Text>
        </View>
        <Icon name="chevronRight" size={18} color={c.textSubtle} />
      </PressableScale>

      {/* ---------------------------------------------------- the house rules */}
      <View style={{ gap: space[3] }}>
        <SectionLabel>{t('book.houseRulesTitle')}</SectionLabel>

        {rules.length > 0 ? (
          <Card variant="flat">
            <View style={{ gap: 9 }}>
              {rules.map((rule) => (
                <View key={rule} style={{ flexDirection: 'row', gap: 9 }}>
                  <Icon name="check" size={14} color={c.textMuted} />
                  <Text size="sm" color="textBody" style={{ flex: 1, lineHeight: 20 }}>
                    {rule}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : (
          <Note icon="info">{t('book.houseRulesNone')}</Note>
        )}

        <Note icon="clock">
          {t('book.checkInFrom', {
            from: detail.property.checkInTime ?? '14:00',
            until: detail.property.checkOutTime ?? '11:00',
          })}
        </Note>

        <CheckRow
          checked={acceptedRules}
          label={t('book.houseRulesAck')}
          hint={t(tierBodyKey(tier))}
          onToggle={onAcceptRules}
          testID="book-accept-rules"
        />
      </View>

      <AdapterChip />
    </View>
  );
}

/* ------------------------------------------------------------- the switch */

/**
 * The non-refundable rate, as a switch inside its own card.
 *
 * The same drawn control as Session 3's policy sheet, and deliberately the same
 * shape: the guest can reach this decision from either place and a second
 * spelling of one switch is how two screens end up disagreeing about what is
 * on. React Native's `Switch` is not used for the reason recorded there — its
 * track paints from platform colours that cannot be resolved through the
 * palette on both platforms (design brief §8.4). Reduced motion drops the
 * knob's travel and keeps the state change, per §7.6.
 */
function NonRefundableRow({
  on,
  disabled,
  label,
  body,
  onToggle,
}: {
  on: boolean;
  disabled: boolean;
  label: string;
  body: string;
  onToggle: (next: boolean) => void;
}) {
  const { c, radius, shadow, space } = useTheme();
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
      accessibilityHint={body}
      accessibilityState={{ checked: on, disabled }}
      disabled={disabled}
      onPress={press}
      testID="book-non-refundable"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: 44,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: on ? c.borderBrand : c.borderSubtle,
        backgroundColor: on ? c.actionSubtle : c.surface1,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text weight="semibold" size="md" color="textStrong">
          {label}
        </Text>
        <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
          {body}
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
