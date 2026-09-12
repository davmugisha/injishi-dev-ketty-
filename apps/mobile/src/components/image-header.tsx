/**
 * ImageHeader and Gallery — the photographic top of a detail screen.
 *
 * Motivated by the Guest canvas ListingDetail and TripDetail artboards, and by
 * frames R11, R15 and B22, which all open the same way: a full-bleed
 * photograph, a floating back control, and the first fact sitting on the
 * picture rather than under it.
 *
 * Three things it owns so a screen cannot get them wrong:
 *
 *   - **The scrim is the design brief's, and it anchors to the caption.** §6.3
 *     is the load-bearing part: a frame gradient has to guess where the text
 *     will be, and on these headers the text moves — a property name that wraps
 *     to two lines lifts everything under it. So the plate is a box behind the
 *     caption block that grows with it, with `captionFade` hung off its top
 *     edge. `hero` is used only when there is no caption block to anchor to.
 *   - **The credit travels with the photograph** (ADR-015 call 5). `PhotoCredit`
 *     is rendered here, not by the caller, so a header cannot ship without one.
 *   - **The photograph is decorative only when the caption already says what it
 *     shows.** With a caption the image is hidden from assistive tech and the
 *     caption carries the meaning; without one it takes the subject as its
 *     label. Two identical announcements is worse than one.
 *
 * `expo-image` rather than RN's `Image`: it paints the sampled placeholder
 * while the file decodes, so a header fills with the photograph's own tone
 * instead of flashing the canvas colour.
 */
import { type ReactNode, useCallback, useState } from 'react';
import { View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ScrollView } from 'react-native-gesture-handler';
import { Text } from './text';
import { BackHeader } from './back-header';
import { PhotoCredit } from './photo-credit';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';
import { photo as photoAsset } from '@/data/photos';
import { creditFor } from '@/data/photo-credits';
import { useReducedMotion, MOTION_MS } from '@/motion';

/** The canvas draws its detail heroes at roughly 4:3. */
const HERO_RATIO = 4 / 3;

interface FrameProps {
  /** Photo stem. Every stem has a licence row; see `@/data/photo-credits`. */
  stem: string;
  height: number;
  /** Drawn over the scrim at the foot of the frame. */
  caption?: ReactNode;
  /** Top-right slot: a heart, a share, a page counter. */
  right?: ReactNode;
  /** `false` on a nested frame that already sits under a header. */
  back?: boolean;
}

/**
 * One photograph with its scrim, its credit and its caption. Exported because
 * both `ImageHeader` and `Gallery` draw exactly this.
 */
function PhotoFrame({ stem, height, caption, right, back = true }: FrameProps) {
  const { scrim, space } = useTheme();
  const t = useT();
  const asset = photoAsset(stem);
  const credit = creditFor(stem);
  const [captionHeight, setCaptionHeight] = useState(0);

  const onCaptionLayout = useCallback((e: LayoutChangeEvent) => {
    setCaptionHeight(e.nativeEvent.layout.height);
  }, []);

  // The fade is hung off the plate's top edge and is half the plate's height,
  // which is what carries the plate back into the photograph rather than
  // ending it on a line.
  const fadeHeight = Math.max(24, Math.round(captionHeight * 0.6));
  const described = !caption && credit ? t('a11y.photoOf', { subject: credit.subject }) : undefined;

  return (
    <View style={{ width: '100%', height }}>
      <Image
        source={asset?.source}
        // Data, not a token: the photograph's own average colour, sampled at
        // import so the frame fills with its tone instead of flashing.
        placeholder={asset?.placeholder}
        contentFit="cover"
        transition={200}
        style={{ width: '100%', height }}
        // With a caption the words carry the meaning and the picture is
        // decoration; with none, the subject is the only description there is.
        accessible={!!described}
        accessibilityLabel={described}
        accessibilityElementsHidden={!described}
        importantForAccessibility={described ? 'yes' : 'no-hide-descendants'}
      />

      {caption ? (
        <>
          <LinearGradient
            colors={scrim.captionFade}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: captionHeight,
              height: fadeHeight,
            }}
          />
          <LinearGradient
            colors={scrim.caption}
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: captionHeight }}
          />
        </>
      ) : (
        // Nothing to anchor to, so the inherited full-frame wash. It is the
        // page-hero value NAMED, not measured — see the token's own comment.
        <LinearGradient
          colors={scrim.hero}
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
      )}

      <View
        onLayout={onCaptionLayout}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: space[4],
          paddingBottom: space[4],
          paddingTop: space[3],
          gap: space[2],
        }}
      >
        {caption}
        <PhotoCredit stem={stem} placement="over" />
      </View>

      {back ? <BackHeader overlay /> : null}
      {right ? <TopRight>{right}</TopRight> : null}
    </View>
  );
}

function TopRight({ children }: { children: ReactNode }) {
  const { space } = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        top: space[4] + 30,
        right: 14,
        zIndex: 30,
        flexDirection: 'row',
        gap: space[2],
      }}
    >
      {children}
    </View>
  );
}

export interface ImageHeaderProps {
  stem: string;
  caption?: ReactNode;
  right?: ReactNode;
  /** Defaults to a 4:3 frame across the viewport. */
  height?: number;
}

export function ImageHeader({ stem, caption, right, height }: ImageHeaderProps) {
  const { width } = useWindowDimensions();
  return (
    <PhotoFrame stem={stem} height={height ?? Math.round(width / HERO_RATIO)} caption={caption} right={right} />
  );
}

export interface GalleryProps {
  /** Cover first, then the rest. */
  stems: readonly string[];
  caption?: ReactNode;
  right?: ReactNode;
  height?: number;
  /** Opens a full-screen viewer. Session 3 routes it; without it the tap is off. */
  onOpen?: (index: number) => void;
}

/**
 * Horizontal paging with a counter, and a tap that opens the full-screen
 * viewer. Paging rather than a carousel with peeking neighbours: the canvas
 * draws one photograph edge to edge, and a peek turns a hero into a filmstrip.
 */
export function Gallery({ stems, caption, right, height, onOpen }: GalleryProps) {
  const { width } = useWindowDimensions();
  const { space, radius, onPhoto, onPhotoDim, scrim } = useTheme();
  const t = useT();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const frameHeight = height ?? Math.round(width / HERO_RATIO);
  const counter = useSharedValue(1);

  const onScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      if (next !== index && next >= 0 && next < stems.length) {
        setIndex(next);
        // A tick of feedback that the page changed, dropped under reduced
        // motion the same way every other travel is.
        counter.set(0);
        counter.set(withTiming(1, { duration: reduced ? 1 : MOTION_MS / 2 }));
      }
    },
    [index, stems.length, width, counter, reduced],
  );

  const counterStyle = useAnimatedStyle(() => ({ opacity: 0.6 + counter.get() * 0.4 }));

  if (stems.length <= 1) {
    return <ImageHeader stem={stems[0] ?? ''} caption={caption} right={right} height={frameHeight} />;
  }

  return (
    <View style={{ width: '100%', height: frameHeight }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        accessibilityLabel={t('a11y.pageOf', { index: index + 1, total: stems.length })}
      >
        {stems.map((stem, i) => (
          <PressableScale
            key={stem + i}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('a11y.openGallery')}
            disabled={!onOpen}
            onPress={() => onOpen?.(i)}
            style={{ width, height: frameHeight }}
          >
            {/* Only the visible page draws the caption block; the others are
                the same photograph without the words on top of it. */}
            <PhotoFrame
              stem={stem}
              height={frameHeight}
              caption={i === index ? caption : undefined}
              back={false}
            />
          </PressableScale>
        ))}
      </ScrollView>

      <BackHeader overlay />
      {right ? <TopRight>{right}</TopRight> : null}

      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            right: space[4],
            bottom: space[4],
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: radius.pill,
            backgroundColor: scrim.caption[1],
          },
          counterStyle,
        ]}
      >
        <Text family="mono" weight="semibold" size="xs" color={onPhoto}>
          {`${index + 1} / ${stems.length}`}
        </Text>
      </Animated.View>

      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: space[4] + 2,
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 5,
        }}
      >
        {stems.map((stem, i) => (
          <View
            key={`dot-${stem}-${i}`}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === index ? onPhoto : onPhotoDim,
            }}
          />
        ))}
      </View>
    </View>
  );
}
