/**
 * Step 1 of 3 — dates and guests. Guest canvas artboard 5, `bookDates` in
 * `screens-b.mjs`.
 *
 * The artboard draws the two dates as read-only fields, because a canvas cannot
 * open a calendar. Here they are the `CalendarRange` itself: FL07 §4 step 1 is
 * "select Room type and dates", and a checkout that showed the dates and made
 * the guest go back to the Property detail page to change them would fail the
 * one thing this step is for.
 *
 * **The party is three steppers, not the canvas's one.** The artboard has a
 * single "Guests" counter, but the app's search already carries adults,
 * children and infants (`GuestParty`), Explore filters on it and the Property
 * detail page books from it. Collapsing that to one number here would lose the
 * infant, and an infant is exactly the guest whose count must NOT push a party
 * over a room's capacity — `billableGuests` is adults plus children for that
 * reason.
 *
 * **The running total is accommodation only, and says so.** The canvas prints
 * `rate × nights` on this step and the service fee does not appear until step
 * 2. A number labelled "total" that grows by 5% on the next screen is the
 * pattern the design brief's "consequences are printed under the button" rule
 * exists to stop, so this one is labelled as what it is.
 */
import { View } from 'react-native';
import {
  CalendarRange,
  Card,
  Icon,
  MoneyAmount,
  PressableScale,
  SectionLabel,
  Text,
  type DateRange,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import {
  GUEST_LIMITS,
  billableGuests,
  formatDates,
  type GuestParty,
} from '@/data/search';
import type { RoomCard, StayDetail } from '@/data/property-detail';
import { moneyText, nightsLabel } from './listing-format';
import { nightsIn } from './book-format';
import { Note } from './book-parts';

export interface StepDatesProps {
  detail: StayDetail;
  room: RoomCard;
  dates: DateRange;
  party: GuestParty;
  onDates: (dates: DateRange) => void;
  onParty: (party: GuestParty) => void;
}

export function BookStepDates({
  detail,
  room,
  dates,
  party,
  onDates,
  onParty,
}: StepDatesProps) {
  const { c, space } = useTheme();
  const t = useT();

  const rate = room.summary.nightlyRateRwf;
  const sleeps = room.summary.capacity ?? 0;
  const nights = nightsIn(dates);
  const heads = billableGuests(party);
  const over = heads > sleeps;

  return (
    <View style={{ gap: space[5] }}>
      {/* --------------------------------------------------- what is booked */}
      <Card variant="flat">
        <View style={{ gap: 4 }}>
          <Text family="display" weight="medium" size="lg" color="textStrong">
            {detail.stay.title}
          </Text>
          <Text size="sm" color="textMuted">
            {t('book.roomAt', { room: room.summary.name, place: detail.stay.location })}
          </Text>
          {rate === null ? null : (
            <View
              style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 }}
            >
              <MoneyAmount value={rate} strong tone="brand" size="md" />
              <Text size="xs" color="textMuted">
                {t('book.perNight')}
              </Text>
            </View>
          )}
        </View>
      </Card>

      {/* -------------------------------------------------------------- when */}
      <View style={{ gap: space[3] }}>
        <SectionLabel>{t('book.when')}</SectionLabel>
        <CalendarRange value={dates} onChange={onDates} />
        <Note icon="clock">{t('book.timezoneNote')}</Note>
      </View>

      {/* --------------------------------------------------------------- who */}
      <View style={{ gap: space[3] }}>
        <SectionLabel>{t('book.who')}</SectionLabel>

        <PartyStepper
          field="adults"
          label={t('search.adults')}
          note={t('search.adultsNote')}
          party={party}
          sleeps={sleeps}
          onChange={onParty}
          t={t}
        />
        <PartyStepper
          field="children"
          label={t('search.children')}
          note={t('search.childrenNote')}
          party={party}
          sleeps={sleeps}
          onChange={onParty}
          t={t}
        />
        <PartyStepper
          field="infants"
          label={t('search.infants')}
          note={t('search.infantsNote')}
          party={party}
          sleeps={sleeps}
          onChange={onParty}
          t={t}
        />

        {/* The capacity sentence is always present, and turns from a fact into
            a fault rather than appearing only once something is wrong — a rule
            that shows up only on violation is one nobody could plan around. */}
        {over ? (
          <View
            accessible
            accessibilityRole="alert"
            accessibilityLabel={t('book.partyOverCap', {
              count: heads - sleeps,
              room: room.summary.name,
            })}
            style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}
          >
            <Icon name="alertTriangle" size={15} color={c.danger600} />
            <Text size="xs" color="danger600" style={{ flex: 1, lineHeight: 18 }}>
              {t('book.partyOverCap', { count: heads - sleeps, room: room.summary.name })}
            </Text>
          </View>
        ) : (
          <Note icon="users">
            {t('book.partyAtRoomCap', { room: room.summary.name, count: sleeps })}
          </Note>
        )}
      </View>

      {/* ---------------------------------------------------- what it is so far */}
      {nights > 0 && rate !== null ? (
        <Card variant="tint">
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="calendar" size={15} color={c.action} />
              <Text weight="semibold" size="sm" color="textStrong" style={{ flex: 1 }}>
                {`${nightsLabel(nights, t)} · ${formatDates(dates, t) ?? ''}`}
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <Text size="sm" color="textMuted" style={{ flexShrink: 1 }}>
                {t('book.rateTimesNights', {
                  rate: moneyText(rate),
                  nights: nightsLabel(nights, t),
                })}
              </Text>
              <MoneyAmount value={rate * nights} strong size="md" />
            </View>

            <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
              {t('book.beforeFees')}
            </Text>
          </View>
        </Card>
      ) : (
        <Card variant="tint">
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="calendar" size={15} color={c.textMuted} />
            <Text size="sm" color="textMuted" style={{ flex: 1, lineHeight: 20 }}>
              {t('book.pickDates')}
            </Text>
          </View>
        </Card>
      )}
    </View>
  );
}

/* ------------------------------------------------------------- the stepper */

/**
 * Session 2's party stepper, capped by the ROOM rather than by the catalogue.
 *
 * The two ceilings answer different questions. `PARTY_MAX` is "could anywhere
 * sleep this many", which is the right guard on a search; here the room is
 * already chosen, so the ceiling is that room's own capacity, and going over it
 * is a booking the host would have to refuse.
 *
 * The plus button does NOT stop at the ceiling. It disables one past it, so a
 * guest who arrives with a party of six on a room that sleeps four sees the
 * count they actually have and a sentence telling them what to do about it,
 * instead of a control that silently refuses and explains nothing.
 */
function PartyStepper({
  field,
  label,
  note,
  party,
  sleeps,
  onChange,
  t,
}: {
  field: keyof GuestParty;
  label: string;
  note: string;
  party: GuestParty;
  sleeps: number;
  onChange: (party: GuestParty) => void;
  t: Translate;
}) {
  const { c, space, radius } = useTheme();
  const limits = GUEST_LIMITS[field];
  const value = party[field];

  // An infant shares a bed, so only adults and children meet the room's cap.
  const occupies = field !== 'infants';
  const atRoomCap = occupies && billableGuests(party) > sleeps;
  const canAdd = value < limits.max && !atRoomCap;
  const canRemove = value > limits.min;

  const step = (by: number) => onChange({ ...party, [field]: value + by });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <View style={{ flex: 1 }}>
        <Text weight="semibold" size="md" color="textStrong">
          {label}
        </Text>
        <Text size="xs" color="textMuted" style={{ marginTop: 1 }}>
          {note}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <StepButton
          icon="minus"
          disabled={!canRemove}
          accessibilityLabel={t('book.decrement', { label })}
          onPress={() => step(-1)}
        />
        <Text
          family="mono"
          weight="semibold"
          size="md"
          color="textStrong"
          center
          accessibilityLabel={t('book.stepperValue', { label, count: value })}
          style={{ minWidth: 24 }}
        >
          {String(value)}
        </Text>
        <StepButton
          icon="plus"
          disabled={!canAdd}
          accessibilityLabel={t('book.increment', { label })}
          onPress={() => step(1)}
        />
      </View>
    </View>
  );

  function StepButton({
    icon,
    disabled,
    accessibilityLabel,
    onPress,
  }: {
    icon: 'plus' | 'minus';
    disabled: boolean;
    accessibilityLabel: string;
    onPress: () => void;
  }) {
    return (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPress={onPress}
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: disabled ? c.borderSubtle : c.borderStrong,
          backgroundColor: c.surface1,
        }}
      >
        <Icon name={icon} size={18} color={disabled ? c.textSubtle : c.textStrong} />
      </PressableScale>
    );
  }
}
