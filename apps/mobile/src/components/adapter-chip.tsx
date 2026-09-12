/**
 * AdapterChip — "✦ Payments · mock adapter", and the line that explains it.
 *
 * The one thing on a money screen that is not decoration. `ui-rules.md`
 * § Adapter Awareness and `DESIGN.md` §1 both put it the same way: **every
 * screen showing money or compliance state renders its adapter mode inline,
 * because a mocked success must never look like a real one.** The design brief
 * §4.3 canonical intent map gives the tone — adapter `mock` is `warning`,
 * adapter `live` is `success` — and noted that no mobile component drew it.
 *
 * **Three surfaces then drew it three ways.** Session 8 built
 * `screens/landlord/adapter-chip.tsx` for frames R1, R9, R10 and its record
 * sheet; Session 4 built an `AdapterChip` inside `screens/guest/book-parts.tsx`
 * out of a `Badge`; Session A built `AdapterNote` inside
 * `screens/host/host-chrome.tsx`. Session 11 merged them. The pill is Session
 * 8's, because it is the one that survives greyscale; the paired explanatory
 * line is Sessions 4 and A's, because a chip saying "mock" without saying what
 * mock costs is a warning the reader cannot act on.
 *
 * `Badge` was not reused for it, on purpose. A badge is a STATE of the record in
 * front of you; this is a property of the SYSTEM drawing it, and giving the two
 * the same shape teaches a reader that "mock" is one of the states a payment
 * can be in. The glyph and the outline keep them apart at a glance.
 */
import { View } from 'react-native';
import { Text } from './text';
import { Icon } from './icon';
import { useTheme } from '@/theme/theme';

export interface AdapterChipProps {
  /** The chip's own words — "Payments · mock adapter". */
  label: string;
  /** The line a screen reader hears after the label. What "mock" costs. */
  hint?: string;
  live?: boolean;
}

export function AdapterChip({ label, hint, live = false }: AdapterChipProps) {
  const { c, radius } = useTheme();
  const fill = live ? c.success100 : c.warning100;
  const ink = live ? c.success600 : c.warning600;

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        minHeight: 26,
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderRadius: radius.pill,
        backgroundColor: fill,
        borderWidth: 1,
        borderColor: ink,
      }}
    >
      {/* The glyph carries the meaning as well as the tint, so the chip
          survives greyscale and a colour-blind reader (design brief §7.5). */}
      <Icon name="sparkles" size={13} color={ink} />
      <Text weight="semibold" size="xs" color={live ? 'success600' : 'warning600'}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The chip with its consequence printed beside it.
 *
 * The canvas rule, on most frames: *consequences are printed under the button,
 * not discovered later.* A chip alone says the adapter is mocked; this says what
 * that means for the thing the reader is about to do.
 *
 * One node to a screen reader, because "mock adapter" and "no money moves" are
 * one fact split across two lines for layout reasons only. `accessible` on the
 * container is what collapses them; the chip inside is NOT additionally hidden
 * with `importantForAccessibility`, which would take its text out of the render
 * tree's query surface as well as out of the reader's — a distinction the two
 * props do not make and a test found immediately.
 */
export function AdapterNote({
  label,
  body,
  live = false,
}: {
  label: string;
  body: string;
  live?: boolean;
}) {
  const { space } = useTheme();

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}. ${body}`}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}
    >
      <AdapterChip label={label} live={live} />
      <Text size="xs" color="textMuted" style={{ flex: 1, lineHeight: 17 }}>
        {body}
      </Text>
    </View>
  );
}
