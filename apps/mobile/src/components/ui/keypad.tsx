import type { ReactNode } from "react";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import { haptic } from "@/lib/haptics";
import { Icon, type IconName } from "./icon";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { Text } from "./text";

const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
] as const;

export type KeypadProps = {
  /** A digit was pressed. */
  onKey: (digit: string) => void;
  /** The delete key was pressed. */
  onDelete: () => void;
  /** The key left of 0: a fingerprint, "Forgot". Empty when absent. */
  extra?: { icon: IconName; label: string; onPress: () => void };
  isDisabled?: boolean;
};

/**
 * `.keypad`: a PIN pad, three columns of round 64 keys (1 to 9, then an extra key, 0 and delete),
 * digits in `title1`. Each key ticks (D-r) and reads its digit; delete reads "Delete".
 */
export function Keypad({ onKey, onDelete, extra, isDisabled }: KeypadProps) {
  return (
    <View className="gap-2.5 px-6">
      {ROWS.map((row) => (
        <View key={row[0]} className="flex-row justify-between gap-4">
          {row.map((digit) => (
            <Key key={digit} label={digit} onPress={() => onKey(digit)} isDisabled={isDisabled}>
              <Text role="title1" tabular>
                {digit}
              </Text>
            </Key>
          ))}
        </View>
      ))}
      <View className="flex-row justify-between gap-4">
        {extra ? (
          <Key label={extra.label} onPress={extra.onPress} isDisabled={isDisabled}>
            <Icon name={extra.icon} size={24} />
          </Key>
        ) : (
          <View className="flex-1" />
        )}
        <Key label="0" onPress={() => onKey("0")} isDisabled={isDisabled}>
          <Text role="title1" tabular>
            0
          </Text>
        </Key>
        <Key label="Delete" onPress={onDelete} isDisabled={isDisabled}>
          <Icon name="Delete" size={24} />
        </Key>
      </View>
    </View>
  );
}

function Key({
  label,
  onPress,
  isDisabled,
  children,
}: {
  label: string;
  onPress: () => void;
  isDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <PressArea
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      isDisabled={isDisabled}
      accessibilityLabel={label}
      feedback="native"
      className="flex-1 items-center justify-center overflow-hidden rounded-full"
      style={{ minHeight: metrics.keypadKey }}
    >
      {children}
    </PressArea>
  );
}

export type PinDotsProps = {
  /** How many digits the PIN has. */
  length: number;
  /** How many are typed. */
  filled: number;
  /** The PIN was wrong: the dots draw in danger. */
  invalid?: boolean;
};

/**
 * `.pinrow`: one ring per digit, 16 apart, filled in the page's ink as digits are typed. Read aloud
 * as "2 of 4 digits entered".
 */
export function PinDots({ length, filled, invalid = false }: PinDotsProps) {
  const [ink, danger] = useCSSVariable(["--color-foreground", "--color-danger"]);
  const fill = String(invalid ? danger : ink);
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={invalid ? "Wrong PIN" : `${filled} of ${length} digits entered`}
      accessibilityLiveRegion="polite"
      className="flex-row justify-center gap-4"
    >
      {Array.from({ length }, (_, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: a dot is a position
          key={i}
          className={`rounded-full border-2 ${invalid ? "border-danger" : i < filled ? "border-foreground" : "border-border"}`}
          style={{
            width: metrics.pinDot,
            height: metrics.pinDot,
            // A dot carries no words, so it may wear the ink itself as its fill.
            backgroundColor: i < filled ? fill : undefined,
          }}
        />
      ))}
    </View>
  );
}
