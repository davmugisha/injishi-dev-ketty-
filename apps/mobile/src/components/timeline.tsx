/**
 * Timeline — a vertical dot-and-line rail with done, current and pending steps.
 *
 * Motivated by frames R9 (caution deposit: Collected → Held → Settle at
 * move-out) and R10 (RRA filing: Contract signed → Queued → Filed &
 * acknowledged). Both are money-and-compliance records where the reader's real
 * question is "what has actually happened", so each entry carries a date and a
 * sentence, not just a state word.
 *
 * Horizontal in `ProgressSteps`, vertical here, and they are not the same
 * component: a horizontal rail can hold three words, a vertical one holds three
 * paragraphs. R9's middle step is "Held · Ongoing · lease active" and R10's
 * last is an acknowledgement number — neither fits a horizontal rail without
 * truncating, and the canvas rule is that nothing truncates.
 *
 * The state is carried by the glyph as well as the tint, so it survives
 * greyscale and colour blindness (design brief §7.5): done takes a check,
 * current takes a filled dot, pending takes an empty ring.
 */
import { View } from 'react-native';
import { Text } from './text';
import { Icon } from './icon';
import { useTheme } from '@/theme/theme';

export type TimelineState = 'done' | 'current' | 'pending';

export interface TimelineEntry {
  key: string;
  title: string;
  /** The date or the "when", printed beside the title. */
  meta?: string;
  /** The sentence under it. R9's "at signing", R10's acknowledgement number. */
  body?: string;
  state: TimelineState;
}

const DOT = 18;

export function Timeline({ entries }: { entries: readonly TimelineEntry[] }) {
  const { c, space, radius } = useTheme();

  return (
    <View>
      {entries.map((entry, i) => {
        const last = i === entries.length - 1;
        const done = entry.state === 'done';
        const current = entry.state === 'current';
        const fill = done ? c.success500 : current ? c.action : c.surface1;

        return (
          <View
            key={entry.key}
            accessible
            accessibilityLabel={[entry.title, entry.meta, entry.body].filter(Boolean).join(', ')}
            style={{ flexDirection: 'row', gap: space[3] }}
          >
            <View style={{ alignItems: 'center', width: DOT }}>
              <View
                style={{
                  width: DOT,
                  height: DOT,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: fill,
                  borderWidth: done || current ? 0 : 1.5,
                  borderColor: c.borderDefault,
                }}
              >
                {done ? (
                  <Icon name="check" size={11} color={c.surface1} />
                ) : current ? (
                  <View
                    style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.surface1 }}
                  />
                ) : null}
              </View>
              {/* The line runs from this dot to the next, so the last entry
                  has none hanging below it. */}
              {last ? null : (
                <View
                  style={{
                    flex: 1,
                    width: 2,
                    marginVertical: 3,
                    backgroundColor: done ? c.success500 : c.borderDefault,
                  }}
                />
              )}
            </View>

            <View style={{ flex: 1, paddingBottom: last ? 0 : space[4], gap: 3 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: space[2],
                }}
              >
                <Text
                  weight="semibold"
                  size="sm"
                  color={entry.state === 'pending' ? 'textMuted' : 'textStrong'}
                  style={{ flexShrink: 1 }}
                >
                  {entry.title}
                </Text>
                {entry.meta ? (
                  <Text family="mono" size="xs" color="textMuted">
                    {entry.meta}
                  </Text>
                ) : null}
              </View>
              {entry.body ? (
                <Text size="sm" color="textMuted" style={{ lineHeight: 19 }}>
                  {entry.body}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
