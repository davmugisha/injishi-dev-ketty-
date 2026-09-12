/**
 * The palette generator, and the contrast floors its output records.
 *
 * `palette.ts` is generated and committed, so nothing at runtime re-derives it.
 * That makes two separate things worth testing, and they fail differently:
 *
 *  1. The **maths** in `scripts/color-math.mjs`. Both of its documented traps —
 *     reading the lightness as a number rather than a percentage, and clipping
 *     an out-of-gamut colour rather than mapping it — produce a valid hex string
 *     and a passing build. Only an assertion catches them.
 *  2. The **committed file**. `--check` in `lint` catches a palette that drifted
 *     from the tokens, but not a token change that quietly drops a colour below
 *     its contrast floor. These measure the committed values themselves, which
 *     is what screens actually paint.
 *
 * The floors are ADR-025's and ADR-030's: body text at 4.5:1, control
 * boundaries at 3:1, both measured against `surfaceTertiary` — the darkest
 * light surface, the lightest dark one and the darkest white one, and therefore
 * the worst case in each.
 *
 * **This file is `describe.each` over the scheme list on purpose.** White
 * (ADR-033) gained every floor below by being added to `SCHEMES`, and no new
 * assertion was written for it. That is the property worth keeping: a floor
 * cannot be added to one scheme and quietly skipped in another.
 */
import {
  clip,
  contrast,
  deltaEOK,
  fromHex,
  gamutMap,
  hex,
  inGamut,
  labToLinear,
  lchToLab,
  linearToLab,
  over,
  parseOklch,
  toBytes,
} from '../../scripts/color-math.mjs';
import { palettes, type ColorScheme, type Palette } from './palette';

/** The alphas `derive-palette.mjs` composites the badge tints at. */
const TINT_ALPHA: Record<ColorScheme, number> = { light: 0.14, dark: 0.16 };

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

const SCHEMES: ColorScheme[] = ['light', 'dark'];

/** `surfaceTertiary`, the worst-case ground in both schemes. */
const ground = (scheme: ColorScheme) => fromHex(palettes[scheme].surface3);

/** A palette value's bytes. An eight-digit value is composited over the ground. */
function bytes(scheme: ColorScheme, key: keyof Palette): number[] {
  const value = palettes[scheme][key];
  const rgb = fromHex(value);
  if (value.length === 9) {
    const alpha = parseInt(value.slice(7, 9), 16) / 255;
    return over(rgb, alpha, ground(scheme));
  }
  return rgb;
}

describe('parseOklch', () => {
  it('reads the lightness as a percentage, not as a number', () => {
    // The single most consequential line in the generator. `65.00%` is L = 0.65
    // in the OKLab maths; feeding 65 straight in blows the colour out and still
    // emits a valid hex string, which is a failure that looks like success.
    expect(parseOklch('oklch(65.00% 0.1100 208.00)')).toEqual({
      L: 0.65,
      C: 0.11,
      H: 208,
    });
  });

  it('rejects a lightness outside 0..1 rather than emitting a blown-out colour', () => {
    expect(() => parseOklch('oklch(650.00% 0.11 208)', 'role "x"')).toThrow(/outside 0\.\.1/);
  });

  it('rejects a value that is not oklch(), naming the caller', () => {
    expect(() => parseOklch('#0EA5E9', 'role "accent" (light)')).toThrow(
      /role "accent" \(light\) is not oklch\(\)/,
    );
  });

  it('does not silently accept a lightness written without the percent sign', () => {
    expect(() => parseOklch('oklch(0.65 0.11 208)')).toThrow(/is not oklch\(\)/);
  });
});

describe('gamutMap', () => {
  it('leaves an in-gamut colour alone', () => {
    const { mappedTo } = gamutMap(0.65, 0.11, 208);
    expect(mappedTo).toBeNull();
  });

  it('maps an out-of-gamut colour by reducing chroma, not by clipping', () => {
    // `success` is oklch(73.29% 0.1974 145.31), and that chroma is out of sRGB
    // once the pinned text step drags the lightness down to 0.48 — which is the
    // value `palette.ts` actually ships, and the one the generator reports as
    // `light success@L0.48: chroma 0.1974 -> 0.1822`. Clipping the channels
    // instead would yield a colour a browser does not paint for the same token,
    // silently invalidating every contrast measurement taken against the web.
    const L = 0.48;
    const C = 0.1974;
    const H = 145.31;
    expect(inGamut(labToLinear(lchToLab(L, C, H)))).toBe(false);

    const { rgb, mappedTo } = gamutMap(L, C, H);
    expect(mappedTo).not.toBeNull();
    expect(mappedTo).toBeLessThan(C);
    expect(mappedTo).toBeGreaterThan(0);
    expect(inGamut(rgb)).toBe(true);
  });

  it('lands within one JND of the reduced colour, which a plain clip does not', () => {
    const L = 0.48;
    const C = 0.1974;
    const H = 145.31;

    /** One just-noticeable difference — the bound the mapper searches against. */
    const JND = 0.02;

    const target = lchToLab(L, C, H);
    const clipped = clip(labToLinear(target));
    const { rgb, mappedTo } = gamutMap(L, C, H);

    // Not the naive clip. That is the whole reason the mapper exists.
    expect(rgb).not.toEqual(clipped);

    // The mapper's own termination condition, stated as an assertion: at the
    // chroma it settled on, the rendered colour is within one JND of the ideal
    // colour at that chroma. It is a bounded error, not an exact hold — the
    // final step still clips, just by an amount nobody can see.
    const lab = linearToLab(rgb);
    expect(deltaEOK(lab, lchToLab(L, mappedTo as number, H))).toBeLessThanOrEqual(JND);

    // Clipping the authored chroma outright carries no such bound, and here
    // exceeds it. That is the difference: a bounded error against a browser's
    // rendering of the same token, versus an unbounded one.
    expect(deltaEOK(linearToLab(clipped), target)).toBeGreaterThan(JND);

    // Chroma is the axis that moved. Lightness drifts by less than the chroma
    // it gave up, which is what "reduce chroma with lightness and hue held"
    // means once the JND tolerance is allowed for.
    const chromaOf = (l: number[]) => Math.hypot(l[1], l[2]);
    expect(Math.abs(lab[0] - L)).toBeLessThan(C - chromaOf(lab));
  });

  it('clamps the two degenerate lightnesses', () => {
    expect(gamutMap(1, 0.2, 145)).toEqual({ rgb: [1, 1, 1], mappedTo: null });
    expect(gamutMap(0, 0.2, 145)).toEqual({ rgb: [0, 0, 0], mappedTo: null });
  });

  it('round-trips through hex as an uppercase six-digit value', () => {
    const { rgb } = gamutMap(0.65, 0.11, 208);
    const value = hex(toBytes(rgb));
    expect(value).toMatch(/^#[0-9A-F]{6}$/);
    expect(fromHex(value)).toEqual(toBytes(rgb));
  });
});

describe.each(SCHEMES)('the committed %s palette', (scheme) => {
  it('resolves every key to a hex colour', () => {
    for (const [key, value] of Object.entries(palettes[scheme])) {
      expect({ key, value }).toEqual({ key, value: expect.stringMatching(/^#[0-9A-F]{6,8}$/) });
    }
  });

  it('has the same key set as every other scheme', () => {
    // Not "the other one": with three schemes a key can go missing from exactly
    // one of them and still match whichever single partner was checked.
    for (const other of SCHEMES) {
      expect(Object.keys(palettes[scheme]).sort()).toEqual(Object.keys(palettes[other]).sort());
    }
  });

  it.each(['textStrong', 'textBody', 'textMuted', 'textSubtle', 'textLink'] as const)(
    '%s carries body text at 4.5:1 on the worst-case ground',
    (key) => {
      expect(contrast(bytes(scheme, key), ground(scheme))).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it.each([
    ['success600', 'success500'],
    ['warning600', 'warning500'],
    ['danger600', 'danger500'],
  ] as const)('%s reads at 4.5:1 as ink on its own %s tint', (ink, fill) => {
    // Measured on the tint it is actually drawn on. A badge ink never sits on
    // the bare surface, so measuring it there would pass a colour that fails
    // where it is really used.
    const tint = over(bytes(scheme, fill), TINT_ALPHA[scheme], ground(scheme));
    expect(contrast(bytes(scheme, ink), tint)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('domainResidence reads at 4.5:1 as ink on its own tint', () => {
    // One key doing two jobs: the badge fill and the badge ink.
    const tint = over(bytes(scheme, 'domainResidence'), TINT_ALPHA[scheme], ground(scheme));
    expect(contrast(bytes(scheme, 'domainResidence'), tint)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('textOnBrand is near-ink rather than white, and passes on the accent fill', () => {
    // ADR-025 correction #1: the accent fill sits at L 0.65, which carries white
    // at 3.10:1. Anything drawn on it takes this value instead.
    expect(palettes[scheme].textOnBrand).not.toBe('#FFFFFF');
    expect(
      contrast(bytes(scheme, 'textOnBrand'), bytes(scheme, 'domainHospitality')),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(['action', 'domainResidence'] as const)(
    'bgApp reads at 4.5:1 on the solid %s fill',
    (fill) => {
      expect(contrast(bytes(scheme, 'bgApp'), bytes(scheme, fill))).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it('borderStrong meets the 3:1 control boundary (WCAG 1.4.11)', () => {
    // A control boundary, not text, so 3:1 is the floor and 4.5:1 is not asked.
    expect(contrast(bytes(scheme, 'borderStrong'), ground(scheme))).toBeGreaterThanOrEqual(
      AA_NON_TEXT,
    );
  });
});
