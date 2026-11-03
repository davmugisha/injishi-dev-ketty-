import { rnSpace } from "@injishi/design-tokens";
import { createContext, type ReactNode, type Ref, useContext, useId, useState } from "react";
import { TextInput, type TextInputInstance, type TextInputProps, View } from "react-native";
import { useCSSVariable } from "uniwind";
import { OnGround } from "./ground";
import { Icon, type IconName } from "./icon";
import { metrics } from "./metrics";
import { roleText, Text } from "./text";

type FieldState = { label: string; hint?: string; error?: string; nativeID: string };
const FieldContext = createContext<FieldState | null>(null);

export type FieldProps = {
  /** `.field > label`: what to type, always visible. Read aloud as the input's name. */
  label: string;
  /** `.field .hint`: one quiet line under the input ("Where it is, and since when."). */
  hint?: string;
  /** `.field .err`: what is wrong. Turns the input's border and ring to danger, and is read aloud. */
  error?: string;
  /** One `Input`, `TextArea`, `OtpInput` or any control. */
  children: ReactNode;
  /** Layout only. */
  className?: string;
};

/**
 * `.field`: a label, the control, then a hint or an error, 6 apart. The `Input` or `TextArea`
 * inside takes the label as its accessible name and the hint or error as its hint, so the words
 * on screen are the words a screen reader says.
 */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const nativeID = useId();
  return (
    <FieldContext.Provider value={{ label, hint, error, nativeID }}>
      <View className={["gap-1.5", className].filter(Boolean).join(" ")}>
        <Text role="callout" strong nativeID={nativeID}>
          {label}
        </Text>
        {children}
        {error ? (
          <View className="flex-row items-center gap-1" accessibilityLiveRegion="polite">
            <Icon name="CircleExclamation" size={12} tone="danger" />
            <Text role="caption" tone="danger" className="flex-1">
              {error}
            </Text>
          </View>
        ) : hint ? (
          <Text role="caption" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
    </FieldContext.Provider>
  );
}

export type InputProps = Omit<TextInputProps, "style" | "placeholderTextColor" | "multiline"> & {
  /** An icon at the start (`Envelope`, `Magnifier`), or any small node (the `MTN` prefix chip). */
  leading?: IconName | ReactNode;
  /** At the end: an `IconButton` (clear, show password), a unit. */
  trailing?: ReactNode;
  /** Draws the error border and ring. A `Field`'s `error` sets it. */
  invalid?: boolean;
  /** The accessible name when the input is not in a `Field` (which names it). */
  label?: string;
  /** Layout only. */
  className?: string;
  ref?: Ref<TextInputInstance>;
};

/**
 * `.input`: a 52 high field on the `field` ground with a hairline, 14 in from each side; focused,
 * an accent border and a soft accent ring; invalid, the same in danger. Type is `body`, which grows
 * with the phone's font size; the field grows with it.
 */
export function Input(props: InputProps) {
  return <InputBox {...props} multiline={false} />;
}

/** `.input.area`: the same field over several lines, at least 96 high, growing with its text. */
export function TextArea(props: InputProps) {
  return <InputBox {...props} multiline />;
}

const TYPE = roleText("body");
/** One line takes no leading: iOS sets a single line's text off centre when it has one. */
const { lineHeight: _leading, ...ONE_LINE } = TYPE.style;

function InputBox({
  leading,
  trailing,
  invalid,
  label,
  className,
  multiline,
  onFocus,
  onBlur,
  editable = true,
  ref,
  ...rest
}: InputProps & { multiline: boolean }) {
  const field = useContext(FieldContext);
  const [focused, setFocused] = useState(false);
  const error = invalid ?? Boolean(field?.error);
  const [placeholder, accentSoft, dangerSoft] = useCSSVariable([
    "--color-field-placeholder",
    "--color-accent-soft",
    "--color-danger-soft",
  ]);
  const ring = error ? dangerSoft : focused ? accentSoft : undefined;
  const border = error ? "border-danger" : focused ? "border-accent" : "border-field-border";
  const lead =
    typeof leading === "string" ? (
      <View className={multiline ? "pt-0.5" : undefined}>
        <Icon name={leading as IconName} size={20} tone="muted" />
      </View>
    ) : (
      leading
    );
  return (
    <OnGround ground={null}>
      <View
        className={[
          "flex-row gap-2.5 rounded-2xl border bg-field px-3.5",
          multiline ? "items-start py-3" : "items-center",
          border,
          editable ? "" : "opacity-60",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          minHeight: multiline ? metrics.textArea : metrics.input,
          boxShadow: ring ? `0 0 0 3px ${String(ring)}` : undefined,
        }}
      >
        {lead}
        <TextInput
          ref={ref}
          {...rest}
          editable={editable}
          multiline={multiline}
          accessibilityLabel={rest.accessibilityLabel ?? label ?? field?.label}
          accessibilityLabelledBy={field && !label ? field.nativeID : undefined}
          accessibilityHint={field?.error ?? field?.hint}
          accessibilityState={{ disabled: !editable }}
          placeholderTextColor={String(placeholder)}
          maxFontSizeMultiplier={TYPE.maxFontSizeMultiplier}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          // One line stretches to the field's height, so a tap anywhere on the field lands in it.
          className={`flex-1 text-field-foreground ${multiline ? "" : "self-stretch"} ${TYPE.className}`}
          style={[
            multiline ? TYPE.style : ONE_LINE,
            // The field's own padding places the text; a TextInput's default padding would double it.
            { paddingVertical: 0, paddingHorizontal: 0, textAlignVertical: multiline ? "top" : "center" },
            multiline ? { minHeight: metrics.textArea - rnSpace[6] } : undefined,
          ]}
        />
        {trailing ? <View className={multiline ? undefined : "-mr-1.5"}>{trailing}</View> : null}
      </View>
    </OnGround>
  );
}
