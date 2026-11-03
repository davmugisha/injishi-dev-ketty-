import { useCSSVariable } from "uniwind";
import { View } from "react-native";
import { Glyph, type IconName } from "./icon";
import { metrics } from "./metrics";
import { Text } from "./text";

export type TimelineState = "done" | "now" | "todo";

export type TimelineStep = {
  title: string;
  /** One quiet line: when, by whom ("10:58 · 15 of 15 checks"). */
  detail?: string;
  state: TimelineState;
  /** The disc's icon for `now` and `todo` (`ShieldCheck`, `Key`). `done` always shows a tick. */
  icon?: IconName;
  /** A stable key when two steps share a title. */
  key?: string;
};

/**
 * Each state's disc: done a success fill with a tick, now the accent with a soft halo, to do the
 * neutral fill with a muted icon. The word read aloud says the state, so it never rests on colour.
 */
const DISC = {
  done: { root: "bg-success", role: "success-foreground", word: "Done" },
  now: { root: "bg-accent", role: "accent-foreground", word: "Now" },
  todo: { root: "bg-default", role: "muted", word: "Next" },
} as const satisfies Record<TimelineState, { root: string; role: string; word: string }>;

/** `.tl .st.done::before`: the line after a done step, in success at half strength. */
const DONE_LINE = 0.5;

export type TimelineProps = {
  steps: readonly TimelineStep[];
  /** Layout only. */
  className?: string;
};

/**
 * `.tl`: steps down a line, each a 28 disc and its words, 16 apart. The line between two discs is
 * the separator, or success at half strength after a done step. A screen reader reads each step as
 * one line: its state, its title, its detail.
 */
export function Timeline({ steps, className }: TimelineProps) {
  const [success, separator, halo] = useCSSVariable(["--color-success", "--color-separator", "--color-accent-soft"]);
  return (
    <View className={className}>
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const disc = DISC[step.state];
        const icon: IconName =
          step.state === "done" ? "Check" : (step.icon ?? (step.state === "now" ? "Clock" : "CircleDashed"));
        return (
          <View
            key={step.key ?? step.title}
            accessible
            accessibilityLabel={[disc.word, step.title, step.detail].filter(Boolean).join(", ")}
            className="flex-row gap-2.5"
          >
            <View className="items-center" style={{ width: metrics.timelineDot }}>
              <View
                className={`items-center justify-center rounded-full ${disc.root}`}
                style={{
                  width: metrics.timelineDot,
                  height: metrics.timelineDot,
                  boxShadow: step.state === "now" ? `0 0 0 4px ${String(halo)}` : undefined,
                }}
              >
                <Glyph name={icon} size={16} role={disc.role} />
              </View>
              {last ? null : (
                <View
                  className="flex-1"
                  style={{
                    width: metrics.timelineLine,
                    backgroundColor: String(step.state === "done" ? success : separator),
                    opacity: step.state === "done" ? DONE_LINE : 1,
                  }}
                />
              )}
            </View>
            <View className={`flex-1 gap-0.5 pt-0.5 ${last ? "" : "pb-4"}`}>
              <Text role="callout" strong>
                {step.title}
              </Text>
              {step.detail ? (
                <Text role="caption" tone="muted">
                  {step.detail}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
