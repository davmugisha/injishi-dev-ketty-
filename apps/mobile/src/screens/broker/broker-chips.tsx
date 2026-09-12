/**
 * The Directory's search field and its filter rail.
 *
 * Split out of `directory.tsx` for the reason Session 2 split Explore's: each
 * of these has accessibility semantics that are easy to get wrong once and then
 * copy across a surface.
 *
 *   - **The rail is not one group.** Availability is a single choice and
 *     belongs to a `radiogroup`; "Long-term" is an independent narrowing and is
 *     a `checkbox`; "Filters" is neither — it opens a sheet — and is a
 *     `button`. Rendered as one row of pressables a reader hears six unrelated
 *     controls and never learns that choosing "Vacant now" un-chooses "All".
 *   - **The field is a button, not an input.** It summarises a search that is
 *     edited somewhere else, which is the only way a sheet that dismisses can
 *     report what it did.
 *
 * `Tag` from the kit is not used: it hardcodes `accessibilityRole="radio"`,
 * which is right for a single-choice row and wrong for two of the three shapes
 * here. `ChipGroup` has the same limit in the other direction — it draws one
 * group, and this rail is three. Both are the right call for their own callers.
 *
 * **Session 11 did the lift this file asked for.** The chip and the field are
 * `FilterChip` and `SearchPill` in the kit now; what stays here is what is the
 * Directory's own — which chips exist, what they are called, and the counts
 * that make a broker want to press one.
 */
import { ScrollView, View } from 'react-native';
import { FilterChip as Chip, Icon, PressableScale, SearchPill, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import {
  UNIT_DISTRICTS,
  activeUnitFilterCount,
  type UnitSearch,
} from '@/data/broker-search';

/* ------------------------------------------------------- the search field -- */

export interface UnitSearchFieldProps {
  summary: string;
  /** Whether the summary is the reader's own search or the placeholder. */
  filled: boolean;
  filterCount: number;
  onPress: () => void;
}

/** Frame B21's field: a search glyph, "Kimihurura · 2 bed · ≤ 350K", a filter glyph. */
export function UnitSearchField({ summary, filled, filterCount, onPress }: UnitSearchFieldProps) {
  const t = useT();
  return (
    <SearchPill
      summary={summary}
      filled={filled}
      filterCount={filterCount}
      accessibilityLabel={
        filled ? t('directory.searchSummary', { summary }) : t('directory.searchPlaceholder')
      }
      accessibilityHint={t('directory.searchOpen')}
      onPress={onPress}
    />
  );
}

/* ---------------------------------------------------------------- the rail */

export interface UnitRailProps {
  search: UnitSearch;
  counts: { now: number; soon: number };
  onChange: (next: UnitSearch) => void;
  onOpenFilters: () => void;
}

/**
 * Frame B21's three chips, plus the way into the sheet.
 *
 * The availability trio carries counts because the frame does ("Vacant · 12")
 * and because a count is what tells a broker whether the filter is worth
 * pressing. The district chips live in the sheet: there are eight of them and a
 * rail that scrolls past the fold stops being a rail.
 */
export function UnitRail({ search, counts, onChange, onOpenFilters }: UnitRailProps) {
  const { space } = useTheme();
  const t = useT();
  const filters = activeUnitFilterCount(search);

  const vacancy = (value: UnitSearch['vacancy'], label: string, count?: number) => (
    <Chip
      key={value}
      role="radio"
      label={count == null ? label : `${label} · ${count}`}
      selected={search.vacancy === value}
      accessibilityLabel={count == null ? label : `${label}, ${count}`}
      onPress={() => onChange({ ...search, vacancy: value })}
    />
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -space[4] }}
      contentContainerStyle={{ paddingHorizontal: space[4], gap: space[2], alignItems: 'center' }}
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('directory.railLabel')}
        style={{ flexDirection: 'row', gap: space[2] }}
      >
        {vacancy('any', t('directory.chipAll'))}
        {vacancy('now', t('directory.chipVacantNow'), counts.now)}
        {vacancy('soon', t('directory.chipVacantSoon'), counts.soon)}
      </View>

      <Chip
        role="checkbox"
        label={t('directory.chipLongTerm')}
        selected={search.tenure === 'long_term'}
        accessibilityLabel={t('directory.chipLongTerm')}
        onPress={() =>
          onChange({ ...search, tenure: search.tenure === 'long_term' ? 'any' : 'long_term' })
        }
      />

      <Chip
        role="button"
        label={t('directory.chipFilters')}
        leadingIcon="filter"
        badge={filters}
        accessibilityLabel={t('directory.chipFilters')}
        onPress={onOpenFilters}
      />
    </ScrollView>
  );
}

/* ------------------------------------------------------ the removable chips */

export interface ActiveChip {
  id: string;
  label: string;
  next: UnitSearch;
}

/**
 * The narrowings that get a chip of their own, because nothing else on the
 * screen shows them: the districts and the size and the ceiling all live in the
 * sheet, and a broker who ticked two districts would otherwise see a filtered
 * list with no visible reason for it. Availability and tenure are already lit
 * on the rail above and are left out.
 *
 * Each chip names its own VALUE, not its axis, so one district can go without
 * taking the other with it.
 */
export function activeUnitChips(search: UnitSearch, t: Translate): ActiveChip[] {
  const chips: ActiveChip[] = [];

  if (search.where.trim()) {
    chips.push({ id: 'where', label: search.where.trim(), next: { ...search, where: '' } });
  }

  for (const name of search.districts) {
    const facet = UNIT_DISTRICTS.find((d) => d.name === name);
    chips.push({
      id: `district-${name}`,
      label: facet?.name ?? name,
      next: { ...search, districts: search.districts.filter((d) => d !== name) },
    });
  }

  if (search.bedrooms > 0) {
    chips.push({
      id: 'bedrooms',
      label: t('directory.bedPlus', { count: search.bedrooms }),
      next: { ...search, bedrooms: 0 },
    });
  }

  return chips;
}

export function ActiveUnitChips({
  chips,
  onChange,
}: {
  chips: readonly ActiveChip[];
  onChange: (next: UnitSearch) => void;
}) {
  const { c, space, radius } = useTheme();
  const t = useT();

  if (chips.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -space[4] }}
      contentContainerStyle={{ paddingHorizontal: space[4], gap: space[2] }}
    >
      {chips.map((chip) => (
        <PressableScale
          key={chip.id}
          accessibilityRole="button"
          accessibilityLabel={`${chip.label}. ${t('a11y.dismiss')}`}
          hitSlop={7}
          onPress={() => onChange(chip.next)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: 30,
            paddingLeft: 12,
            paddingRight: 9,
            borderRadius: radius.pill,
            backgroundColor: c.actionSubtle,
            borderWidth: 1,
            borderColor: c.brand300,
          }}
        >
          <Text weight="medium" size="xs" color="brand700">
            {chip.label}
          </Text>
          <Icon name="x" size={13} color={c.brand700} />
        </PressableScale>
      ))}
    </ScrollView>
  );
}
