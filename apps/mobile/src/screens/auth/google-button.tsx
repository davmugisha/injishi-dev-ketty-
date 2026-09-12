/**
 * "Sign in with Google" — the second half of frame X1's interactive twin, and
 * of FL03 step 2, which offers email-OTP or Google and treats them as one
 * identity once the address matches (F-S01, "Path A: same email via OTP and
 * Google merges to one User").
 *
 * It is drawn and it is honest about not being wired: tapping it toasts rather
 * than doing nothing. A federated button that swallows a tap is the orphaned
 * control the quality bar rules out, and a prototype that silently ignores the
 * second sign-in route is one a reviewer files a bug against.
 *
 * It is not `Button`. `Button` resolves its label colour from a variant map and
 * takes its leading glyph from the Feather `Icon` set, and Google's mark is
 * neither a Feather glyph nor recolourable — Google's brand terms require the
 * four-colour G as supplied. So the mark is an asset and the shell is a
 * `PressableScale` drawn to `Button`'s `secondary` anatomy: 48 tall, `surface1`
 * on a `borderDefault` hairline, semibold 16.
 */
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Text, PressableScale } from '@/components';
import { useTheme } from '@/theme/theme';

const GOOGLE_G = require('../../../assets/brand/google-g.svg');

export function GoogleButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { c, radius } = useTheme();

  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        // 48, so it clears the 44pt floor on its own like `Button` size lg.
        height: 48,
        borderRadius: radius.md,
        backgroundColor: c.surface1,
        borderWidth: 1,
        borderColor: c.borderDefault,
      }}
    >
      <Image
        source={GOOGLE_G}
        contentFit="contain"
        style={{ width: 18, height: 18 }}
        // The label already says Google; the mark repeating it is one stop of
        // noise for a reader.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text weight="semibold" size="md" color="textStrong">
        {label}
      </Text>
    </PressableScale>
  );
}
