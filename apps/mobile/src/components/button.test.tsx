/**
 * Button — the control every other screen leans on.
 *
 * What earns a test here is the branching: five variants that each resolve a
 * different fill and a different foreground, a disabled state that has to both
 * look and *announce* disabled, a busy state that has to refuse presses while
 * staying at full strength, and the hit area that keeps a 40px button
 * reachable. The visual details around them are not asserted; they change with
 * the design and a test that pins them only makes the design harder to change.
 *
 * **ADR-064 changed what three of these pin, on purpose**, and each changed test
 * names its AC: primary is teal now (AC-1), the heights are HeroUI's 40, 48 and
 * 56 as minimums (AC-2), and the other variants repaint (AC-3). `pending` is new
 * (AC-4).
 *
 * **The fill is read with `enclosingFill` rather than off the pressable's own
 * style.** Session 11 moved `Button` onto `PressableScale`, which carries the
 * fill on the animated view INSIDE the pressable rather than on the pressable
 * itself — and every fill assertion here broke on that, reading `undefined`.
 * The assertions were right and the mechanism was not: how many wrappers sit
 * between a label and its ground is a layout detail, which is the case
 * `test-utils`' own `enclosingFill` was written for.
 */
import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Button } from './button';
import { SCHEMES, enclosingFill, flattenStyle, paletteFor, renderInScheme } from '@/test-utils';
import { kitMetrics, radius } from '@/theme/tokens';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const impact = Haptics.impactAsync as jest.Mock;

beforeEach(() => impact.mockClear());

/** The ground behind a button's label, whatever it is nested in. */
const fillBehind = (label: string) => enclosingFill(screen.getByText(label));

type Node = { props?: { style?: unknown }; parent: unknown };

/** The button's own box, wherever `PressableScale` puts it: the view with the minimum height. */
const boxOf = (node: Node) => {
  for (let cur = node as Node | null; cur; cur = cur.parent as Node | null) {
    const style = flattenStyle(cur.props?.style);
    if (style.minHeight !== undefined) return style;
  }
  return {} as Record<string, unknown>;
};

/** Lay the button out at a width, as the platform would after a render. */
const layOut = (label: string, width: number) =>
  fireEvent(screen.getByText(label), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 48 } },
  });

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

  it('paints primary with the accent and its own label, never the ink action fill (ADR-064 AC-1)', () => {
    renderInScheme(<Button>Continue</Button>, scheme);
    expect(fillBehind('Continue')).toBe(c.domainHospitality);
    expect(flattenStyle(screen.getByText('Continue').props.style).color).toBe(c.textOnBrand);
  });

  it.each([
    ['secondary', 'surface3', 'textLink'],
    ['danger', 'danger500', 'textOnDanger'],
  ] as const)('paints %s from the palette (ADR-064 AC-3)', (variant, fill, ink) => {
    renderInScheme(<Button variant={variant}>Go</Button>, scheme);
    expect(fillBehind('Go')).toBe(c[fill]);
    expect(flattenStyle(screen.getByText('Go').props.style).color).toBe(c[ink]);
  });

  it.each([
    ['primary', 'pressInk'],
    ['danger', 'pressInk'],
    ['secondary', 'textLink'],
    ['ghost', 'textBody'],
  ] as const)('presses %s toward %s, never lightening a fill under a light label (ADR-068)', (variant, highlight) => {
    renderInScheme(<Button variant={variant}>Go</Button>, scheme);
    const glow = flattenStyle(screen.UNSAFE_getAllByProps({ pointerEvents: 'none' })[0].props.style);
    expect(glow.backgroundColor).toBe(c[highlight]);
  });

  it('draws outline with no fill and a hairline borderDefault edge (ADR-064 AC-3)', () => {
    renderInScheme(<Button variant="outline">Later</Button>, scheme);
    expect(fillBehind('Later')).toBe('transparent');
    const box = boxOf(screen.getByText('Later'));
    expect(box.borderWidth).toBe(kitMetrics.hairline);
    expect(box.borderColor).toBe(c.borderDefault);
  });

  it('draws a ghost button with no fill at all', () => {
    renderInScheme(<Button variant="ghost">Not now</Button>, scheme);
    expect(fillBehind('Not now')).toBe('transparent');
  });

  it.each(['sm', 'md', 'lg'] as const)('draws a %s button as a pill (ADR-064 AC-2)', (size) => {
    renderInScheme(<Button size={size}>Tap</Button>, scheme);
    expect(boxOf(screen.getByText('Tap')).borderRadius).toBe(radius.pill);
  });

  it.each([
    ['sm', 40],
    ['md', 48],
    ['lg', 56],
  ] as const)(
    'gives a %s button a minimum height of %i that reaches 44 with hit slop (ADR-064 AC-2)',
    (size, minHeight) => {
      renderInScheme(<Button size={size}>Tap</Button>, scheme);
      const box = boxOf(screen.getByText('Tap'));
      // A minimum, not a height: large text grows the button instead of cutting it.
      expect(box.minHeight).toBe(minHeight);
      expect(box.height).toBeUndefined();
      const slop = screen.getByRole('button').props.hitSlop as number;
      expect(minHeight + slop * 2).toBeGreaterThanOrEqual(44);
    },
  );

  it('lets a long label wrap rather than cutting it (ADR-064 AC-2, AC-23)', () => {
    renderInScheme(<Button>Confirm and pay for the whole stay</Button>, scheme);
    expect(screen.getByText('Confirm and pay for the whole stay').props.numberOfLines).toBeUndefined();
  });

  describe('while pending (ADR-064 AC-4)', () => {
    it('shows the busy ring, keeps the label, and is announced busy', () => {
      renderInScheme(<Button pending>Send</Button>, scheme);
      expect(screen.getByTestId('button-spinner', { includeHiddenElements: true })).toBeTruthy();
      expect(screen.getByText('Send')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Send' })).toBeBusy();
    });

    it('keeps the ring out of the screen reader, which hears the button busy instead', () => {
      renderInScheme(<Button pending>Send</Button>, scheme);
      expect(screen.queryByTestId('button-spinner')).toBeNull();
    });

    it('replaces the leading icon rather than adding a second one beside it', () => {
      renderInScheme(
        <Button pending leadingIcon="check">
          Save
        </Button>,
        scheme,
      );
      expect(screen.getAllByTestId('button-spinner', { includeHiddenElements: true })).toHaveLength(1);
    });

    it('refuses presses and stays quiet', () => {
      const onPress = jest.fn();
      renderInScheme(
        <Button pending onPress={onPress}>
          Confirm booking
        </Button>,
        scheme,
      );
      fireEvent.press(screen.getByRole('button', { name: 'Confirm booking' }));
      expect(onPress).not.toHaveBeenCalled();
      expect(impact).not.toHaveBeenCalled();
    });

    it('keeps full strength alone and drops to half with disabled', () => {
      const { rerender } = renderInScheme(<Button pending>Send</Button>, scheme);
      expect(boxOf(screen.getByText('Send')).opacity).toBe(1);
      rerender(
        <Button pending disabled>
          Send
        </Button>,
      );
      expect(boxOf(screen.getByText('Send')).opacity).toBe(kitMetrics.disabledOpacity);
    });

    it('never gets narrower than it was before it went busy', () => {
      const { rerender } = renderInScheme(<Button>Send message</Button>, scheme);
      act(() => {
        layOut('Send message', 184);
      });
      // The screen swaps in a shorter label while the write is in flight.
      rerender(<Button pending>Send</Button>);
      expect(boxOf(screen.getByText('Send')).minWidth).toBe(184);
      // And lets go once it is done.
      rerender(<Button>Send message</Button>);
      expect(boxOf(screen.getByText('Send message')).minWidth).toBeUndefined();
    });
  });

  it('buzzes on a primary press and stays quiet on a ghost one', () => {
    renderInScheme(
      <>
        <Button onPress={() => {}}>Book</Button>
        <Button variant="ghost" onPress={() => {}}>
          Skip
        </Button>
      </>,
      scheme,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
    expect(impact).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Book' }));
    expect(impact).toHaveBeenCalledTimes(1);
  });
});
