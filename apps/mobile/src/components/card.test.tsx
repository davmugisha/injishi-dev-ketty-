/**
 * Card and Badge — the two surfaces slice 1 of ADR-064 restyled beside the
 * button (AC-7, AC-10, AC-26).
 *
 * What is asserted is the part a screen cannot see from its own code: which
 * fill and which depth each variant draws in each scheme, and what an old
 * Android gets instead of a shadow it cannot draw. The shadow layers
 * themselves are pinned once, in `theme/tokens.test.ts`; here it is enough to
 * know WHICH token a card spread.
 */
import { screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';
import { Card } from './card';
import { Badge } from './badge';
import { SCHEMES, enclosingFill, flattenStyle, paletteFor, renderInScheme } from '@/test-utils';
import { kitMetrics, radius } from '@/theme/tokens';

type Node = { props?: { style?: unknown }; parent: Node | null };

/** The nearest ancestor of a label whose style matches, flattened. */
function styleAround(label: string, match: (s: Record<string, unknown>) => boolean) {
  for (let cur = screen.getByText(label) as unknown as Node | null; cur; cur = cur.parent) {
    const style = flattenStyle(cur.props?.style);
    if (match(style)) return style;
  }
  return {} as Record<string, unknown>;
}

/** The card's own box: the one drawn at the surface corner. */
const cardBox = (label: string) => styleAround(label, (s) => s.borderRadius === radius.lg);

describe.each(SCHEMES)('Card in the %s scheme (ADR-064 AC-7)', (scheme) => {
  const c = paletteFor(scheme);

  it('is a surface1 panel at the surface corner, with no border', () => {
    renderInScheme(
      <Card>
        <Text>Body</Text>
      </Card>,
      scheme,
    );
    const box = cardBox('Body');
    expect(box.backgroundColor).toBe(c.surface1);
    expect(box.borderWidth).toBeUndefined();
    expect(box.borderRadius).toBe(24);
  });

  it('insets its body by 16', () => {
    renderInScheme(
      <Card>
        <Text>Body</Text>
      </Card>,
      scheme,
    );
    expect(styleAround('Body', (s) => s.padding !== undefined).padding).toBe(kitMetrics.card.inset);
  });

  it(
    scheme === 'light'
      ? 'casts the soft surface shadow by default'
      : 'casts nothing by default, because depth in dark is the surface step',
    () => {
      renderInScheme(
        <Card>
          <Text>Body</Text>
        </Card>,
        scheme,
      );
      const shadow = cardBox('Body').boxShadow as unknown[] | undefined;
      if (scheme === 'light') expect(shadow).toHaveLength(3);
      else expect(shadow).toBeUndefined();
    },
  );

  it('casts nothing when flat', () => {
    renderInScheme(
      <Card variant="flat">
        <Text>Body</Text>
      </Card>,
      scheme,
    );
    expect(cardBox('Body').boxShadow).toBeUndefined();
  });

  it('fills surface2 and casts nothing when tinted', () => {
    renderInScheme(
      <Card variant="tint">
        <Text>Body</Text>
      </Card>,
      scheme,
    );
    const box = cardBox('Body');
    expect(box.backgroundColor).toBe(c.surface2);
    expect(box.boxShadow).toBeUndefined();
  });
});

describe('Card on Android below 9 (ADR-064 AC-26)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('falls back to elevation 2, because boxShadow draws nothing there', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(27);
    renderInScheme(
      <Card>
        <Text>Body</Text>
      </Card>,
      'light',
    );
    const box = cardBox('Body');
    expect(box.elevation).toBe(2);
    expect(box.boxShadow).toBeUndefined();
  });

  it('keeps the layered shadow on Android 9 and later', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(28);
    renderInScheme(
      <Card>
        <Text>Body</Text>
      </Card>,
      'light',
    );
    expect(cardBox('Body').boxShadow).toHaveLength(3);
  });
});

describe.each(SCHEMES)('Badge in the %s scheme (ADR-064 AC-10)', (scheme) => {
  const c = paletteFor(scheme);
  const pill = (label: string) => styleAround(label, (s) => s.borderRadius === radius.pill);

  it.each([
    ['md', 20, 8],
    ['lg', 28, 12],
  ] as const)('is a %s pill at least %i tall, inset %i', (size, height, inset) => {
    renderInScheme(<Badge size={size}>Paid</Badge>, scheme);
    const box = pill('Paid');
    expect(box.minHeight).toBe(height);
    expect(box.paddingHorizontal).toBe(inset);
    expect(box.borderWidth).toBeUndefined();
  });

  it('never cuts a long label, so frame W8 still holds (ADR-064 AC-23)', () => {
    renderInScheme(<Badge>Awaiting the landlord's signature</Badge>, scheme);
    expect(screen.getByText("Awaiting the landlord's signature").props.numberOfLines).toBeUndefined();
  });

  it.each([
    ['neutral', 'surface3', 'textBody'],
    ['brand', 'surface2', 'textLink'],
    ['success', 'success100', 'success600'],
  ] as const)('paints a soft %s tone as %s with %s', (tone, fill, ink) => {
    renderInScheme(<Badge tone={tone}>Label</Badge>, scheme);
    expect(enclosingFill(screen.getByText('Label'))).toBe(c[fill]);
    expect(flattenStyle(screen.getByText('Label').props.style).color).toBe(c[ink]);
  });

  it('paints a solid brand badge teal with its near-ink, the selection colour', () => {
    renderInScheme(
      <Badge tone="brand" solid>
        Instant
      </Badge>,
      scheme,
    );
    expect(enclosingFill(screen.getByText('Instant'))).toBe(c.domainHospitality);
    expect(flattenStyle(screen.getByText('Instant').props.style).color).toBe(c.textOnBrand);
  });
});
