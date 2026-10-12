/**
 * Sheet — the inner scaffold every `formSheet` route renders.
 *
 * Motivated by frames X4 (workspace switcher), W4 (set housekeeping status),
 * W5 (send 201 back), W6 (report a fault), B22 (reveal contact), R1 (record a
 * payment) and R12 (pay rent). Seven sheets across five surfaces, and the frames
 * draw the same anatomy each time: a grabber, a title, a close, a body, and a
 * footer holding one primary action with its escape beside it.
 *
 * **The presentation is the route's, not this component's.** On iOS a sheet
 * route is Expo Router's `presentation: 'formSheet'`, a real
 * `UISheetPresentationController` with the detents, the drag and the dismiss
 * for free. On Android it is the frame in `sheet-route.tsx`, because the
 * platform sheet react-native-screens builds there froze the app in Expo Go
 * (2026-10-11; that file says why). Either way this draws only what goes
 * INSIDE: the route registers the sheet in `app/_layout.tsx` and renders this
 * as its body.
 *
 * **Inside Android's frame it fits its content.** The frame's panel is as tall
 * as this is, up to the space under the status bar, so the root shrinks rather
 * than fills and the body scrolls only once the content outgrows the screen.
 * Everywhere else it fills the sheet the platform sized, as it always has.
 *
 * `sheetGrabberVisible` draws the platform grabber on iOS. This draws its own
 * when `grabber` is set, for the web export and a `ModalSheet`, and always in
 * Android's frame, where the grabber and the header are what a finger pulls
 * the sheet away by — a sheet with no visible handle reads as a screen that
 * arrived sideways.
 *
 * The footer is safe-area padded here rather than in the caller: that padding
 * is what keeps a primary action clear of the home indicator, and it is exactly
 * the thing every screen gets wrong once. In Android's frame a sheet with no
 * footer pads its body the same way, because the panel reaches the bottom edge.
 */
import { type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './text';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { useSheetFrame } from './sheet-route';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';

export interface SheetProps {
  title: string;
  /** The line under the title. Frame X4's "One account · the tab bar follows your role." */
  subtitle?: string;
  /** Small right-aligned label the frames use for provenance ("Goes to Maintenance"). */
  eyebrow?: string;
  /** Draw a grabber of our own. On iOS the platform already draws one; Android's frame always gets one. */
  grabber?: boolean;
  /** Hide the close control where the only way out should be an explicit choice. */
  closable?: boolean;
  onClose?: () => void;
  /** Pinned under the body: the primary action and its escape. */
  footer?: ReactNode;
  children: ReactNode;
}

export function Sheet({
  title,
  subtitle,
  eyebrow,
  grabber = false,
  closable = true,
  onClose,
  footer,
  children,
}: SheetProps) {
  const { c, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const frame = useSheetFrame();

  const close = onClose ?? (() => router.back());
  // In Android's frame the panel slides away first, and the close runs after.
  const requestClose = frame ? () => frame.dismiss(close) : close;
  const drawGrabber = grabber || frame !== null;

  const head = (
    <>
      {drawGrabber ? (
        <View style={{ alignItems: 'center', paddingTop: 8 }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              width: 36,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: c.borderDefault,
            }}
          />
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          paddingHorizontal: space[4],
          paddingTop: drawGrabber ? 14 : space[4],
          paddingBottom: space[3],
        }}
      >
        <View style={{ flex: 1, gap: 3 }}>
          {eyebrow ? (
            <Text
              weight="bold"
              size="2xs"
              color="textMuted"
              style={{ letterSpacing: 1, textTransform: 'uppercase' }}
            >
              {eyebrow}
            </Text>
          ) : null}
          <Text
            // The sheet's title IS the page heading for a screen reader; the
            // route has no navigation header to carry it.
            accessibilityRole="header"
            family="display"
            weight="semibold"
            size="xl"
            color="textStrong"
            style={{ letterSpacing: -0.3 }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text size="sm" color="textMuted" style={{ lineHeight: 20 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {closable ? (
          <PressableScale
            accessibilityLabel={t('sheet.close')}
            onPress={requestClose}
            // Drawn at 34 with hitSlop to 44 (design brief §7.2): the visual
            // scale of a sheet header does not have to grow to clear the floor.
            hitSlop={5}
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.surface2,
            }}
          >
            <Icon name="x" size={17} color={c.textBody} />
          </PressableScale>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={{ ...(frame ? { flexShrink: 1 } : { flex: 1 }), backgroundColor: c.surface1 }}>
      {frame ? (
        <GestureDetector gesture={frame.drag}>
          <View collapsable={false}>{head}</View>
        </GestureDetector>
      ) : (
        head
      )}

      <ScrollView
        // Sized by its content inside Android's frame, so a short sheet is
        // short; it still shrinks and scrolls once the content outgrows it.
        style={frame ? { flexGrow: 0 } : undefined}
        contentContainerStyle={{
          paddingHorizontal: space[4],
          paddingBottom: space[4] + (frame && !footer ? insets.bottom : 0),
          gap: space[4],
        }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      {footer ? (
        <View
          style={{
            paddingHorizontal: space[4],
            paddingTop: 14,
            paddingBottom: insets.bottom + 14,
            gap: space[2],
            backgroundColor: c.surface1,
            borderTopWidth: 1,
            borderTopColor: c.borderSubtle,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
