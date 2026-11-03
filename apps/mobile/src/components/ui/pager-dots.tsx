import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import { OnPhoto } from "./ground";
import { metrics } from "./metrics";

export type PagerDotsProps = {
  count: number;
  /** The current page, from 0. */
  index: number;
  /** `light` over a photograph (`.dots`, light in both themes); `default` on the page, in the accent. */
  tone?: "light" | "default";
};

/**
 * `.dots`: one dot per page, 5 apart, the current one stretched to a 16 bar. Read aloud as
 * "Photo 1 of 24"-style position: "Page 2 of 5".
 */
export function PagerDots({ count, index, tone = "light" }: PagerDotsProps) {
  const dots = <Dots count={count} index={index} tone={tone} />;
  return tone === "light" ? <OnPhoto>{dots}</OnPhoto> : dots;
}

function Dots({ count, index, tone }: Required<PagerDotsProps>) {
  // Dots carry no words, so they may wear the ink itself: the photo's light ink, or the accent.
  const [ink, rest] = useCSSVariable(
    tone === "light" ? ["--color-foreground", "--color-foreground"] : ["--color-accent", "--color-border"],
  );
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Page ${index + 1} of ${count}`}
      className="flex-row items-center justify-center gap-1.5"
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: a dot is a position
          key={i}
          className="rounded-full"
          style={{
            width: i === index ? metrics.pagerDotActive : metrics.pagerDot,
            height: metrics.pagerDot,
            backgroundColor: String(i === index ? ink : rest),
            opacity: i === index || tone !== "light" ? 1 : REST_OPACITY,
          }}
        />
      ))}
    </View>
  );
}

/** `.dots i`: the other pages at half the ink. */
const REST_OPACITY = 0.5;
