/**
 * Appearance — system, light or dark.
 *
 * The frames put it in PREFERENCES beside Language, and a preference that only
 * reports what the phone decided is not a preference. `src/theme/theme.tsx`
 * carries the state; this is the four-way choice over it.
 *
 * **White was a fourth option and has been withdrawn.** F0 added it (ADR-033);
 * it named a neutral ground, and the Light this product wants is the tinted
 * teal one. Three rows again, so the sheet is back on the shared
 * `CONFIRM_SHEET` detent that fitted three 56pt rows before F0 grew it.
 *
 * **Each option carries a word and a glyph, never a swatch alone.** A preview
 * tile is the obvious drawing here and it is the wrong one: the tile a reader
 * cannot yet see is the one they are choosing, so a row of swatches asks them
 * to judge a colour by a colour. The sentence under each option says what it
 * does instead — and "System" says which one it currently resolves to, because
 * that is the fact somebody opens this sheet to check.
 *
 * The change is live: the sheet repaints under the finger, which is the whole
 * feedback. No toast, no confirm — the result IS the confirmation, and a toast
 * on top of a screen that just changed colour is noise.
 */
import { View } from 'react-native';
import { Icon, PressableScale, Sheet, Text, type IconName } from '@/components';
import { APPEARANCES, useTheme, type Appearance } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';

/**
 * One glyph each, and each names the THING rather than a time of day: the
 * phone you are following, the light, the dark.
 */
export const APPEARANCE_GLYPH: Record<Appearance, IconName> = {
  system: 'smartphone',
  light: 'sun',
  dark: 'moon',
};

const BODY: Record<Appearance, MessageKey> = {
  system: 'appearance.systemBody',
  light: 'appearance.lightBody',
  dark: 'appearance.darkBody',
};

export function AppearanceSheet() {
  const { c, space, radius, appearance, setAppearance, scheme } = useTheme();
  const t = useT();

  return (
    <Sheet grabber title={t('appearance.title')} subtitle={t('appearance.subtitle')}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('appearance.title')}
        style={{ gap: space[2] }}
      >
        {APPEARANCES.map((option) => {
          const on = option === appearance;
          const body =
            option === 'system'
              ? t('appearance.systemBody', { scheme: t(`appearance.${scheme}` as const) })
              : t(BODY[option]);

          return (
            <PressableScale
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={t(`appearance.${option}` as const)}
              accessibilityHint={body}
              accessibilityState={{ selected: on }}
              haptic
              onPress={() => setAppearance(option)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space[3],
                minHeight: 56,
                paddingHorizontal: space[4],
                paddingVertical: space[3],
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: on ? c.borderBrand : c.borderSubtle,
                backgroundColor: on ? c.actionSubtle : c.surface1,
              }}
            >
              <Icon
                name={APPEARANCE_GLYPH[option]}
                size={19}
                color={on ? c.brand700 : c.textMuted}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text weight="semibold" size="md" color={on ? 'textLink' : 'textStrong'}>
                  {t(`appearance.${option}` as const)}
                </Text>
                <Text size="xs" color="textMuted" style={{ lineHeight: 18 }}>
                  {body}
                </Text>
              </View>
              {/* The tick is what carries the choice in greyscale; the tint
                  alone would be colour-only (design brief §7.5). */}
              {on ? <Icon name="checkCircle" size={19} color={c.brand700} /> : null}
            </PressableScale>
          );
        })}
      </View>
    </Sheet>
  );
}
