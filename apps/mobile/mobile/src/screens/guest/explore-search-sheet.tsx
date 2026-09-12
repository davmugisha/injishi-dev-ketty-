/**
 * The Explore search sheet — Where, When, Who, and the narrowing under them.
 * Mounted by `app/search.tsx` as a `formSheet` (decision D8).
 *
 * ## It edits a draft, and commits once
 *
 * Everything here writes to local state and nothing reaches Explore until
 * Search is pressed. That is what makes "Clear all" safe to press and what
 * makes the footer able to say how many stays the current draft would return
 * before the reader commits to it. A sheet that wrote through on every keystroke
 * would leave a half-typed search behind when it was dismissed by a swipe.
 *
 * ## What each control does, and one thing it does not
 *
 * **Where** is a name field and a district set, and they are different
 * questions: the field matches a property name or a neighbourhood, the chips
 * pick districts, and ticking two districts means either, not both.
 *
 * **When** carries dates and narrows nothing, and says so in the section's own
 * words. The fixtures hold no availability calendar, so a date range cannot be
 * honoured against them; it is carried so it reaches the listing and the
 * booking stepper without the reader being asked twice. `apps/web` took the
 * same position for the same reason. Filtering silently on a date nobody
 * checked would be the worse lie.
 *
 * **Who** caps against the catalogue rather than against a number somebody
 * chose. `PARTY_MAX` is the largest room type anyone lists, so the stepper
 * stops where the inventory does — a party of nine returns an empty list with
 * no filter to blame, which is the one empty state that reads as a bug.
 * Infants are counted separately and do not occupy.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Button,
  CalendarRange,
  ChipGroup,
  Icon,
  InputField,
  PressableScale,
  SectionLabel,
  Sheet,
  Text,
  useToast,
  type ChipItem,
} from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import {
  CLASSES,
  DEFAULT_SEARCH,
  DISTRICTS,
  GUEST_LIMITS,
  PARTY_MAX,
  PRICE_BANDS,
  SORTS,
  SORT_LABEL,
  billableGuests,
  searchStays,
  useStaySearch,
  type GuestParty,
  type StaySearch,
  type StaySort,
} from '@/data/search';
import type { DistrictSlug } from '@/data/stays';

/** `any` is not a band; it is the absence of one, and the rail needs a chip. */
const ANY_BAND = 'any';

export function ExploreSearchSheet() {
  const { space } = useTheme();
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const { search, setSearch } = useStaySearch();

  const [draft, setDraft] = useState<StaySearch>(search);
  const matches = searchStays(draft);

  const patch = (next: Partial<StaySearch>) => setDraft((now) => ({ ...now, ...next }));

  const apply = () => {
    setSearch(draft);
    toast.show(
      matches.length === 1
        ? t('search.appliedOne')
        : t('search.applied', { count: matches.length }),
      'neutral',
    );
    router.back();
  };

  return (
    <Sheet
      title={t('search.title')}
      subtitle={t('search.subtitle')}
      // iOS draws the platform grabber from the route's own options; this is
      // the one Android and the web export would otherwise go without.
      grabber
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Button variant="outline" size="lg" onPress={() => setDraft(DEFAULT_SEARCH)}>
            {t('search.clearAll')}
          </Button>
          <View style={{ flex: 1 }}>
            <Button variant="primary" size="lg" block leadingIcon="search" onPress={apply}>
              {matches.length === 0
                ? t('search.applyNone')
                : matches.length === 1
                  ? t('search.applyOne')
                  : t('search.applyCount', { count: matches.length })}
            </Button>
          </View>
        </View>
      }
    >
      {/* ------------------------------------------------------------ Where */}
      <View style={{ gap: space[3] }}>
        <SectionLabel>{t('search.where')}</SectionLabel>
        <InputField
          label={t('search.whereLabel')}
          value={draft.where}
          onChangeText={(where) => patch({ where })}
          placeholder={t('search.wherePlaceholder')}
          helper={t('search.whereHelper')}
          autoCapitalize="words"
        />
        <ChipGroup
          mode="multi"
          legend={t('search.districts')}
          wrap
          items={DISTRICTS.map(
            (d): ChipItem => ({ value: d.slug, label: t(d.label), count: d.count }),
          )}
          value={draft.districts}
          onChange={(districts) => patch({ districts: districts as DistrictSlug[] })}
        />
      </View>

      {/* ------------------------------------------------------------- When */}
      <View style={{ gap: space[3] }}>
        <SectionLabel>{t('search.when')}</SectionLabel>
        <CalendarRange value={draft.dates} onChange={(dates) => patch({ dates })} />
        <Note>{t('search.whenNote')}</Note>
      </View>

      {/* -------------------------------------------------------------- Who */}
      <View style={{ gap: space[3] }}>
        <SectionLabel>{t('search.who')}</SectionLabel>
        <GuestStepper
          field="adults"
          label={t('search.adults')}
          note={t('search.adultsNote')}
          party={draft.guests}
          onChange={(guests) => patch({ guests })}
          t={t}
        />
        <GuestStepper
          field="children"
          label={t('search.children')}
          note={t('search.childrenNote')}
          party={draft.guests}
          onChange={(guests) => patch({ guests })}
          t={t}
        />
        <GuestStepper
          field="infants"
          label={t('search.infants')}
          note={t('search.infantsNote')}
          party={draft.guests}
          onChange={(guests) => patch({ guests })}
          t={t}
        />
        <Note>
          {billableGuests(draft.guests) >= PARTY_MAX
            ? t('search.partyAtCap')
            : t('search.partyCap', { count: PARTY_MAX })}
        </Note>
      </View>

      {/* ---------------------------------------------------------- Narrow */}
      <View style={{ gap: space[4] }}>
        <SectionLabel>{t('search.refine')}</SectionLabel>

        <ChipGroup
          mode="multi"
          legend={t('search.propertyType')}
          wrap
          items={CLASSES.map(
            (c): ChipItem => ({ value: c.value, label: t(c.label), count: c.count }),
          )}
          value={draft.classes}
          onChange={(classes) => patch({ classes: classes as StaySearch['classes'] })}
        />

        <ChipGroup
          legend={t('search.priceBand')}
          wrap
          items={[
            { value: ANY_BAND, label: t('search.bandAny') },
            ...PRICE_BANDS.map((b): ChipItem => ({ value: b.id, label: t(b.label) })),
          ]}
          value={draft.band ?? ANY_BAND}
          onChange={(band) => patch({ band: band === ANY_BAND ? null : band })}
        />

        <ToggleRow
          label={t('search.instantBook')}
          note={t('search.instantBookNote')}
          value={draft.instantBook}
          onChange={(instantBook) => patch({ instantBook })}
        />

        <ChipGroup
          legend={t('search.sort')}
          wrap
          items={SORTS.map((s): ChipItem => ({ value: s, label: t(SORT_LABEL[s]) }))}
          value={draft.sort}
          onChange={(sort) => patch({ sort: sort as StaySort })}
        />
      </View>
    </Sheet>
  );
}

/** A muted consequence line under a section. Printed, never discovered later. */
function Note({ children }: { children: string }) {
  return (
    <Text size="xs" color="textMuted" style={{ lineHeight: 19 }}>
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------- the stepper */

interface StepperProps {
  field: keyof GuestParty;
  label: string;
  note: string;
  party: GuestParty;
  onChange: (party: GuestParty) => void;
  t: Translate;
}

function GuestStepper({ field, label, note, party, onChange, t }: StepperProps) {
  const { c, space, radius } = useTheme();
  const limits = GUEST_LIMITS[field];
  const value = party[field];

  // An infant does not take a bed, so only adults and children run into the
  // room's capacity. Both ceilings apply; the tighter one wins.
  const occupies = field !== 'infants';
  const atCatalogueCap = occupies && billableGuests(party) >= PARTY_MAX;
  const canAdd = value < limits.max && !atCatalogueCap;
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
          accessibilityLabel={t('search.decrement', { label })}
          onPress={() => step(-1)}
        />
        <Text
          family="mono"
          weight="semibold"
          size="md"
          color="textStrong"
          center
          // The number is the value of the pair of buttons beside it, so it is
          // announced with its own name rather than as a bare digit.
          accessibilityLabel={t('search.stepperValue', { label, count: value })}
          style={{ minWidth: 24 }}
        >
          {String(value)}
        </Text>
        <StepButton
          icon="plus"
          disabled={!canAdd}
          accessibilityLabel={t('search.increment', { label })}
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

/* -------------------------------------------------------------- the toggle */

/**
 * A labelled switch, drawn as a checkbox row rather than as a platform
 * `Switch`: RN's `Switch` takes an iOS-green fill that no palette key can
 * reach, and a control this app cannot colour is a control that breaks the one
 * rule the palette gate enforces.
 */
function ToggleRow({
  label,
  note,
  value,
  onChange,
}: {
  label: string;
  note: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const { c, space, radius } = useTheme();

  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityHint={note}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        minHeight: 44,
        paddingVertical: space[2],
      }}
    >
      {/* State by shape as well as by fill: a tick appears, it does not just
          change colour (design brief §7.5). */}
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: radius.xs,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: value ? 0 : 1.5,
          borderColor: c.borderStrong,
          backgroundColor: value ? c.action : 'transparent',
        }}
      >
        {value ? <Icon name="check" size={15} color={c.bgApp} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text weight="semibold" size="md" color="textStrong">
          {label}
        </Text>
        <Text size="xs" color="textMuted" style={{ lineHeight: 18, marginTop: 1 }}>
          {note}
        </Text>
      </View>
    </PressableScale>
  );
}
