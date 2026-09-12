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
 */
import { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Text } from './text';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme';

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
    backgroundColor: variant === 'tint' ? c.elevate1 : c.surface1,
    borderWidth: 1,
    borderColor: variant === 'tint' ? 'transparent' : c.borderSubtle,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...(variant === 'flat' ? null : shadow.sm),
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
            gap: 12,
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: children ? 0 : 18,
          }}
        >
          <View style={{ flexShrink: 1, gap: 2 }}>
            {title ? (
              <Text family="display" weight="medium" size="xl" color="textStrong" style={{ lineHeight: 24 }}>
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
      {children ? <View style={[{ padding: 18 }, bodyStyle]}>{children}</View> : null}
      {footer ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingHorizontal: 18,
            paddingVertical: 14,
            borderTopWidth: 1,
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
      onPress={onPress}
      style={[container, style]}
    >
      {body}
    </PressableScale>
  );
}
