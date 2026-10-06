/**
 * MoneyBreakdown — itemized amounts with an optional emphasized total row.
 * Port of the DS MoneyBreakdown, as used on the lease detail surface.
 *
 * **Each row is ONE stop for a screen reader**, its label and its amount read
 * together. They used to be three separate stops ("Accommodation", "RWF",
 * "870,000"), so a person paying by voice had to assemble the figure from
 * fragments; and the label column could not shrink, so at large text it pushed
 * the amount off the row (mobile audit 2026-10-05, GK-31).
 */
import { View } from 'react-native';
import { Text } from './text';
import { MoneyAmount, formatMoney } from './money-amount';
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
          accessible
          accessibilityLabel={`${it.label}, ${formatMoney(it.value, currency)}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ flexShrink: 1 }}>
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
          accessible
          accessibilityLabel={`${total.label}, ${formatMoney(total.value, currency)}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 4,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: c.borderSubtle,
          }}
        >
          <Text weight="semibold" size="sm" color="textStrong" style={{ flexShrink: 1 }}>
            {total.label}
          </Text>
          <MoneyAmount value={total.value} currency={currency} strong tone="brand" size="md" />
        </View>
      ) : null}
    </View>
  );
}
