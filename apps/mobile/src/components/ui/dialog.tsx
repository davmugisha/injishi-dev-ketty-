import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { OnGround } from "./ground";
import type { IconName } from "./icon";
import { IconTile } from "./list";
import { Text } from "./text";
import type { Tone } from "./tone";

export type DialogProps = {
  isOpen: boolean;
  /** Called on a press outside the card, Android's back and VoiceOver's escape. */
  onClose: () => void;
  /** A large icon tile over the title, in `tone`. */
  icon?: IconName;
  tone?: Tone;
  title: string;
  body?: string;
  /** More than words: a field, a summary. */
  children?: ReactNode;
  /** The answers, stacked: the main `Button` first, then a quieter one. */
  actions: ReactNode;
  /** `false` for a question that must be answered: a press outside does nothing. */
  dismissable?: boolean;
};

/**
 * `.dialog`: a centred card over the scrim, 24 in from the sides, 24 cornered: an optional icon
 * tile, a title, a body, then the answers. React Native's `Modal`, so it stands above a sheet and
 * traps a screen reader's focus; it fades in, and appears at once under Reduce Motion.
 */
export function Dialog({
  isOpen,
  onClose,
  icon,
  tone = "accent",
  title,
  body,
  children,
  actions,
  dismissable = true,
}: DialogProps) {
  const reduceMotion = useReduceMotion();
  return (
    <Modal
      visible={isOpen}
      transparent
      animationType={reduceMotion ? "none" : "fade"}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <OnGround ground={null}>
        <View className="flex-1 justify-center px-6">
          <Pressable
            onPress={dismissable ? onClose : undefined}
            accessibilityRole="button"
            accessibilityLabel="Close"
            disabled={!dismissable}
            className="bg-backdrop"
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            onAccessibilityEscape={dismissable ? onClose : undefined}
            className="items-center gap-3 rounded-3xl bg-surface px-5 pb-4 pt-6"
          >
            {icon ? <IconTile icon={icon} tone={tone} size="lg" /> : null}
            <Text role="title3" strong accessibilityRole="header" className="text-center">
              {title}
            </Text>
            {body ? (
              <Text role="callout" tone="muted" className="text-center">
                {body}
              </Text>
            ) : null}
            {children ? <View className="self-stretch">{children}</View> : null}
            <View className="mt-1 gap-1 self-stretch">{actions}</View>
          </View>
        </View>
      </OnGround>
    </Modal>
  );
}
