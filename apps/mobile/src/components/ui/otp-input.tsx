import { type Ref, useState } from "react";
import { TextInput, type TextInputInstance, View } from "react-native";
import { useCSSVariable } from "uniwind";
import { metrics } from "./metrics";
import { Text } from "./text";

export type OtpInputProps = {
  /** The digits typed so far. */
  value: string;
  onChange: (value: string) => void;
  /** Called once every box is filled. */
  onComplete?: (value: string) => void;
  /** How many digits. Default 6. */
  length?: number;
  autoFocus?: boolean;
  /** Draws every box in danger: the code was wrong. */
  invalid?: boolean;
  /** Read aloud. Default "Code, 6 digits". */
  label?: string;
  ref?: Ref<TextInputInstance>;
};

/**
 * `.otp`: one box per digit, 8 apart, 56 high, the next box to fill in the accent with its soft
 * ring. One real text field lies over the boxes, invisible, so the keyboard, paste, the SMS code
 * suggestion (iOS `oneTimeCode`, Android `sms-otp`) and a screen reader all meet a single field.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  autoFocus,
  invalid = false,
  label,
  ref,
}: OtpInputProps) {
  const [focused, setFocused] = useState(Boolean(autoFocus));
  const [accentSoft, dangerSoft] = useCSSVariable(["--color-accent-soft", "--color-danger-soft"]);
  const digits = value.slice(0, length).split("");
  const active = Math.min(digits.length, length - 1);
  return (
    <View className="relative">
      {/* The boxes only draw; the field over them is what a screen reader meets. */}
      <View className="flex-row gap-2" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {Array.from({ length }, (_, i) => {
          const on = focused && i === active && !invalid;
          const ring = invalid ? dangerSoft : on ? accentSoft : undefined;
          return (
            <View
              // A box is a position, not an item: its index is its identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions
              key={i}
              className={`flex-1 items-center justify-center rounded-2xl border bg-field ${invalid ? "border-danger" : on ? "border-accent" : "border-field-border"}`}
              style={{ minHeight: metrics.otpBox, boxShadow: ring ? `0 0 0 3px ${String(ring)}` : undefined }}
            >
              <Text role="title1" tabular maxScale={1.5}>
                {digits[i] ?? ""}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(text) => {
          const next = text.replace(/\D/g, "").slice(0, length);
          onChange(next);
          if (next.length === length) onComplete?.(next);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        caretHidden
        accessibilityLabel={label ?? `Code, ${length} digits`}
        accessibilityHint={invalid ? "The code was not right" : undefined}
        // Invisible but present and on top: a tap on any box lands in the field.
        className="absolute inset-0 text-transparent"
        style={{ opacity: HIDDEN }}
      />
    </View>
  );
}

/** Near zero, not zero: some Android builds refuse focus to a fully transparent field. */
const HIDDEN = 0.011;
