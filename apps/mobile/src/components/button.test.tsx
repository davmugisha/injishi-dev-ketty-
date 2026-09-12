/**
 * Button — the control every other screen leans on.
 *
 * What earns a test here is the branching: five variants that each resolve a
 * different fill and a different foreground, a disabled state that has to both
 * look and *announce* disabled, and the hit area that keeps a 32px button
 * reachable. The visual details around them are not asserted; they change with
 * the design and a test that pins them only makes the design harder to change.
 *
 * **The fill is read with `enclosingFill` rather than off the pressable's own
 * style.** Session 11 moved `Button` onto `PressableScale`, which carries the
 * fill on the animated view INSIDE the pressable rather than on the pressable
 * itself — and every fill assertion here broke on that, reading `undefined`.
 * The assertions were right and the mechanism was not: how many wrappers sit
 * between a label and its ground is a layout detail, which is the case
 * `test-utils`' own `enclosingFill` was written for.
 */
import { fireEvent, screen } from '@testing-library/react-native';
import { Button } from './button';
import { SCHEMES, enclosingFill, flattenStyle, paletteFor, renderInScheme } from '@/test-utils';

/** The ground behind a button's label, whatever it is nested in. */
const fillBehind = (label: string) => enclosingFill(screen.getByText(label));

/** The button's own box, wherever `PressableScale` puts it. */
const boxOf = (node: { props?: { style?: unknown }; parent: unknown }) => {
  for (let cur = node as { props?: { style?: unknown }; parent: unknown } | null; cur; cur = (cur as { parent: unknown }).parent as never) {
    const style = flattenStyle((cur as { props?: { style?: unknown } }).props?.style);
    if (style.height !== undefined) return style;
  }
  return {} as Record<string, unknown>;
};

describe.each(SCHEMES)('Button in the %s scheme', (scheme) => {
  const c = paletteFor(scheme);

  it('is a button, labelled by its own text', () => {
    renderInScheme(<Button onPress={() => {}}>Review and sign</Button>, scheme);
    expect(screen.getByRole('button', { name: 'Review and sign' })).toBeTruthy();
  });

  it('takes an explicit label over its text, for a reader who needs more', () => {
    renderInScheme(
      <Button accessibilityLabel="Open the lease for Unit 4B">Details</Button>,
      scheme,
    );
    expect(screen.getByRole('button', { name: 'Open the lease for Unit 4B' })).toBeTruthy();
    expect(screen.getByText('Details')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    renderInScheme(<Button onPress={onPress}>Pay rent</Button>, scheme);
    fireEvent.press(screen.getByRole('button', { name: 'Pay rent' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('announces disabled and does not fire, so the state is not visual only', () => {
    const onPress = jest.fn();
    renderInScheme(
      <Button disabled onPress={onPress}>
        Pay rent
      </Button>,
      scheme,
    );

    const button = screen.getByRole('button', { name: 'Pay rent' });
    expect(button).toBeDisabled();
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('paints the primary fill from the palette, not from a literal', () => {
    renderInScheme(<Button>Continue</Button>, scheme);
    expect(fillBehind('Continue')).toBe(c.action);
  });

  it('paints the danger fill from the palette', () => {
    renderInScheme(<Button variant="danger">Cancel the lease</Button>, scheme);
    expect(fillBehind('Cancel the lease')).toBe(c.danger500);
  });

  it('draws a ghost button with no fill at all', () => {
    renderInScheme(<Button variant="ghost">Not now</Button>, scheme);
    expect(fillBehind('Not now')).toBe('transparent');
  });

  it.each([
    ['sm', 32],
    ['md', 40],
    ['lg', 48],
  ] as const)('makes up the 44px touch target on a %s button with hit slop', (size, height) => {
    renderInScheme(<Button size={size}>Tap</Button>, scheme);
    const button = screen.getByRole('button');
    expect(boxOf(screen.getByText('Tap')).height).toBe(height);
    // The visual scale stays; the reachable area does not (design brief §7.2).
    const slop = button.props.hitSlop as number;
    expect(height + slop * 2).toBeGreaterThanOrEqual(44);
  });
});
