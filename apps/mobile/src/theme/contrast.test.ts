/**
 * Contrast for the PAIRS the components actually draw, in every scheme.
 *
 * `scripts/derive-palette.mjs --check` already measures every ROLE against the
 * hardest surface in each scheme, and it passes. That is not the same question
 * as this one, and Session 11's dark audit found two failures it could not
 * have caught:
 *
 *   - `screens/inbox/composer.tsx` drew the send glyph as `textOnBrand` on
 *     `action` — **1.00:1 in the light scheme**, near-ink on near-ink, and the
 *     send control was simply invisible on a light phone.
 *   - `screens/inbox/message-bubble.tsx` drew the sender's own message as
 *     `textOnBrand` on `brand500` — **3.18:1 in light**, under the 4.5 floor,
 *     on the one thing on that screen anybody is reading.
 *
 * Both are pairs of two perfectly good roles. A per-role table cannot see them,
 * because neither role is wrong on its own — only together. So this file exists,
 * and every pair below is one a component in this app actually paints. Adding a
 * new fill-and-ink pair to a component means adding a row here.
 *
 * ADR-019's own rule is why every scheme is measured rather than just light:
 * "a table that only ever measures the canvas cannot see a card bug."
 */
import { palettes, type ColorScheme, type Palette } from './palette';
import { kitMetrics } from './tokens';

/**
 * Every scheme, so a pair cannot be correct in two of them and wrong in the
 * third. White (ADR-033) is the one where that is most likely: it is the only
 * scheme whose ground ladder INVERTS, so a fill that separated by sitting above
 * its page now sits below it.
 */
const SCHEMES: ColorScheme[] = ['light', 'dark'];

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * **The status tints are translucent, and measuring them opaque is wrong.**
 *
 * `success100`, `warning100` and `danger100` are eight-digit hex — the status
 * fill at 0.14 alpha in light and white, 0.16 in dark. Reading the first six digits
 * and stopping measures a colour nothing ever paints: a 14% tint over a white
 * card is nearly white, and the opaque green underneath it is not. The first
 * version of this file did exactly that and reported three passing badges as
 * failures, which is a good demonstration of why the composite matters.
 *
 * So a translucent value is composited over the ground it is actually drawn on
 * — which is why every `Pair` below can name an `over`.
 */
function composite(hex: string, over: string): string {
  if (hex.length <= 7) return hex;
  const alpha = parseInt(hex.slice(7, 9), 16) / 255;
  const [fr, fg, fb] = channels(hex);
  const [br, bg, bb] = channels(over);
  const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
  return `#${[mix(fr, br), mix(fg, bg), mix(fb, bb)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** WCAG 2.1 relative luminance, from an `#RRGGBB` string. */
function luminance(hex: string): number {
  const linear = channels(hex)
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/** A literal, for the two components that paint white on a status fill. */
const WHITE = '#FFFFFF';

type Ink = keyof Palette | typeof WHITE;

interface Pair {
  where: string;
  ink: Ink;
  ground: keyof Palette;
  /**
   * What the GROUND is painted on, when the ground is a translucent tint. A
   * status badge sits on a card, so `surface1`; the same badge on the app
   * canvas would be a different measurement and would need its own row.
   */
  over?: keyof Palette;
  /** 4.5 for text, 3 for a glyph or a boundary (WCAG 1.4.11). */
  floor: 4.5 | 3;
}

const resolve = (p: Palette, ink: Ink) => (ink === WHITE ? WHITE : p[ink]);

/**
 * Every fill-and-ink pair a component draws, named by where it is drawn so a
 * failure points at a file rather than at a colour.
 */
const PAIRS: Pair[] = [
  /* The kit's own controls. ADR-064 repainted the button and the badge; each
     row it changed names the AC that changed it. */
  { where: 'Button primary — textOnBrand on teal (ADR-064 AC-1)', ink: 'textOnBrand', ground: 'domainHospitality', floor: 4.5 },
  { where: 'Button danger — textOnDanger on danger500 (ADR-064 AC-3)', ink: 'textOnDanger', ground: 'danger500', floor: 4.5 },
  { where: 'Button secondary — textLink on surface3 (ADR-064 AC-3)', ink: 'textLink', ground: 'surface3', floor: 4.5 },
  { where: 'Button outline — textBody on surface1 (ADR-064 AC-3)', ink: 'textBody', ground: 'surface1', floor: 4.5 },
  { where: 'Button outline — textBody on the app ground (ADR-064 AC-3)', ink: 'textBody', ground: 'bgApp', floor: 4.5 },
  { where: 'Badge success — label on success100', ink: 'success600', ground: 'success100', over: 'surface1', floor: 4.5 },
  { where: 'Badge warning — label on warning100', ink: 'warning600', ground: 'warning100', over: 'surface1', floor: 4.5 },
  { where: 'Badge danger — label on danger100', ink: 'danger600', ground: 'danger100', over: 'surface1', floor: 4.5 },
  { where: 'Badge brand — textLink on surface2 (ADR-064 AC-10)', ink: 'textLink', ground: 'surface2', floor: 4.5 },
  { where: 'Badge neutral — textBody on surface3 (ADR-064 AC-10)', ink: 'textBody', ground: 'surface3', floor: 4.5 },
  { where: 'Badge brand solid — textOnBrand on teal (ADR-064 AC-10)', ink: 'textOnBrand', ground: 'domainHospitality', floor: 4.5 },
  { where: 'Badge neutral solid — bgApp on textMuted (ADR-064 AC-10)', ink: 'bgApp', ground: 'textMuted', floor: 4.5 },
  { where: 'Tag selected — label on actionSubtle', ink: 'brand700', ground: 'actionSubtle', floor: 4.5 },
  { where: 'Tag — label on surface2', ink: 'textBody', ground: 'surface2', floor: 4.5 },
  { where: 'Card tint — body on elevate1', ink: 'brand900', ground: 'elevate1', floor: 4.5 },
  { where: 'ListRow — subtitle on surface1', ink: 'textMuted', ground: 'surface1', floor: 4.5 },
  { where: 'Screen — muted body on bgApp', ink: 'textMuted', ground: 'bgApp', floor: 4.5 },
  { where: 'Screen — subtle body on surface3', ink: 'textSubtle', ground: 'surface3', floor: 4.5 },
  { where: 'Toast — body on surface1', ink: 'textBody', ground: 'surface1', floor: 4.5 },

  /* The two the audit fixed. Both were pairs of good roles. */
  { where: 'inbox/composer — send glyph on action', ink: 'bgApp', ground: 'action', floor: 3 },
  { where: 'inbox/message-bubble — own message on brand500', ink: 'bgApp', ground: 'brand500', floor: 4.5 },

  /* Account, Session 11's own screens */
  { where: 'account — sign out on bgApp', ink: 'danger600', ground: 'bgApp', floor: 4.5 },
  { where: 'account/appearance — selected label on actionSubtle', ink: 'textLink', ground: 'actionSubtle', floor: 4.5 },
  { where: 'account/security — 2FA on state on success100', ink: 'success600', ground: 'success100', over: 'surface1', floor: 4.5 },
  { where: 'account/sign-out — scope note on warning100', ink: 'textBody', ground: 'warning100', over: 'surface1', floor: 4.5 },
  { where: 'account/payout — adapter chip on warning100', ink: 'warning600', ground: 'warning100', over: 'surface1', floor: 4.5 },
  { where: 'account/subscription — upgrade body on bgTint', ink: 'textBody', ground: 'bgTint', floor: 4.5 },

  /* Elsewhere in the app */
  { where: 'DomainBadge hospitality — ink on the accent fill', ink: 'textOnBrand', ground: 'domainHospitality', floor: 4.5 },
  { where: 'work/OfflineBar — body on warning100', ink: 'textBody', ground: 'warning100', over: 'surface1', floor: 4.5 },
  { where: 'OfflineNote — body on warning100', ink: 'textBody', ground: 'warning100', over: 'surface1', floor: 4.5 },
  { where: 'host/UndoBar-era inverse — body on surfaceInverse', ink: 'bgApp', ground: 'surfaceInverse', floor: 4.5 },
];

describe.each(SCHEMES)('%s scheme', (scheme) => {
  const p = palettes[scheme];

  it.each(PAIRS)('$where clears its floor', ({ ink, ground, over, floor }) => {
    const painted = composite(p[ground], p[over ?? 'bgApp']);
    const ratio = contrast(composite(resolve(p, ink), painted), painted);
    expect(ratio).toBeGreaterThanOrEqual(floor);
  });
});

describe('the pressed primary and danger buttons (ADR-064 AC-17)', () => {
  /**
   * A pressed button draws a highlight over its fill at 10%
   * (`kitMetrics.press.highlightFilled`, AC-5). The label has to stay readable
   * while the finger is down, so the pair is measured on the pressed ground,
   * not the resting one.
   *
   * Under ADR-064's teal the highlight was the near-ink label itself, which
   * darkened the fill. Under ADR-068 both labels here are snow, and snow over
   * the fill LIGHTENS it: 3.91:1 on the accent. So `Button` presses these two
   * toward `pressInk` instead (`PAINT.press`, which `button.test.tsx` pins),
   * and that is the highlight measured here: about 5.2:1, against 4.63:1 and
   * 4.59:1 at rest.
   */
  const alpha = Math.round(kitMetrics.press.highlightFilled * 255)
    .toString(16)
    .padStart(2, '0');

  it.each(SCHEMES)('keeps textOnBrand above 4.5:1 on the pressed accent in %s', (scheme) => {
    const p = palettes[scheme];
    const pressed = composite(p.pressInk + alpha, p.domainHospitality);
    expect(contrast(p.textOnBrand, pressed)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SCHEMES)('keeps textOnDanger above 4.5:1 on the pressed danger fill in %s', (scheme) => {
    const p = palettes[scheme];
    const pressed = composite(p.pressInk + alpha, p.danger500);
    expect(contrast(p.textOnDanger, pressed)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(SCHEMES)('would fail with the label drawn as its own highlight in %s', (scheme) => {
    // The control: what ADR-064 drew before ADR-068 turned the label light.
    const p = palettes[scheme];
    const pressed = composite(p.textOnBrand + alpha, p.domainHospitality);
    expect(contrast(p.textOnBrand, pressed)).toBeLessThan(4.5);
  });
});

describe('the two pairs the audit found', () => {
  /**
   * Under ADR-025's teal these two pairs FAILED: `textOnBrand` was near-ink, so
   * on `action` it measured about 1:1 and on `brand500` 3.18:1. That is why
   * the send glyph and the bubble moved off it, and they stay off it. ADR-068
   * made the accent ink snow, so both pairs now read; they are pinned at the
   * floor so the next palette that breaks them again fails here, by name,
   * rather than on a screen.
   */
  it('textOnBrand on action reads under ADR-068 (it was invisible under ADR-025)', () => {
    expect(contrast(palettes.light.textOnBrand, palettes.light.action)).toBeGreaterThanOrEqual(4.5);
  });

  it('textOnBrand on brand500 clears the floor under ADR-068 (3.18:1 under ADR-025)', () => {
    expect(contrast(palettes.light.textOnBrand, palettes.light.brand500)).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * The rule behind both, from design brief §7.3: `textOnBrand` is the ACCENT
   * fill's ink. It is right on `domainHospitality` and wrong everywhere else,
   * and that one sentence would have prevented both.
   */
  it('textOnBrand is correct on the accent it was made for', () => {
    for (const scheme of SCHEMES) {
      const p = palettes[scheme];
      expect(contrast(p.textOnBrand, p.domainHospitality)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('no pure black, anywhere', () => {
  /** Design brief §8.3. A shadow is ink-tinted; a ground is never `#000`. */
  it('holds for every role in every scheme', () => {
    for (const scheme of SCHEMES) {
      for (const [role, value] of Object.entries(palettes[scheme])) {
        expect(`${scheme}/${role}=${value}`).not.toMatch(/#000000$/i);
      }
    }
  });
});
