/**
 * The six-digit code row: one input, six drawn boxes.
 *
 * Lifted out of `verify-otp.tsx` by ADR-038 child 0 task 10, which asked the
 * step-up screen to reuse this input rather than draw a second one. Two OTP
 * rows in one app is how they come to disagree about the paste case, the
 * autofill affordance and the reduced-motion branch — all three of which are
 * subtle enough that the second copy would get one of them wrong and nobody
 * would notice until somebody could not sign in.
 *
 * ## One input, six boxes
 *
 * The six boxes are DRAWN; they are not six `TextInput`s. A single hidden
 * field stretched across the row holds the whole code, and each box renders one
 * character of it. That is not a shortcut, it is the only version that gets
 * three things right at once:
 *
 *   - **Paste fills all six.** Six separate fields each take one character and
 *     drop the rest, so a pasted or autofilled `123456` lands as `1`.
 *   - **iOS and Android autofill work.** `textContentType="oneTimeCode"` and
 *     `autoComplete="one-time-code"` hand the code straight from the message to
 *     one field. There is no such affordance for six.
 *   - **Backspace behaves.** Six fields need focus juggling on every delete,
 *     and the edge cases (delete into a full box, delete into an empty one) are
 *     where every hand-rolled OTP row breaks.
 *
 * The caret sits in the next EMPTY box, which is `code.length`.
 *
 * ## The error, and reduced motion
 *
 * A wrong code shakes. Under reduced motion it does not travel at all: the
 * boxes flash their danger tint instead, for the same duration. That is design
 * brief 7.6 exactly - reduced motion removes the travel, never the feedback -
 * and neither version is the ONLY signal, because the caller renders the error
 * sentence under the row and it is announced (7.5).
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '@/components';
import { useTheme } from '@/theme/theme';
import { useReducedMotion } from '@/motion';
import { CODE_LENGTH, ERROR_FLASH_MS, isCodeComplete, sanitizeCode } from './otp';

export interface CodeInputHandle {
  /** Play the wrong-code feedback: a shake, or a tint under reduced motion. */
  playError: () => void;
  focus: () => void;
}

export interface CodeInputProps {
  value: string;
  onChange: (code: string) => void;
  /** Called once the sixth digit lands. The caller decides what submitting is. */
  onComplete: (code: string) => void;
  /** Tints the boxes and turns the caret off. */
  error?: boolean;
  /** Locks the field while a verify is in flight or has succeeded. */
  editable?: boolean;
  label: string;
  hint: string;
  autoFocus?: boolean;
  testID?: string;
}

export const CodeInput = forwardRef<CodeInputHandle, CodeInputProps>(function CodeInput(
  { value, onChange, onComplete, error = false, editable = true, label, hint, autoFocus, testID },
  ref,
) {
  const { space } = useTheme();
  const reduced = useReducedMotion();

  const [flash, setFlash] = useState(false);
  const input = useRef<TextInput>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const shake = useSharedValue(0);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  useImperativeHandle(ref, () => ({
    focus: () => input.current?.focus(),
    playError: () => {
      if (reduced) {
        setFlash(true);
        flashTimer.current = setTimeout(() => setFlash(false), ERROR_FLASH_MS);
        return;
      }
      const step = Math.round(ERROR_FLASH_MS / 8);
      shake.set(
        withSequence(
          withTiming(-8, { duration: step }),
          withTiming(8, { duration: step }),
          withTiming(-6, { duration: step }),
          withTiming(6, { duration: step }),
          withTiming(0, { duration: step }),
        ),
      );
    },
  }));

  const onChangeText = (raw: string) => {
    if (!editable) return;
    const next = sanitizeCode(raw);
    onChange(next);
    // Driven from the change rather than from an effect on the value: an effect
    // that also read the status would cancel its own work the moment it set the
    // status it was waiting on.
    if (isCodeComplete(next)) onComplete(next);
  };

  const row = useAnimatedStyle(() => ({
    // Reduced motion holds the row still; `flash` below carries the error.
    transform: [{ translateX: reduced ? 0 : shake.get() }],
  }));

  return (
    <Animated.View style={[{ flexDirection: 'row', gap: space[2] }, row]}>
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <CodeBox
          key={i}
          char={value[i] ?? ''}
          // The caret marks the next EMPTY box, and only while the field is
          // still taking input.
          caret={i === value.length && editable}
          error={error}
          flash={flash}
        />
      ))}

      {/*
        The real field, stretched invisibly over the six drawn boxes. It keeps a
        44pt-tall touch area of its own, so tapping anywhere on the row focuses
        it.
      */}
      <TextInput
        ref={input}
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        // **No `maxLength`, deliberately.** React Native truncates before
        // `onChangeText` runs, so a six-character cap would cut "Your Injishi
        // code is 123456" down to "Your I" and `sanitizeCode` would read no
        // digits at all. The cap belongs in `sanitizeCode`, which pulls the
        // digits out first and then takes six.
        autoFocus={autoFocus}
        // The boxes draw the value and the caret; the platform's own would sit
        // on top of them.
        caretHidden
        editable={editable}
        testID={testID}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0,
          color: 'transparent',
        }}
      />
    </Animated.View>
  );
});

interface CodeBoxProps {
  char: string;
  caret: boolean;
  error: boolean;
  flash: boolean;
}

/**
 * One drawn box. It holds no state and takes no input; the hidden field over
 * the row does both.
 *
 * **The caret is a steady bar, not a blinking one.** The platform's own caret
 * is hidden (it would sit on top of these), and a synthetic blink at a rate
 * that does not match the OS reads as a second, wrong cursor. A steady mark
 * says the same thing, needs no reduced-motion branch, and keeps a repeating
 * animation off a screen that has one already in the error shake.
 *
 * Hidden from assistive tech on purpose: six boxes announced one at a time is
 * six stops for a reader, and the field over them already announces the label,
 * the hint and the value as one control.
 */
function CodeBox({ char, caret, error, flash }: CodeBoxProps) {
  const { c, radius } = useTheme();

  const edge = error ? c.danger500 : caret ? c.focusRing : c.borderStrong;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        flex: 1,
        height: 56,
        borderRadius: radius.md,
        borderWidth: error || caret ? 1.5 : 1,
        borderColor: edge,
        // The reduced-motion error signal: the tint the shake would have been.
        backgroundColor: flash ? c.danger100 : c.surface1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {char ? (
        <Text family="mono" weight="semibold" size="xl" color="textStrong">
          {char}
        </Text>
      ) : caret ? (
        <View style={{ width: 2, height: 24, borderRadius: 1, backgroundColor: c.textStrong }} />
      ) : null}
    </View>
  );
}
