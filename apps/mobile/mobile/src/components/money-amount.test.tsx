/**
 * MoneyAmount — small component, product decision.
 *
 * Money renders as `RWF 45,000`: currency first, thousands grouped, and no
 * decimals for RWF. That format is the product's, not the stylesheet's, so it
 * is asserted here rather than left to whoever next edits the component.
 *
 * The rest of what it does is arithmetic with a sign in front of it, which is
 * exactly the kind of thing that quietly breaks: a negative rendered without
 * its minus reads as money owed to you rather than by you.
 */
import { screen } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { MoneyAmount } from './money-amount';
import { SCHEMES, flattenStyle, paletteFor, renderInScheme } from '@/test-utils';

/**
 * The whole visible string, in the order a reader meets it. The component
 * splits the amount across several `Text` nodes so the currency, the sign and
 * the fraction can each carry their own weight and colour, which means the
 * order is only observable by joining them back up.
 */
const rendered = (): string =>
  screen
    .UNSAFE_getAllByType(RNText)
    .map((node) => node.props.children)
    .filter((child: unknown): child is string => typeof child === 'string')
    .join('');

describe.each(SCHEMES)('MoneyAmount in the %s scheme', (scheme) => {
  const c = paletteFor(scheme);

  it('renders RWF in prefix form, thousands grouped, no decimals', () => {
    renderInScheme(<MoneyAmount value={45000} />, scheme);
    expect(rendered()).toBe('RWF45,000');
    expect(screen.getByText('RWF')).toBeTruthy();
    expect(screen.getByText('45,000')).toBeTruthy();
  });

  it('keeps two decimals for a currency that has them', () => {
    renderInScheme(<MoneyAmount value={1234.5} currency="USD" />, scheme);
    expect(screen.getByText('USD')).toBeTruthy();
    expect(screen.getByText('1,234')).toBeTruthy();
    expect(screen.getByText('.50')).toBeTruthy();
  });

  it.each(['RWF', 'JPY', 'UGX', 'KES'] as const)('renders %s whole, with no decimals', (currency) => {
    renderInScheme(<MoneyAmount value={2500} currency={currency} />, scheme);
    expect(screen.queryByText('.00')).toBeNull();
    expect(screen.getByText('2,500')).toBeTruthy();
  });

  it('shows a minus on a negative, so an obligation cannot read as a credit', () => {
    renderInScheme(<MoneyAmount value={-45000} />, scheme);
    // U+2212, the typographic minus, not a hyphen.
    expect(screen.getByText('−')).toBeTruthy();
    expect(screen.getByText('45,000')).toBeTruthy();
  });

  it('shows a plus only when the caller asks for a signed amount', () => {
    renderInScheme(<MoneyAmount value={45000} signed />, scheme);
    expect(screen.getByText('+')).toBeTruthy();
  });

  it('leaves an unsigned positive unmarked', () => {
    renderInScheme(<MoneyAmount value={45000} />, scheme);
    expect(screen.queryByText('+')).toBeNull();
  });

  it('drops the currency when the caller does not want it repeated', () => {
    renderInScheme(<MoneyAmount value={45000} showCurrency={false} />, scheme);
    expect(screen.queryByText('RWF')).toBeNull();
    expect(screen.getByText('45,000')).toBeTruthy();
  });

  it('tones a signed negative as danger and a signed positive as success', () => {
    const { unmount } = renderInScheme(<MoneyAmount value={-1000} signed />, scheme);
    expect(flattenStyle(screen.getByText('1,000').props.style).color).toBe(c.danger600);
    unmount();

    renderInScheme(<MoneyAmount value={1000} signed />, scheme);
    expect(flattenStyle(screen.getByText('1,000').props.style).color).toBe(c.success600);
  });

  it('renders a plain amount in the strong text colour', () => {
    renderInScheme(<MoneyAmount value={1000} />, scheme);
    expect(flattenStyle(screen.getByText('1,000').props.style).color).toBe(c.textStrong);
  });

  it('renders zero rather than nothing when given no value', () => {
    renderInScheme(<MoneyAmount />, scheme);
    expect(screen.getByText('0')).toBeTruthy();
  });
});
