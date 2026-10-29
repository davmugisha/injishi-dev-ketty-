import { SkeletonGroup } from "heroui-native";
import type { ReactNode } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { useReduceMotion } from "@/lib/use-reduce-motion";

export type LoadingViewProps = {
  /** What is loading, read aloud ("Loading your stay"). The bones themselves say nothing. */
  label: string;
  /** The skeleton: `LoadingBone`s laid out in the shape of the screen that is on its way. */
  children: ReactNode;
  /** Layout of the bones, e.g. `px-4`. They stack 16 apart unless this says otherwise. */
  className?: string;
};

/**
 * A screen still loading (mobile spec 0002, AC-15, prototype `shared-09-loading`): grey bones in
 * the shape of what is coming, never a lone spinner. They shimmer with HeroUI's sweep (D-s); under
 * Reduce Motion the provider's `animation="disable-all"` holds them still. A screen reader meets
 * one busy progress bar with the caller's label.
 */
export function LoadingView({ label, children, className }: LoadingViewProps) {
  // `disable-all` only parks the shimmer, leaving a still band across each bone; under Reduce Motion
  // the bones are plain instead (AC-13).
  const reduceMotion = useReduceMotion();
  return (
    // The screen reader props sit on a view of our own: `SkeletonGroup` hands any prop it does not
    // know to every bone, not to its container.
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }}>
      <SkeletonGroup
        isLoading
        variant={reduceMotion ? "none" : "shimmer"}
        className={["gap-4", className].filter(Boolean).join(" ")}
      >
        {children}
      </SkeletonGroup>
    </View>
  );
}

export type LoadingBoneProps = {
  /** Size and corner on the grid: `h-8 w-3/5`, `h-56 rounded-3xl`. Corners default to `rounded-lg`. */
  className?: string;
  /** A size the classes cannot say, e.g. `{ flex: 1 }` or `{ aspectRatio: 1 }`. */
  style?: StyleProp<ViewStyle>;
};

/** One bone of a `LoadingView`'s skeleton. Outside a `LoadingView` it throws. */
export function LoadingBone({ className, style }: LoadingBoneProps) {
  return <SkeletonGroup.Item className={["rounded-lg", className].filter(Boolean).join(" ")} style={style} />;
}
