/**
 * The three controls that sit between Explore's title and its results: the
 * search pill, the quick filter rail, and the chips for whatever the sheet set
 * that the rail cannot show.
 *
 * They are here rather than inline in `explore.tsx` because each has real
 * accessibility semantics that are easy to get wrong once and then copy:
 *
 *   - **The rail is not one group.** Five of its chips are a single choice and
 *     belong to a `radiogroup`; "Instant book" is an independent switch and is a
 *     `checkbox`; "Filters" is neither, it opens a sheet, and is a `button`.
 *     Rendered as one row of pressables a reader hears eight unrelated controls
 *     and never learns that choosing Kigali un-chooses Lakeside.
 *   - **A removable chip names its own value, not its axis.** "Hotel ×" and
 *     "Lodge ×" are two chips, so one can go without the other. A single "the
 *     property type ×" chip would be a control that throws away a choice the
 *     reader did not ask to throw away.
 *
 * `Tag` from the kit is not used here for the same reason: it hardcodes
 * `accessibilityRole="radio"`, which is right for its own filter rows and wrong
 * for two of the three shapes on this screen.
 *
 * **Session 11 lifted the chip and the pill into the kit** as `FilterChip` and
 * `SearchPill`, once Session 9's Directory turned out to have written the same
 * pair. What stays here is what is Explore's own: which axes get a chip, what
 * each one is called, and the three-role split of the rail.
 */
import { ScrollView, View } from 'react-native';
import { FilterChip as Chip, SearchPill as KitSearchPill } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT, type Translate } from '@/i18n/i18n';
import {
  CLASSES,
  DISTRICTS,
  QUICK_FILTERS,
  activeFilterCount,
  activeQuick,
  priceBand,
  removableFilters,
  type StaySearch,
} from '@/data/search';

/* --------------------------------------------------------- the search pill */

export interface SearchPillProps {
  summary: string;
  /** Whether the summary is the reader's own search or the placeholder. */
  filled: boolean;
  filterCount: number;
  onPress: () => void;
}

/**
 * The artboard's 46pt pill, with Explore's own copy on it. It summarises the
 * committed search once there is one, which is the only way a sheet that
 * dismisses can report what it did.
 */
export function SearchPill({ summary, filled, filterCount, onPress }: SearchPillProps) {
  const t = useT();
  return (
    <KitSearchPill
      summary={summary}
      filled={filled}
      filterCount={filterCount}
      accessibilityLabel={filled ? t('search.summary', { summary }) : t('explore.searchHint')}
      accessibilityHint={t('search.open')}
      onPress={onPress}
    />
  );
}

/* ---------------------------------------------------------- the quick rail */

export interface QuickRailProps {
  search: StaySearch;
  onChange: (next: StaySearch) => void;
  onOpenFilters: () => void;
}

export function QuickRail({ search, onChange, onOpenFilters }: QuickRailProps) {
  const { space } = useTheme();
  const t = useT();
  const quick = activeQuick(search);
  const count = activeFilterCount(search);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Bleeds to the screen edge and pads inside, so the first chip lines up
      // with the gutter and the last can scroll clear of the bezel.
      style={{ marginHorizontal: -space[4] }}
      contentContainerStyle={{ paddingHorizontal: space[4], gap: space[2] }}
    >
      <Chip
        role="button"
        leadingIcon="filter"
        label={t('explore.filtersChip')}
        selected={count > 0}
        badge={count}
        accessibilityLabel={
          count > 0 ? t('explore.filtersActive', { count }) : t('explore.filtersChip')
        }
        onPress={onOpenFilters}
      />

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('explore.quickFilters')}
        style={{ flexDirection: 'row', gap: space[2] }}
      >
        {QUICK_FILTERS.map((filter) => (
          <Chip
            key={filter.id}
            role="radio"
            label={t(filter.label)}
            selected={quick === filter.id}
            accessibilityLabel={t(filter.label)}
            onPress={() => onChange({ ...search, ...filter.patch })}
          />
        ))}
      </View>

      <Chip
        role="checkbox"
        leadingIcon="zap"
        label={t('explore.instantBook')}
        selected={search.instantBook}
        accessibilityLabel={t('search.instantBook')}
        onPress={() => onChange({ ...search, instantBook: !search.instantBook })}
      />
    </ScrollView>
  );
}

/* ------------------------------------------------- the removable filters */

export interface ActiveChip {
  key: string;
  label: string;
  /** The search with this ONE value lifted. */
  next: StaySearch;
}

/**
 * One chip per chosen value, not one per axis, so a reader can drop Hotel and
 * keep Lodge. Which axes appear at all is `removableFilters`' call: the rail
 * and the pill already show the rest.
 */
export function activeChips(search: StaySearch, t: Translate): ActiveChip[] {
  const shown = new Set(removableFilters(search).map((d) => d.id));
  const chips: ActiveChip[] = [];

  if (shown.has('districts')) {
    for (const slug of search.districts) {
      const facet = DISTRICTS.find((d) => d.slug === slug);
      if (!facet) continue;
      chips.push({
        key: `district:${slug}`,
        label: t(facet.label),
        next: { ...search, districts: search.districts.filter((s) => s !== slug) },
      });
    }
  }

  if (shown.has('classes')) {
    for (const value of search.classes) {
      const facet = CLASSES.find((f) => f.value === value);
      if (!facet) continue;
      chips.push({
        key: `class:${value}`,
        label: t(facet.label),
        next: { ...search, classes: search.classes.filter((c) => c !== value) },
      });
    }
  }

  if (shown.has('band')) {
    const band = priceBand(search.band);
    if (band) {
      chips.push({ key: `band:${band.id}`, label: t(band.label), next: { ...search, band: null } });
    }
  }

  return chips;
}

export function ActiveFilterChips({
  chips,
  onChange,
}: {
  chips: ActiveChip[];
  onChange: (next: StaySearch) => void;
}) {
  const { space } = useTheme();
  const t = useT();
  if (chips.length === 0) return null;

  return (
    <View
      accessibilityLabel={t('explore.activeFilters')}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}
    >
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          role="button"
          label={chip.label}
          selected
          trailingIcon="x"
          accessibilityLabel={t('explore.removeFilter', { filter: chip.label })}
          onPress={() => onChange(chip.next)}
        />
      ))}
    </View>
  );
}
