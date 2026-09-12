/**
 * Sheet — the inner scaffold every `formSheet` route renders.
 *
 * Motivated by frames X4 (workspace switcher), W4 (set housekeeping status),
 * W5 (send 201 back), W6 (report a fault), B22 (reveal contact), R1 (record a
 * payment) and R12 (pay rent). Seven sheets across five surfaces, and the frames
 * draw the same anatomy each time: a grabber, a title, a close, a body, and a
 * footer holding one primary action with its escape beside it.
 *
 * **The presentation is the route's, not this component's.** Expo Router's
 * `presentation: 'formSheet'` gives a real `UISheetPresentationController` on
 * iOS and the platform's own sheet on Android, with the detents, the drag and
 * the dismiss for free. Rebuilding that in JS would be worse in every way, so
 * this draws only what goes INSIDE it: the route registers the sheet in
 * `app/_layout.tsx` and renders this as its body.
 *
 * `sheetGrabberVisible` draws the platform grabber on iOS. This draws its own
 * as well only when `grabber` is set, for Android and for the web export, where
 * the native one does not exist — a sheet with no visible handle reads as a
 * screen that arrived sideways.
 *
 * The footer is safe-area padded here rather than in the caller: that padding
 * is what keeps a primary action clear of the home indicator, and it is exactly
 * the thing every screen gets wrong once.
 */
import { type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './text';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import { useT } from '@/i18n/i18n';

export interface SheetProps {
  title: string;
  /** The line under the title. Frame X4's "One account · the tab bar follows your role." */
  subtitle?: string;
  /** Small right-aligned label the frames use for provenance ("Goes to Maintenance"). */
  eyebrow?: string;
  /** Draw a grabber of our own. On iOS the platform already draws one. */
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

  const close = onClose ?? (() => router.back());

  return (
    <View style={{ flex: 1, backgroundColor: c.surface1 }}>
      {grabber ? (
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
          paddingTop: grabber ? 14 : space[4],
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
            onPress={close}
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

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[4],
          paddingBottom: space[4],
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
