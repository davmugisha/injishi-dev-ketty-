/**
 * HeroCard — the "dark card" frames R12 and R15 draw, resolved for both
 * schemes.
 *
 * The canvas draws one loud ink plate per screen: R12's NEXT PAYMENT block and
 * R15's RENT / ENDS block. It is the only element on either screen that is not
 * a white card, and that contrast is the whole hierarchy — take it away and
 * Rent becomes four cards of equal weight with the amount owed buried in the
 * middle of them.
 *
 * **It cannot be one fill in both schemes.** The design brief §3.4 is explicit:
 * "The mobile dark theme is ink-canvas, not inverted-card. Do not draw a white
 * card on a mobile dark screen." `surfaceInverse` is ink in light and near-white
 * in dark, so drawing the frame's plate literally would put exactly the banned
 * white card on the dark screen. So the plate is scheme-aware and the INTENT is
 * what carries over, not the hex:
 *
 *   - **light** — the ink plate the canvas draws, `surfaceInverse`, with the
 *     fixed light foregrounds `onPhoto` / `onPhotoMuted`. Those are the two
 *     values the brief already reserves for "text on a dark ground that does
 *     not invert" (§6, §8.7), which is exactly this situation.
 *   - **dark** — the ink canvas has nothing darker to go to, so the plate
 *     elevates the way §3.4 says dark elevates: one rung up the surface ramp
 *     (`surface2`), with a `borderBrand` edge so it still reads as the loudest
 *     block on the page.
 *
 * `useHeroTones()` returns every colour a child needs plus the Button variant
 * that reads on the plate, so a caller never picks one itself. `primary` in
 * light would be ink on ink; `subtle` in dark would be the plate's own fill.
 */
import { type ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { fontSize, lineHeight, type TextSize } from '@/theme/tokens';

export interface HeroTones {
  ground: string;
  border: string;
  /** Headline and figure. */
  fg: string;
  /** Supporting line. */
  fgMuted: string;
  /** Eyebrow, footnote, hairline. */
  fgDim: string;
  /** The Button variant that reads against `ground`. */
  button: 'primary' | 'secondary';
}

export function useHeroTones(): HeroTones {
  const { c, scheme, onPhoto, onPhotoMuted, onPhotoDim } = useTheme();
  return scheme === 'light'
    ? {
        ground: c.surfaceInverse,
        border: c.surfaceInverse,
        fg: onPhoto,
        fgMuted: onPhotoMuted,
        fgDim: onPhotoDim,
        button: 'secondary',
      }
    : {
        ground: c.surface2,
        border: c.borderBrand,
        fg: c.textStrong,
        fgMuted: c.textMuted,
        fgDim: c.textSubtle,
        button: 'primary',
      };
}

export function HeroCard({ children }: { children: ReactNode }) {
  const { space, radius } = useTheme();
  const tones = useHeroTones();

  return (
    <View
      style={{
        gap: space[3],
        padding: space[5],
        borderRadius: radius.xl,
        backgroundColor: tones.ground,
        borderWidth: 1,
        borderColor: tones.border,
      }}
    >
      {children}
    </View>
  );
}

/** The plate's small uppercase label: "NEXT PAYMENT", "RENT", "ENDS". */
export function HeroLabel({ children }: { children: string }) {
  const tones = useHeroTones();
  return (
    <Text
      weight="bold"
      size="xs"
      color={tones.fgDim}
      style={{ letterSpacing: 1, textTransform: 'uppercase' }}
    >
      {children}
    </Text>
  );
}

/**
 * Money on the plate, in the canonical `RWF 45,000` form.
 *
 * **This is a duplicate of `MoneyAmount` and it should not exist.** That
 * component resolves its own colour from the palette — `textStrong` for the
 * figure, `textMuted` for the currency mark — and offers no way to override it,
 * so on the light scheme's ink plate it paints near-ink on near-ink and the
 * amount owed disappears. The kit has no "money on a dark ground" and frame R12
 * is entirely about one.
 *
 * The fix is a `color` prop on `MoneyAmount`, which is additive and changes
 * nothing for its existing call sites — but `money-amount.tsx` is shared, eight
 * sessions are in this tree at once, and the prompt pack's rule is to build the
 * missing piece locally and report it. So: reported, and `hero-card.test.tsx`
 * asserts this renders character-for-character what `MoneyAmount` renders, so
 * the two cannot drift while the duplicate stands. **Session 11: add the prop
 * and delete this.**
 *
 * The spec it implements is design brief §8.6 — currency prefix, `en-US`
 * thousands, no decimals for RWF, the mark at `size × 0.82` with a `size × 0.28`
 * right margin, tabular figures.
 */
export function HeroMoney({ value, size = 'md' }: { value: number; size?: TextSize }) {
  const tones = useHeroTones();
  // Same derivation as `MoneyAmount`: the currency reads as a unit beside
  // the figure, not as part of it.
  const px = fontSize[size];
  const whole = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      {value < 0 ? (
        <Text family="mono" weight="semibold" size={size} color={tones.fg}>
          −
        </Text>
      ) : null}
      <Text
        family="mono"
        weight="medium"
        sizePx={Math.round(px * 0.82)}
        lineHeightPx={lineHeight[size]}
        color={tones.fgMuted}
        style={{ marginRight: Math.round(px * 0.28) }}
      >
        RWF
      </Text>
      <Text family="mono" weight="semibold" size={size} color={tones.fg}>
        {whole}
      </Text>
    </View>
  );
}

/** The hairline that splits the plate into R15's two columns. */
export function HeroRule() {
  const tones = useHeroTones();
  return <View style={{ height: 1, backgroundColor: tones.fgDim, opacity: 0.5 }} />;
}
