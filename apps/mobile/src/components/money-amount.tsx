/**
 * MoneyAmount — consistent currency rendering with tabular (mono) figures.
 * Defaults to RWF, thousands-grouped, no decimals. Port of the DS component.
 *
 * **`formatMoney` is the same rule as one string, and it is exported.**
 * Session 11 lifted it here because three surfaces had written it separately:
 * `guest/listing-format.ts`'s `moneyText`, `host/host-booking-row.tsx`'s
 * `money`, and this component's own body. All three said "design brief §8.6"
 * and all three had to agree, which is exactly the condition a duplicated
 * formatter fails silently under — a fourth caller rounds differently and the
 * only symptom is one screen disagreeing with another about a price.
 *
 * The component needs the parts (currency, whole, fraction) because it draws
 * them at different sizes and colours; a spoken label needs the whole sentence,
 * because a `Pressable` collapses its children and a price outside its own
 * `accessibilityLabel` is a price no screen reader reads. So `splitMoney` is
 * the shared arithmetic and both forms read it.
 */
import { View } from 'react-native';
import { Text } from './text';
import { useTheme } from '@/theme/theme';
import { fontSize, lineHeight, type Palette, type TextSize } from '@/theme/tokens';

const ZERO_DEC: Record<string, number> = { RWF: 0, JPY: 0, UGX: 0, KES: 0 };

type Tone = 'brand' | 'positive' | 'negative';

/** RWF and its neighbours are whole-unit currencies; everything else takes 2. */
function decimalsFor(currency: string, override?: number): number {
  return override != null ? override : ZERO_DEC[currency] ?? 2;
}

/**
 * The one place the canonical form is computed: sign, currency, grouped whole,
 * fraction. Both `MoneyAmount` (three nodes) and `formatMoney` (one string)
 * read it, so they can never drift.
 */
export function splitMoney(
  value: number,
  currency = 'RWF',
  decimals?: number,
): { sign: string; currency: string; whole: string; frac?: string } {
  const dec = decimalsFor(currency, decimals);
  const [whole, frac] = Math.abs(value)
    .toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    .split('.');
  return { sign: value < 0 ? '−' : '', currency, whole, frac };
}

/**
 * `RWF 145,000` — the canonical form as a STRING (design brief §8.6: currency
 * prefix, comma groups, no decimals for RWF).
 *
 * For a screen reader label, a badge, a toast, or anywhere else a single string
 * is what the API takes. Render `<MoneyAmount>` wherever a component can go:
 * it sets the currency smaller and quieter than the figure, which this cannot.
 */
export function formatMoney(value: number, currency = 'RWF', decimals?: number): string {
  const parts = splitMoney(value, currency, decimals);
  return `${parts.sign}${parts.currency} ${parts.whole}${parts.frac ? `.${parts.frac}` : ''}`;
}

export interface MoneyAmountProps {
  value?: number;
  currency?: string;
  decimals?: number;
  showCurrency?: boolean;
  signed?: boolean;
  tone?: Tone;
  strong?: boolean;
  /**
   * The figure's step on the type scale. The currency prefix is DERIVED
   * from it at 82% — that ratio is the component's whole reason to exist
   * (`RWF` reads as a unit rather than as part of the number), and it is
   * the one place in the app where a size is correctly not a step.
   */
  size?: TextSize;
}

export function MoneyAmount({
  value = 0,
  currency = 'RWF',
  decimals,
  showCurrency = true,
  signed = false,
  tone,
  strong = false,
  size = 'md',
}: MoneyAmountProps) {
  const { c } = useTheme();
  // The figure's own pixel size, needed for the two values derived from it.
  const px = fontSize[size];
  const parts = splitMoney(value, currency, decimals);
  const { whole, frac } = parts;
  const sign = parts.sign || (signed && value > 0 ? '+' : '');

  const autoTone: Tone | undefined =
    tone ?? (signed ? (value < 0 ? 'negative' : value > 0 ? 'positive' : undefined) : undefined);
  const toneColor: Record<Tone, keyof Palette> = {
    brand: 'brand700',
    positive: 'success600',
    negative: 'danger600',
  };
  const color: keyof Palette = autoTone ? toneColor[autoTone] : 'textStrong';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      {sign ? (
        <Text family="mono" weight={strong ? 'semibold' : 'regular'} size={size} color={color}>
          {sign}
        </Text>
      ) : null}
      {showCurrency ? (
        <Text
          family="mono"
          weight="medium"
          sizePx={Math.round(px * 0.82)}
          lineHeightPx={lineHeight[size]}
          color="textMuted"
          style={{ marginRight: Math.round(px * 0.28) }}
        >
          {currency}
        </Text>
      ) : null}
      <Text family="mono" weight={strong ? 'semibold' : 'regular'} size={size} color={color}>
        {whole}
      </Text>
      {frac ? (
        <Text family="mono" weight={strong ? 'semibold' : 'regular'} size={size} color="textMuted">
          .{frac}
        </Text>
      ) : null}
    </View>
  );
}
