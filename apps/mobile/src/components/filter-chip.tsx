/**
 * FilterChip and SearchPill — the two controls that sit above a filtered list.
 *
 * **Two surfaces built them separately and Session 11 merged them.** Session 2
 * wrote them inside `screens/guest/explore-chips.tsx` for Explore; Session 9
 * wrote a near-identical pair inside `screens/broker/broker-chips.tsx` for the
 * Directory, and said so in its own header: *"This is very nearly Explore's
 * `Chip` and `SearchPill` with a different search shape behind them. Session 11
 * should lift the pair into the kit now that two surfaces want them."* They
 * differed by four lines — a `trailingIcon` Explore needed for its removable
 * chips and the Directory did not.
 *
 * What made them worth lifting is not the drawing, it is the accessibility.
 * Both headers argued the same case:
 *
 *   - **A filter rail is not one group.** Some chips are a single choice and
 *     belong to a `radiogroup`; an independent narrowing is a `checkbox`; the
 *     one that opens a sheet is neither and is a `button`. Rendered as one row
 *     of pressables a reader hears eight unrelated controls and never learns
 *     that choosing Kigali un-chooses Lakeside. So the ROLE is a required prop
 *     rather than a default: the caller has to have made the decision.
 *   - **A removable chip names its own value, not its axis.** "Hotel ×" and
 *     "Lodge ×" are two chips, so one can go without the other.
 *
 * `Tag` is not this and never was: it hardcodes `accessibilityRole="radio"`,
 * which is right for its own single-choice rows and wrong for two of the three
 * shapes here. `ChipGroup` has the same limit in the other direction — it draws
 * one group, and a rail is three. All four are right for their own callers.
 */
import { View } from 'react-native';
import { Text } from './text';
import { Icon, type IconName } from './icon';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';

export interface FilterChipProps {
  label: string;
  selected?: boolean;
  /**
   * Required, never defaulted. See the header: a rail that reports one role for
   * three different kinds of control is a rail a screen reader cannot explain.
   */
  role: 'radio' | 'checkbox' | 'button';
  accessibilityLabel: string;
  leadingIcon?: IconName;
  /** The `×` on a removable chip. */
  trailingIcon?: IconName;
  /** A small count on the right, as a "Filters" chip carries. */
  badge?: number;
  onPress: () => void;
}

export function FilterChip({
  label,
  selected = false,
  role,
  accessibilityLabel,
  leadingIcon,
  trailingIcon,
  badge,
  onPress,
}: FilterChipProps) {
  const { c, radius } = useTheme();
  const ink = selected ? c.brand700 : c.textBody;

  return (
    <PressableScale
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={role === 'checkbox' ? { checked: selected } : { selected }}
      // Drawn at 32, the rail's height on both canvases; hitSlop carries every
      // chip past the 44pt floor (design brief §7.2).
      hitSlop={7}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 32,
        paddingHorizontal: 12,
        borderRadius: radius.sm,
        backgroundColor: selected ? c.actionSubtle : c.surface2,
        borderWidth: 1,
        borderColor: selected ? c.brand300 : c.borderSubtle,
      }}
    >
      {leadingIcon ? <Icon name={leadingIcon} size={13} color={ink} /> : null}
      <Text weight="medium" size="sm" color={selected ? 'brand700' : 'textBody'}>
        {label}
      </Text>
      {badge != null && badge > 0 ? (
        <View
          style={{
            minWidth: 17,
            paddingHorizontal: 4,
            paddingVertical: 1,
            borderRadius: radius.pill,
            backgroundColor: c.action,
            alignItems: 'center',
          }}
        >
          <Text family="mono" weight="semibold" size="2xs" color="bgApp">
            {String(badge)}
          </Text>
        </View>
      ) : null}
      {trailingIcon ? <Icon name={trailingIcon} size={13} color={ink} /> : null}
    </PressableScale>
  );
}

export interface SearchPillProps {
  summary: string;
  /** Whether the summary is the reader's own search or the placeholder. */
  filled: boolean;
  filterCount: number;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
}

/**
 * The 46pt pill both canvases draw: a search glyph, a summary, a filter glyph.
 *
 * **It is a button, not an input.** It summarises a search edited somewhere
 * else, which is the only way a sheet that dismisses can report what it did.
 */
export function SearchPill({
  summary,
  filled,
  filterCount,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: SearchPillProps) {
  const { c, radius } = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        height: 46,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: filled ? c.borderBrand : c.borderDefault,
      }}
    >
      <Icon name="search" size={17} color={filled ? c.brand700 : c.textMuted} />
      <Text
        size="sm"
        weight={filled ? 'medium' : 'regular'}
        color={filled ? 'textStrong' : 'textMuted'}
        numberOfLines={1}
        style={{ flex: 1 }}
      >
        {summary}
      </Text>
      <View>
        <Icon name="filter" size={17} color={filterCount > 0 ? c.brand700 : c.textMuted} />
        {filterCount > 0 ? (
          <View
            // A dot, not a number: the count is on the Filters chip below and
            // twice is once too many. Shape plus colour, never colour alone.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              top: -3,
              right: -3,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: c.action,
              borderWidth: 1,
              borderColor: c.surface1,
            }}
          />
        ) : null}
      </View>
    </PressableScale>
  );
}
