/**
 * InputField and TextArea — label above, helper below, error state, and a
 * prefix segment for the phone field.
 *
 * Motivated by frames X1 (the two-part phone field, "RW +250" beside the
 * number), X3, R6, R17, R18, R20 and W6 — every form in the pack. The prefix
 * segment is the reason this is a component rather than a styled `TextInput`:
 * frame X1 draws the country code as part of the field, not as a picker beside
 * it, and getting that seam right once is worth more than getting it wrong in
 * four places.
 *
 * Four rules it enforces:
 *
 *   - **The field's edge is `borderStrong`, never `borderDefault`.** A control
 *     boundary owes 3:1 (WCAG 1.4.11); `borderDefault` measures 1.12:1 and is a
 *     decorative hairline. Design brief §7.4 is explicit: never draw a field's
 *     edge in `--border`.
 *   - **An error is a word, never a colour.** The message renders under the
 *     field and is announced; the red edge is the second signal, not the only
 *     one (design brief §7.5).
 *   - **The label is bound to the input**, so a reader hears "Phone number,
 *     text field" rather than two unrelated nodes.
 *   - **48pt tall**, above the 44 floor, because a field is aimed at while
 *     typing rather than tapped once.
 */
import { useState, type ReactNode } from 'react';
import { TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';
import { Text } from './text';
import { useTheme } from '@/theme/theme';
import { fontSize, lineHeight } from '@/theme/tokens';

export interface InputFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Under the field in muted. Frame X1's "Nine digits after the country code". */
  helper?: string;
  /** Replaces the helper, tints the edge, and is announced. */
  error?: string;
  /** The segment inside the left of the field. Frame X1's "RW +250". */
  prefix?: string;
  /** Anything on the right inside the field: a unit, a clear control. */
  suffix?: ReactNode;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  /**
   * Off for anything that is not prose. An autocorrected email address is a
   * wrong email address, and the person cannot see it happen.
   */
  autoCorrect?: boolean;
  /**
   * What the platform's own autofill should offer here — `emailAddress`,
   * `oneTimeCode`, and so on. iOS reads this; Android reads `autoComplete`,
   * which is why a field that wants saved-address autofill sets both.
   */
  textContentType?: TextInputProps['textContentType'];
  /**
   * Told when the field loses focus.
   *
   * ADR-038 child 1b needs this: the email field's error state is reachable
   * ONLY from blur, because an address is invalid for almost all of the time it
   * takes to type one, and a field that turns red at `r`, `ra`, `ray` has told
   * the person nothing and shouted at them nine times.
   */
  onBlur?: () => void;
  maxLength?: number;
  editable?: boolean;
  testID?: string;
}

const FIELD_HEIGHT = 48;

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  helper,
  error,
  prefix,
  suffix,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  autoCorrect,
  textContentType,
  onBlur,
  maxLength,
  editable = true,
  testID,
}: InputFieldProps) {
  const { c, space, radius, font } = useTheme();
  const [focused, setFocused] = useState(false);

  const edge = error ? c.danger500 : focused ? c.focusRing : c.borderStrong;

  return (
    <View style={{ gap: 6 }}>
      <Text weight="medium" size="sm" color="textBody">
        {label}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'stretch',
          height: FIELD_HEIGHT,
          borderRadius: radius.md,
          borderWidth: focused || error ? 1.5 : 1,
          borderColor: edge,
          backgroundColor: editable ? c.surface1 : c.surface2,
          overflow: 'hidden',
        }}
      >
        {prefix ? (
          <View
            // Read as part of the field's value, not as a separate control:
            // it is not tappable and must not sound like it is.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              justifyContent: 'center',
              paddingHorizontal: space[3],
              backgroundColor: c.surface2,
              borderRightWidth: 1,
              borderRightColor: c.borderSubtle,
            }}
          >
            <Text weight="semibold" size="sm" color="textBody">
              {prefix}
            </Text>
          </View>
        ) : null}

        <TextInput
          accessibilityLabel={prefix ? `${label}, ${prefix}` : label}
          accessibilityHint={error ?? helper}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          placeholder={placeholder}
          placeholderTextColor={c.textSubtle}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          textContentType={textContentType}
          maxLength={maxLength}
          editable={editable}
          testID={testID}
          style={{
            flex: 1,
            paddingHorizontal: space[3],
            // RN has no font cascade, so the field resolves its own face AND
            // its step the same way `Text` does. Without the family it renders
            // in the system font; without the pair it renders off-scale, which
            // is the failure the type rule exists to catch. A `TextInput` is
            // not a `Text`, so it reads the tokens directly.
            fontFamily: font.body,
            fontSize: fontSize.md,
            lineHeight: lineHeight.md,
            color: c.textStrong,
          }}
        />

        {suffix ? (
          <View style={{ justifyContent: 'center', paddingRight: space[3] }}>{suffix}</View>
        ) : null}
      </View>

      {error ? (
        <Text accessibilityRole="alert" size="xs" color="danger600">
          {error}
        </Text>
      ) : helper ? (
        <Text size="xs" color="textMuted">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

export interface TextAreaProps
  extends Omit<InputFieldProps, 'prefix' | 'suffix' | 'keyboardType'> {
  /** Visible lines before it scrolls. Frames R17 and R18 draw four. */
  rows?: number;
}

export function TextArea({
  label,
  value,
  onChangeText,
  placeholder,
  helper,
  error,
  autoCapitalize = 'sentences',
  maxLength,
  editable = true,
  rows = 4,
  testID,
}: TextAreaProps) {
  const { c, space, radius, font } = useTheme();
  const [focused, setFocused] = useState(false);
  const edge = error ? c.danger500 : focused ? c.focusRing : c.borderStrong;

  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text weight="medium" size="sm" color="textBody">
          {label}
        </Text>
        {maxLength ? (
          <Text family="mono" size="xs" color="textMuted">
            {`${value.length} / ${maxLength}`}
          </Text>
        ) : null}
      </View>

      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? helper}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={c.textSubtle}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        editable={editable}
        multiline
        textAlignVertical="top"
        testID={testID}
        style={{
          minHeight: 22 * rows + space[4],
          padding: space[3],
          borderRadius: radius.md,
          borderWidth: focused || error ? 1.5 : 1,
          borderColor: edge,
          backgroundColor: editable ? c.surface1 : c.surface2,
          fontFamily: font.body,
          fontSize: fontSize.md,
          lineHeight: lineHeight.md,
          color: c.textStrong,
        }}
      />

      {error ? (
        <Text accessibilityRole="alert" size="xs" color="danger600">
          {error}
        </Text>
      ) : helper ? (
        <Text size="xs" color="textMuted">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
