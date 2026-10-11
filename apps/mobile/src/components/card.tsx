/**
 * Card — surface container with optional header (title/subtitle/action), body
 * and footer. The base panel building block. Port of the DS Card.
 *
 * **A pressable Card answers the finger** (Session 11's motion pass). It used a
 * bare `Pressable` with no feedback at all, which made it the largest tap
 * target in the app and the only one that did not move when pressed — a stay on
 * Explore, a unit in the Directory, a trip in Trips. `PressableScale` owns the
 * whole decision (scale to 0.98 on press-IN, reduced motion drops the travel and
 * keeps the opacity), so this delegates rather than growing a second copy.
 *
 * No haptic: a card is navigation, and the prompt pack reserves the buzz for a
 * primary action that commits something. A buzz on every card in a list is what
 * makes people turn haptics off system-wide.
 *
 * **HeroUI's surface (ADR-064 AC-7).** Corner `lg` (24), inset 16, `surface1`,
 * and no border: the hairline is gone, and the soft three layer `surface`
 * shadow does the separating in light. In dark it draws nothing, because depth
 * there is the surface step (ADR-019); the theme decides that, not this file.
 * `flat` casts no shadow and `tint` fills `surface2` and casts none.
 */
import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Text } from './text';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';
import { kitMetrics } from '@/theme/tokens';

const { card } = kitMetrics;

export interface CardProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  footer?: ReactNode;
  media?: ReactNode;
  variant?: 'default' | 'flat' | 'tint';
  onPress?: () => void;
  accessibilityLabel?: string;
  bodyStyle?: ViewStyle;
  style?: ViewStyle;
  children?: ReactNode;
}

export function Card({
  title,
  subtitle,
  action,
  footer,
  media,
  variant = 'default',
  onPress,
  accessibilityLabel,
  bodyStyle,
  style,
  children,
}: CardProps) {
  const { c, radius, shadow } = useTheme();
  const hasHeader = title || subtitle || action;

  const container: ViewStyle = {
    backgroundColor: variant === 'tint' ? c.surface2 : c.surface1,
    borderRadius: radius.lg,
    // Clips `media` to the corner. The shadow is the card's own and is not cut.
    overflow: 'hidden',
    ...(variant === 'default' ? shadow.surface : null),
  };

  const body = (
    <>
      {media}
      {hasHeader ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: card.gap,
            paddingHorizontal: card.inset,
            paddingTop: card.inset,
            paddingBottom: children ? 0 : card.inset,
          }}
        >
          <View style={{ flexShrink: 1, gap: card.titleGap }}>
            {title ? (
              // HeroUI's title size and weight in our display face, on the
              // step's own leading rather than a typed one.
              <Text family="display" weight="medium" size="lg" color="textBody">
                {title}
              </Text>
            ) : null}
            {subtitle ? (
              <Text size="sm" color="textMuted">
                {subtitle}
              </Text>
            ) : null}
          </View>
          {action}
        </View>
      ) : null}
      {children ? <View style={[{ padding: card.inset }, bodyStyle]}>{children}</View> : null}
      {footer ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: card.gap,
            paddingHorizontal: card.inset,
            paddingVertical: card.footerInsetY,
            borderTopWidth: kitMetrics.hairline,
            borderTopColor: c.borderSubtle,
            backgroundColor: c.surface2,
          }}
        >
          {footer}
        </View>
      ) : null}
    </>
  );

  // A card with no `onPress` is not a button and does not claim to be: no
  // press feedback, and nothing announced to a reader that it can activate.
  if (!onPress) return <View style={[container, style]}>{body}</View>;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title ?? ''}
      filled
      onPress={onPress}
      style={[container, style]}
    >
      {body}
    </PressableScale>
  );
}
