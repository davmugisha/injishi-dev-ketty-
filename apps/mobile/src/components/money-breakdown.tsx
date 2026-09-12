/**
 * MoneyBreakdown — itemized amounts with an optional emphasized total row.
 * Port of the DS MoneyBreakdown, as used on the lease detail surface.
 */
import { View } from 'react-native';
import { Text } from './text';
import { MoneyAmount } from './money-amount';
import { useTheme } from '@/theme/theme';

export interface BreakdownItem {
  label: string;
  sub?: string;
  value: number;
  muted?: boolean;
}

export function MoneyBreakdown({
  items,
  total,
  currency = 'RWF',
}: {
  items: BreakdownItem[];
  total?: { label: string; value: number };
  currency?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {items.map((it) => (
        <View
          key={it.label}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View>
            <Text size="sm" color={it.muted ? 'textMuted' : 'textBody'}>
              {it.label}
            </Text>
            {it.sub ? (
              <Text size="xs" color="textSubtle">
                {it.sub}
              </Text>
            ) : null}
          </View>
          <MoneyAmount value={it.value} currency={currency} />
        </View>
      ))}
      {total ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 4,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: c.borderSubtle,
          }}
        >
          <Text weight="semibold" size="sm" color="textStrong">
            {total.label}
          </Text>
          <MoneyAmount value={total.value} currency={currency} strong tone="brand" size="md" />
        </View>
      ) : null}
    </View>
  );
}
