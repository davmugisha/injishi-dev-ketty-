import { Button } from "./button";
import type { IconName } from "./icon";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { StateFrame } from "./state-frame";
import { Text } from "./text";

export type EmptyViewProps = {
  /** What would be here, as the tile's glyph. */
  icon: IconName;
  /** What is missing, as the heading. */
  title: string;
  /** What fills this space, and how. */
  body: string;
  /** The next useful step: every empty view offers one. */
  action: { label: string; onPress: () => void; icon?: IconName };
  /** A quieter second way forward, drawn as a link under the action. */
  secondary?: { label: string; onPress: () => void };
};

/**
 * Nothing to show yet (mobile spec 0002, AC-15, prototype `shared-10-empty`): a 120 icon tile on
 * `accent-soft`, a heading, a body, the primary action and an optional secondary link. Every word
 * comes from the caller.
 */
export function EmptyView({ icon, title, body, action, secondary }: EmptyViewProps) {
  return (
    <StateFrame
      tile={{ size: metrics.emptyTile, fill: "bg-accent-soft", role: "accent-soft-foreground" }}
      icon={icon}
      title={title}
      body={body}
    >
      <Button icon={action.icon} onPress={action.onPress}>
        {action.label}
      </Button>
      {secondary ? (
        // A link reads as one: accent words with no fill, on a press area that meets the 48 floor.
        <PressArea
          onPress={secondary.onPress}
          accessibilityRole="link"
          className="items-center justify-center overflow-hidden rounded-full px-4"
        >
          <Text role="headline" tone="accent" className="text-center">
            {secondary.label}
          </Text>
        </PressArea>
      ) : null}
    </StateFrame>
  );
}
