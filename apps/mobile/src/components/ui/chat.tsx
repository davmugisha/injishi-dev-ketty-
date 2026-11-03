import { rnSpace } from "@injishi/design-tokens";
import type { ReactNode, Ref } from "react";
import { TextInput, type TextInputInstance, View } from "react-native";
import { useCSSVariable } from "uniwind";
import { OnGround } from "./ground";
import { Icon } from "./icon";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { useBottomInset } from "./screen";
import { roleText, Text } from "./text";
import { solidGround } from "./tone";

export type BubbleProps = {
  /** `me` on the accent at the end, `them` on the surface at the start. */
  from: "me" | "them";
  /** The message. */
  text: string;
  /** `.bubble small`: when ("09:48"), and for `me` its state ("Read"). */
  time?: string;
  /** Who, above a `them` bubble in a group thread ("Front desk"). */
  author?: string;
};

/**
 * `.bubble`: one message, at most 78% of the width, 16 cornered with the corner by its sender
 * tucked to 6. Mine are the accent fill with its light words; theirs the surface with a hairline.
 * A screen reader hears who, what and when.
 */
export function Bubble({ from, text, time, author }: BubbleProps) {
  const mine = from === "me";
  return (
    <View
      accessible
      accessibilityLabel={[mine ? "You" : (author ?? "Them"), text, time].filter(Boolean).join(", ")}
      className={mine ? "items-end" : "items-start"}
    >
      {author && !mine ? (
        <Text role="caption" tone="muted" className="mb-1 ml-3">
          {author}
        </Text>
      ) : null}
      <OnGround ground={mine ? solidGround("accent") : null}>
        <View
          className={`rounded-2xl px-3.5 py-2.5 ${mine ? "rounded-br-md bg-accent" : "rounded-bl-md border border-separator bg-surface"}`}
          style={{ maxWidth: "78%" }}
        >
          <Text role="body">{text}</Text>
          {time ? (
            <Text role="caption" tone="muted" className={`mt-1 ${mine ? "text-right" : ""}`}>
              {time}
            </Text>
          ) : null}
        </View>
      </OnGround>
    </View>
  );
}

export type ComposerProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  /** Default "Message". */
  placeholder?: string;
  /** Before the field: an attach `IconButton`. */
  leading?: ReactNode;
  /** While a message is on its way: the send button waits. */
  isSending?: boolean;
  ref?: Ref<TextInputInstance>;
};

const TYPE = roleText("body");

/**
 * `.composer`: the message bar at the foot of a thread, on the surface with a hairline above: an
 * optional attach button, a pill field that grows to four lines, and a send button in the accent
 * that wakes once there is something to send. Use it as `Screen`'s `footer`, which lifts it with
 * the keyboard; it pads itself clear of the home indicator.
 */
export function Composer({
  value,
  onChangeText,
  onSend,
  placeholder = "Message",
  leading,
  isSending = false,
  ref,
}: ComposerProps) {
  const bottom = useBottomInset();
  const placeholderColor = useCSSVariable("--color-field-placeholder");
  const canSend = value.trim().length > 0 && !isSending;
  return (
    <OnGround ground={null}>
      <View
        className="flex-row items-end gap-2 border-t border-separator bg-surface px-3 pt-2.5"
        style={{ paddingBottom: bottom + rnSpace[2] }}
      >
        {leading}
        <View
          className="flex-1 justify-center rounded-3xl border border-field-border bg-field px-4 py-2"
          style={{ minHeight: metrics.composerInput }}
        >
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={String(placeholderColor)}
            multiline
            accessibilityLabel={placeholder}
            maxFontSizeMultiplier={TYPE.maxFontSizeMultiplier}
            className={`text-field-foreground ${TYPE.className}`}
            style={[
              TYPE.style,
              { paddingVertical: 0, paddingHorizontal: 0, maxHeight: TYPE.style.lineHeight * MAX_LINES },
            ]}
          />
        </View>
        <PressArea
          onPress={onSend}
          isDisabled={!canSend}
          accessibilityLabel="Send"
          className="items-center justify-center"
        >
          <View
            className={`items-center justify-center rounded-full ${canSend ? "bg-accent" : "bg-default"}`}
            style={{ width: metrics.iconButton, height: metrics.iconButton }}
          >
            <Icon name="PaperPlane" size={20} tone={canSend ? "onAccent" : "muted"} />
          </View>
        </PressArea>
      </View>
    </OnGround>
  );
}

/** The field grows to this many lines, then scrolls. */
const MAX_LINES = 4;
