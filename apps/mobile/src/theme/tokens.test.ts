/**
 * The non-colour tokens ADR-064 added or moved: the corner roles, the two
 * shadows per scheme and platform, the segmented control's pair, and every
 * `kitMetrics` value (AC-6, AC-7, AC-8, AC-11, AC-17, AC-22, AC-26).
 *
 * These pin VALUES, which the component tests deliberately do not. That is the
 * point of a token table: a component reads a name, so the one place a number
 * can be wrong is here, and the one test that can see it is this one. A change
 * to a value is a design change; it changes the ADR first and this file with it.
 */
import { rnRadiusRoles } from '@injishi/design-tokens';
import { palettes, type ColorScheme } from './palette';
import {
  isLegacyShadowPlatform,
  kitMetrics,
  radius,
  scrim,
  segmentRoles,
  shadowFor,
} from './tokens';

const SCHEMES: ColorScheme[] = ['light', 'dark'];

/** WCAG relative luminance, for "which of two grounds is darker". */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('the corner roles (ADR-064 AC-6)', () => {
  it('are exactly five, at HeroUI Native values', () => {
    expect(rnRadiusRoles).toEqual({ sm: 8, md: 14, lg: 24, xl: 32, pill: 999 });
  });

  it('carry only the two retiring names besides the roles, until slice 4 deletes them', () => {
    const extra = Object.keys(radius).filter((k) => !(k in rnRadiusRoles));
    expect(extra.sort()).toEqual(['none', 'xs']);
    expect(radius.xs).toBe(rnRadiusRoles.sm);
  });
});

describe('the shadows (ADR-064 AC-7, AC-8, AC-26)', () => {
  it('draws three soft ink layers for a surface in light, and nothing in dark', () => {
    const light = shadowFor('light', false).surface;
    expect(light.boxShadow).toHaveLength(3);
    expect(light.elevation).toBeUndefined();
    expect(shadowFor('dark', false).surface).toEqual({});
  });

  it('lifts an overlay with three ink layers in light and a crisp 1px inner edge in dark', () => {
    expect(shadowFor('light', false).overlay.boxShadow).toHaveLength(3);
    expect(shadowFor('dark', false).overlay.boxShadow).toEqual([
      expect.objectContaining({ inset: true, spreadDistance: 1, blurRadius: 0, color: '#FFFFFF33' }),
    ]);
  });

  it('tints every light layer with ink, never black (design brief §8.3)', () => {
    const { surface, overlay } = shadowFor('light', false);
    for (const layer of [...(surface.boxShadow as object[]), ...(overlay.boxShadow as object[])]) {
      expect(layer).toEqual(expect.objectContaining({ color: expect.stringMatching(/^#042330[0-9A-F]{2}$/) }));
    }
  });

  it('falls back to elevation 2 and 6 on Android below 9, and still draws nothing in the dark flow', () => {
    expect(shadowFor('light', true).surface).toEqual({ elevation: 2 });
    expect(shadowFor('light', true).overlay).toEqual({ elevation: 6 });
    expect(shadowFor('dark', true).surface).toEqual({});
    expect(shadowFor('dark', true).overlay).toEqual({ elevation: 6 });
  });

  it.each([
    [{ OS: 'android', Version: 27 }, true],
    [{ OS: 'android', Version: 28 }, false],
    [{ OS: 'ios', Version: '17.0' }, false],
    [{ OS: 'web', Version: '' }, false],
  ])('treats %j as legacy: %s', (platform, legacy) => {
    expect(isLegacyShadowPlatform(platform)).toBe(legacy);
  });

  it('aliases the four retiring names to the two roles, until slice 4 deletes them', () => {
    for (const scheme of SCHEMES) {
      const s = shadowFor(scheme, false);
      expect([s.xs, s.sm]).toEqual([s.surface, s.surface]);
      expect([s.md, s.lg]).toEqual([s.overlay, s.overlay]);
    }
  });

  it('washes a backdrop in ink at 20%, the same in both schemes', () => {
    expect(scrim.backdrop).toBe('#04233033');
  });
});

describe('the segmented control pair (ADR-064 AC-11)', () => {
  /**
   * The order is the contract, not the keys: the indicator has to be the
   * LIGHTER of the two in both schemes or it disappears into its track. If
   * ADR-019 ever reorders the surface steps, this is the test that says so.
   */
  it.each(SCHEMES)('draws the track darker than the indicator in %s', (scheme) => {
    const p = palettes[scheme];
    const { track, indicator } = segmentRoles[scheme];
    expect(luminance(p[track])).toBeLessThan(luminance(p[indicator]));
  });

  it.each(SCHEMES)('keeps the selected label readable on the indicator in %s', (scheme) => {
    const p = palettes[scheme];
    expect(contrast(p.textStrong, p[segmentRoles[scheme].indicator])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(p.textMuted, p[segmentRoles[scheme].track])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('kitMetrics (ADR-064 AC-22)', () => {
  /**
   * The whole table, pinned. Each value is from the ADR's component table,
   * HeroUI Native 1.0.10's stylesheets, or the kit's own earlier value where
   * the ADR names none (AC-21); `tokens.ts` says which beside each group.
   */
  it('holds every value the ADR names', () => {
    expect(kitMetrics).toEqual({
      touchTarget: 44,
      disabledOpacity: 0.5,
      hairline: 1,
      emphasisEdge: 1.5,
      press: {
        shrinkPx: 4.5,
        scaleFloor: 0.97,
        widthBeforeLayout: 300,
        highlightFilled: 0.1,
        highlightTransparent: 0.06,
        retentionOffset: 12,
      },
      button: {
        sm: { minHeight: 40, insetX: 14, insetY: 8, gap: 6, icon: 16, hitSlop: 2 },
        md: { minHeight: 48, insetX: 16, insetY: 8, gap: 8, icon: 18, hitSlop: 0 },
        lg: { minHeight: 56, insetX: 20, insetY: 8, gap: 10, icon: 20, hitSlop: 0 },
      },
      spinner: { size: 16, stroke: 2 },
      card: { inset: 16, gap: 12, titleGap: 2, footerInsetY: 14 },
      field: { minHeight: 48, inset: 12, gap: 6, icon: 16, iconInset: 12, signatureHeight: 190 },
      badge: { md: { height: 20, insetX: 8 }, lg: { height: 28, insetX: 12 }, gap: 4, dot: 6 },
      chip: { minHeight: 36, insetX: 12, hitSlop: 4, gap: 8 },
      segmented: { trackInset: 3, triggerMinHeight: 36, triggerInsetX: 12, triggerInsetY: 6, hitSlop: 4 },
      sheet: { inset: 20, grabberWidth: 36, grabberHeight: 4, closeSize: 32, closeIcon: 18, closeHitSlop: 12 },
      toast: { inset: 16, gap: 12 },
      alert: { inset: 12, gap: 12, icon: 18 },
      listRow: { insetY: 12, insetX: 16, gap: 12, chevron: 16, tile: 36, minHeight: 44 },
      skeleton: { bandLight: 0.6, bandDark: 0.08 },
    });
  });

  it.each([
    ['button sm', kitMetrics.button.sm.minHeight, kitMetrics.button.sm.hitSlop],
    ['button md', kitMetrics.button.md.minHeight, kitMetrics.button.md.hitSlop],
    ['button lg', kitMetrics.button.lg.minHeight, kitMetrics.button.lg.hitSlop],
    ['chip', kitMetrics.chip.minHeight, kitMetrics.chip.hitSlop],
    ['segmented trigger', kitMetrics.segmented.triggerMinHeight, kitMetrics.segmented.hitSlop],
    ['sheet close', kitMetrics.sheet.closeSize, kitMetrics.sheet.closeHitSlop],
  ])('lets a %s reach the touch floor with its hit slop', (_, drawn, slop) => {
    expect(drawn + slop * 2).toBeGreaterThanOrEqual(kitMetrics.touchTarget);
  });

  it('keeps a wrapped button label off the edge without lifting a one line button off its minimum', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const m = kitMetrics.button[size];
      expect(m.insetY * 2).toBeLessThan(m.minHeight);
    }
  });

  it('fits the focus edge inside the field inset, so the text never moves', () => {
    expect(kitMetrics.field.inset - (kitMetrics.emphasisEdge - kitMetrics.hairline)).toBeGreaterThan(0);
  });
});
