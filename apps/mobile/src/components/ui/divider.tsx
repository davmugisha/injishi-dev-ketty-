import { View } from "react-native";

export type DividerProps = {
  /** `inset` keeps 16 clear at both ends; the default runs edge to edge of its parent. */
  inset?: boolean;
  /** Spacing around the line, e.g. `my-3`. */
  className?: string;
};

/** `.divider`: a hairline in the `separator` role. Decoration: a screen reader skips it. */
export function Divider({ inset = false, className }: DividerProps) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      className={["h-px bg-separator", inset ? "mx-4" : "", className].filter(Boolean).join(" ")}
    />
  );
}
