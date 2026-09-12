/**
 * The full-screen photo viewer behind a tap on the gallery.
 *
 * **A `Modal`, not a route.** `app/_layout.tsx` registers every route in the
 * prototype and is frozen until Session 11, so a new `listing/[id]/gallery`
 * route would either mean editing a frozen file or shipping a screen with
 * whatever default presentation the navigator gives an unregistered path. A
 * viewer is also better as an overlay than as a push: it opens over the page it
 * came from, keeps the scroll position underneath, and closes back to exactly
 * where the guest was.
 *
 * Two things it does that the inline gallery cannot:
 *
 *   - **`contentFit="contain"`.** The header crops to fill a 4:3 frame, which
 *     is right for a hero and wrong for looking at a photograph. Here the whole
 *     frame is shown, letterboxed.
 *   - **It opens on the photograph the guest tapped**, not on the first one.
 *
 * The ground is ink at the caption scrim's alpha rather than a palette
 * surface. A photograph does not invert with the scheme, so what is drawn
 * around and on it must not either (design brief §8.7, ADR-028) — a viewer
 * built on `surface1` would go white in the light scheme and take the white
 * counter with it. `onPhoto` is the fixed foreground that ground carries.
 *
 * The credit travels here too. ADR-015 call 5 says "where it appears", and
 * full screen is where a stand-in photograph is most likely to be mistaken for
 * the property.
 */
import { useCallback, useState } from 'react';
import { Modal, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, PhotoCredit, PressableScale, Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { useReducedMotion } from '@/motion';
import { photo as photoAsset } from '@/data/photos';

export interface ListingPhotoViewerProps {
  stems: readonly string[];
  /** The photograph the guest tapped. Null closes the viewer. */
  openAt: number | null;
  onClose: () => void;
}

export function ListingPhotoViewer({ stems, openAt, onClose }: ListingPhotoViewerProps) {
  const { width, height } = useWindowDimensions();
  const { radius, space, scrim, onPhoto } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useT();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);

  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      if (next >= 0 && next < stems.length) setIndex(next);
    },
    [stems.length, width],
  );

  const open = openAt !== null;
  const start = openAt ?? 0;
  const current = stems[index] ?? stems[start] ?? '';

  return (
    <Modal
      visible={open}
      transparent
      // Reduced motion drops the travel and keeps the change of state, which is
      // what `fade` is: the same transition with the slide taken out.
      animationType={reduced ? 'fade' : 'slide'}
      onRequestClose={onClose}
      // Remounts the scroller when the viewer opens, so `contentOffset` below
      // lands on the photograph the guest tapped rather than the first one.
      key={open ? `viewer-${start}` : 'viewer-closed'}
      supportedOrientations={['portrait', 'landscape']}
    >
      <View style={{ flex: 1, backgroundColor: scrim.caption[1] }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: start * width, y: 0 }}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {stems.map((stem, i) => (
            <View
              key={`${stem}-${i}`}
              style={{ width, height, alignItems: 'center', justifyContent: 'center' }}
            >
              <Image
                source={photoAsset(stem)?.source}
                placeholder={photoAsset(stem)?.placeholder}
                contentFit="contain"
                transition={reduced ? 0 : 160}
                style={{ width, height: height * 0.72 }}
                // The counter and the credit below carry the meaning; two
                // announcements of the same photograph is worse than one.
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            </View>
          ))}
        </ScrollView>

        <View
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: space[4],
            right: space[4],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space[3],
          }}
        >
          <PressableScale
            accessibilityLabel={t('listing.viewerClose')}
            onPress={onClose}
            hitSlop={5}
            testID="viewer-close"
            style={{
              width: 38,
              height: 38,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: scrim.caption[0],
            }}
          >
            <Icon name="x" size={19} color={onPhoto} />
          </PressableScale>

          <View
            accessible
            accessibilityRole="text"
            accessibilityLabel={t('listing.viewerCounter', {
              index: index + 1,
              total: stems.length,
            })}
            style={{
              paddingVertical: 5,
              paddingHorizontal: 12,
              borderRadius: radius.pill,
              backgroundColor: scrim.caption[0],
            }}
          >
            <Text family="mono" weight="semibold" size="xs" color={onPhoto}>
              {`${index + 1} / ${stems.length}`}
            </Text>
          </View>
        </View>

        <View
          style={{
            position: 'absolute',
            left: space[4],
            right: space[4],
            bottom: insets.bottom + space[4],
          }}
        >
          <PhotoCredit stem={current} placement="over" />
        </View>
      </View>
    </Modal>
  );
}
