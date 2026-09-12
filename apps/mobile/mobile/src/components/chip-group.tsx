/**
 * ChipGroup — a scrolling row of `Tag`s with single or multi select.
 *
 * Motivated by frames W6 ("WHAT IS WRONG" / "HOW BAD"), W5 ("WHAT FAILED"),
 * R3 ("All · Active · Ending · Draft"), R4, B21 and B23, plus the Guest
 * canvas Explore filter rail. Nine surfaces drawing the same control by hand
 * is nine chances to get the semantics wrong.
 *
 * **The semantics are the point, not the layout.** A single-select row is a
 * `radiogroup` of `radio`s; a multi-select row is a group of `checkbox`es.
 * Rendered as bare pressables — which is what every frame draws — a screen
 * reader announces a list of unrelated buttons and never says how many are
 * chosen or that choosing one clears another. `Tag` already reports
 * `accessibilityRole="radio"` and its selected state; this adds the group
 * around it, which is the half a lone chip cannot provide.
 *
 * Horizontal scroll rather than wrap, because Kinyarwanda runs longer than
 * English and the canvas rule is that nothing truncates: a row that scrolls
 * grows sideways, a row that wraps pushes the content under it down the page.
 * `wrap` is there for the fixed short sets (W6's four severities) where the
 * frame draws them on one line.
 */
import { ScrollView, View } from 'react-native';
import { Text } from './text';
import { Tag } from './tag';
import { useTheme } from '@/theme/theme';

export interface ChipItem {
  value: string;
  label: string;
  /** Appended in brackets, the way the frames print counts: "All · 7". */
  count?: number;
}

interface BaseProps {
  items: readonly ChipItem[];
  /** Small uppercase label above the row, as W5 and W6 draw it. */
  legend?: string;
  /** Wrap onto several lines instead of scrolling. For short fixed sets. */
  wrap?: boolean;
}

export interface SingleProps extends BaseProps {
  mode?: 'single';
  value: string;
  onChange: (value: string) => void;
}

export interface MultiProps extends BaseProps {
  mode: 'multi';
  value: readonly string[];
  onChange: (value: string[]) => void;
}

export function ChipGroup(props: SingleProps | MultiProps) {
  const { space } = useTheme();
  const { items, legend, wrap = false } = props;
  const multi = props.mode === 'multi';

  const isOn = (v: string) => (multi ? props.value.includes(v) : props.value === v);

  const toggle = (v: string) => {
    if (props.mode === 'multi') {
      const next = props.value.includes(v)
        ? props.value.filter((x) => x !== v)
        : [...props.value, v];
      props.onChange(next);
    } else {
      props.onChange(v);
    }
  };

  const chips = items.map((item) => (
    <Tag
      key={item.value}
      selected={isOn(item.value)}
      onPress={() => toggle(item.value)}
    >
      {item.count == null ? item.label : `${item.label} · ${item.count}`}
    </Tag>
  ));

  const group = (
    <View
      // The group is what carries the "one of these" or "any of these" meaning.
      // Without it a reader hears N unrelated controls.
      accessibilityRole={multi ? 'none' : 'radiogroup'}
      accessibilityLabel={legend}
      style={
        wrap
          ? { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }
          : { flexDirection: 'row', gap: space[2] }
      }
    >
      {chips}
    </View>
  );

  return (
    <View style={{ gap: legend ? space[2] : 0 }}>
      {legend ? (
        <Text
          weight="bold"
          size="xs"
          color="textMuted"
          style={{ letterSpacing: 1, textTransform: 'uppercase' }}
        >
          {legend}
        </Text>
      ) : null}
      {wrap ? (
        group
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // The row bleeds to the screen edge and pads inside, so the first
          // chip lines up with the gutter and the last one can scroll clear
          // of it rather than stopping under the bezel.
          style={{ marginHorizontal: -space[4] }}
          contentContainerStyle={{ paddingHorizontal: space[4], gap: space[2] }}
        >
          {group}
        </ScrollView>
      )}
    </View>
  );
}
