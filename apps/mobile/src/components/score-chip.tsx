/**
 * ScoreChip — the guest score and the word beside it. Motivated by the Guest
 * canvas, which draws it on Explore tiles and on ListingDetail (`lib.mjs`
 * `scoreChip`).
 *
 * **The word derives from the score; it is never stored beside it** (ADR-022,
 * and `apps/web/src/lib/rating.ts`, which this mirrors). A bare "9.0" asks the
 * reader to hold a scale in their head; the word does that work, and deriving
 * it means the two can never disagree.
 *
 * The band edges follow the convention the sourced scores come from — 9.0 /
 * 8.5 / 8.0 / 7.0 — so a guest who has seen the score elsewhere reads the same
 * word here.
 *
 * `outOf` is normalised rather than assumed to be 10, for the same reason the
 * web version does it: every fixture is out of ten today, and a five-star
 * source arriving later would otherwise land every property in the bottom band
 * with no type error to warn anyone.
 */
import { View } from 'react-native';
import { Text } from './text';
import { useTheme } from '@/theme/theme';
import { useT, type MessageKey } from '@/i18n/i18n';

const BANDS: [number, MessageKey][] = [
  [9, 'score.exceptional'],
  [8.5, 'score.excellent'],
  [8, 'score.veryGood'],
  [7, 'score.good'],
];

/** The message key for a score's band. Exported so a test can assert the edges. */
export function scoreBand(score: number, outOf = 10): MessageKey {
  const outOfTen = (score / outOf) * 10;
  for (const [floor, key] of BANDS) if (outOfTen >= floor) return key;
  return 'score.pleasant';
}

export interface ScoreChipProps {
  score: number;
  outOf?: number;
  /** Overrides the derived word. Only for copy the fixtures pin by hand. */
  word?: string;
  size?: 'sm' | 'md';
}

export function ScoreChip({ score, outOf = 10, word, size = 'md' }: ScoreChipProps) {
  const { c, radius } = useTheme();
  const t = useT();
  const label = word ?? t(scoreBand(score, outOf));
  // One decimal always, so 9 and 8.5 line up in a list rather than jitter.
  const printed = score.toFixed(1);
  const md = size === 'md';

  return (
    <View
      accessible
      accessibilityLabel={t('a11y.score', { score: printed, word: label })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' }}
    >
      <View
        style={{
          minWidth: md ? 38 : 32,
          paddingVertical: md ? 4 : 3,
          paddingHorizontal: md ? 8 : 6,
          borderRadius: radius.sm,
          alignItems: 'center',
          backgroundColor: c.action,
        }}
      >
        <Text
          // `mono` is a tabular-figure intent, not a family: there is no mono
          // face here and a score column that jitters is the reason it exists.
          family="mono"
          weight="semibold"
          size={md ? 'sm' : 'xs'}
          // On an `action` fill the foreground is `bgApp`, the role that
          // inverts with it (ADR-028). `textOnBrand` is the ACCENT fill's
          // foreground and measures 1.00:1 here in the light scheme — the
          // pairing `button.tsx` already carries a comment about.
          color="bgApp"
        >
          {printed}
        </Text>
      </View>
      <Text weight="semibold" size={md ? 'sm' : 'xs'} color="textBody">
        {label}
      </Text>
    </View>
  );
}
