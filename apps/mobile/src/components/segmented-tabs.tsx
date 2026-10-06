/**
 * SegmentedTabs — in-screen segmented navigation (underline look) with an
 * optional count pill per tab. Port of the DS Tabs (underline variant).
 *
 * Session 11's motion pass moved it onto `PressableScale`, which had no press
 * feedback. A tab does not TRAVEL when selected — the expo-animation gate is
 * explicit that tab switches are a hundred-times-a-day interaction and should
 * not slide — but the press itself still has to answer, which is the 120ms
 * scale-and-dip rather than a transition.
 */
import { View } from 'react-native';
import { Text } from './text';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

export function SegmentedTabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { c, radius } = useTheme();
  return (
    <View
      // The group a `tab` belongs to, so a screen reader can say "tab 2 of 3"
      // rather than announcing loose buttons (mobile audit 2026-10-05, XC-19).
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', gap: 4, borderBottomWidth: 1, borderBottomColor: c.borderSubtle }}
    >
      {items.map((it) => {
        const active = value === it.value;
        return (
          <PressableScale
            key={it.value}
            accessibilityRole="tab"
            accessibilityLabel={it.count != null ? `${it.label}, ${it.count}` : it.label}
            accessibilityState={{ selected: active }}
            // Drawn at ~40; hitSlop carries it to the 44pt floor (§7.2).
            hitSlop={2}
            onPress={() => onChange(it.value)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderBottomWidth: 2,
              borderBottomColor: active ? c.brand700 : 'transparent',
              marginBottom: -1,
            }}
          >
            <Text weight="medium" size="sm" color={active ? 'brand700' : 'textMuted'}>
              {it.label}
            </Text>
            {it.count != null ? (
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 1,
                  borderRadius: radius.pill,
                  backgroundColor: active ? c.brand100 : c.neutral200,
                }}
              >
                <Text family="mono" size="2xs" color={active ? 'brand700' : 'textMuted'}>
                  {String(it.count)}
                </Text>
              </View>
            ) : null}
          </PressableScale>
        );
      })}
    </View>
  );
}
