/**
 * PressableScale — the one press feel every control in the kit shares
 * (ADR-064 AC-5).
 *
 * `pressScale` is a pure function and is tested as one, at the three widths
 * `verify.md` names. The rest is what a person sees or hears: the highlight is
 * the control's own content colour at the right strength, a busy control
 * refuses the finger without dimming, and a disabled one draws at half.
 *
 * The animated values themselves are not asserted. Reanimated runs for real
 * here, and a test that waits on a timing curve is a test that flakes; the
 * device walk in `verify.md` is where the motion is judged.
 */
import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { PressableScale, pressScale } from './pressable-scale';
import { SCHEMES, flattenStyle, paletteFor, renderInScheme } from '@/test-utils';
import { kitMetrics } from '@/theme/tokens';

describe('pressScale (ADR-064 AC-5)', () => {
  it.each([
    [100, 0.97],
    [300, 0.985],
    [600, 0.9925],
  ])('shrinks a control %ipt wide to %d', (width, scale) => {
    expect(pressScale(width)).toBeCloseTo(scale, 6);
  });

  it('never shrinks a narrow control past the floor', () => {
    expect(pressScale(20)).toBe(kitMetrics.press.scaleFloor);
  });

  it('holds the floor before a layout has reported any width', () => {
    expect(pressScale(0)).toBe(kitMetrics.press.scaleFloor);
    expect(pressScale(Number.NaN)).toBe(kitMetrics.press.scaleFloor);
  });
});

/** The highlight overlay: the one view that never takes a touch. */
const overlays = () => screen.UNSAFE_getAllByProps({ pointerEvents: 'none' });

/** The drawn control: the view that carries the caller's style. */
const controlOf = (label: string) => {
  type Node = { props?: { style?: unknown }; parent: Node | null };
  for (let cur = screen.getByText(label) as unknown as Node | null; cur; cur = cur.parent) {
    const style = flattenStyle(cur.props?.style);
    if (style.borderRadius === 12) return style;
  }
  return {} as Record<string, unknown>;
};

describe.each(SCHEMES)('PressableScale in the %s scheme', (scheme) => {
  const c = paletteFor(scheme);

  it('draws the highlight in the colour it is given, shaped like the control', () => {
    renderInScheme(
      <PressableScale accessibilityLabel="Book" highlight="textOnBrand" filled style={{ borderRadius: 12 }}>
        <Text>Book</Text>
      </PressableScale>,
      scheme,
    );
    const glow = flattenStyle(overlays()[0].props.style);
    expect(glow.backgroundColor).toBe(c.textOnBrand);
    expect(glow.borderRadius).toBe(12);
  });

  it('defaults the highlight to the body text colour, for a plain surface', () => {
    renderInScheme(
      <PressableScale accessibilityLabel="Row">
        <Text>Row</Text>
      </PressableScale>,
      scheme,
    );
    expect(flattenStyle(overlays()[0].props.style).backgroundColor).toBe(c.textBody);
  });

  it('draws no highlight for a backdrop or an inline link', () => {
    renderInScheme(
      <PressableScale accessibilityLabel="Close" highlight="none">
        <Text>Close</Text>
      </PressableScale>,
      scheme,
    );
    expect(screen.UNSAFE_queryAllByProps({ pointerEvents: 'none' })).toHaveLength(0);
  });

  it('refuses a press while busy, is announced busy, and keeps full strength', () => {
    const onPress = jest.fn();
    renderInScheme(
      <PressableScale accessibilityLabel="Send" busy onPress={onPress} style={{ borderRadius: 12 }}>
        <Text>Send</Text>
      </PressableScale>,
      scheme,
    );
    const button = screen.getByRole('button', { name: 'Send' });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
    expect(button).not.toBeDisabled();
    expect(controlOf('Send').opacity).toBe(1);
  });

  it('draws a disabled control at half strength (ADR-064 AC-5)', () => {
    renderInScheme(
      <PressableScale accessibilityLabel="Pay" disabled style={{ borderRadius: 12 }}>
        <Text>Pay</Text>
      </PressableScale>,
      scheme,
    );
    expect(controlOf('Pay').opacity).toBe(kitMetrics.disabledOpacity);
  });

  it('still presses normally when neither busy nor disabled', () => {
    const onPress = jest.fn();
    renderInScheme(
      <PressableScale accessibilityLabel="Open" onPress={onPress}>
        <Text>Open</Text>
      </PressableScale>,
      scheme,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Open' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
