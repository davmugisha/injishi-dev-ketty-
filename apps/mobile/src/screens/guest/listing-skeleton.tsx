/**
 * The Property detail page while the read is in flight.
 *
 * `SkeletonList` is the placeholder for a list of identical rows, and this page
 * is not one — a list skeleton over a photographic header would tell the reader
 * the wrong shape is coming. So it mirrors the page's own blocks: the header
 * frame, the title, the score band, and two room cards.
 *
 * One accessibility node for the whole page, saying what is loading. Fifteen
 * anonymous grey rectangles announced one by one is worse than silence.
 */
import { View, useWindowDimensions } from 'react-native';
import { BackHeader, Skeleton } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';

export function ListingSkeleton() {
  const { c, radius, space } = useTheme();
  const { width } = useWindowDimensions();
  const t = useT();

  return (
    <View style={{ flex: 1, backgroundColor: c.bgApp }}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('listing.loading')}
      >
        {/* The header frame, at the 4:3 the gallery uses, so the page does not
            jump height when the photographs land. */}
        <Skeleton width="100%" height={Math.round((width / 4) * 3)} radius={0} />

        <View style={{ padding: space[4], gap: space[4] }}>
          <View style={{ gap: 10 }}>
            <Skeleton width="72%" height={24} />
            <Skeleton width="48%" height={14} />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Skeleton width={44} height={26} radius={radius.sm} />
            <Skeleton width="42%" height={14} />
          </View>

          <View style={{ gap: 8 }}>
            <Skeleton width="100%" height={13} />
            <Skeleton width="94%" height={13} />
            <Skeleton width="66%" height={13} />
          </View>

          {[0, 1].map((i) => (
            <View
              key={i}
              style={{
                gap: 12,
                padding: space[4],
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: c.borderSubtle,
                backgroundColor: c.surface1,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Skeleton width="46%" height={18} />
                <Skeleton width={78} height={22} radius={radius.pill} />
              </View>
              <Skeleton width="70%" height={13} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Skeleton width={116} height={17} />
                <Skeleton width={84} height={13} />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* The way back stays live while the page loads. A screen that cannot be
          left until it has finished reading is a screen that traps a guest on
          a slow connection. */}
      <BackHeader overlay />
    </View>
  );
}
