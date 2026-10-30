import { Button } from "./button";
import type { IconName } from "./icon";
import { metrics } from "./metrics";
import { StateFrame } from "./state-frame";
import { Text } from "./text";

export type ErrorViewProps = {
  /** The cause, as the tile's glyph (no connection, a server fault). */
  icon: IconName;
  /** What could not happen, as the heading. */
  title: string;
  /** Names the cause, and says what did not happen as a result. */
  body: string;
  onRetry: () => void;
  retryLabel?: string;
  /** A last quiet line under the button: what still works meanwhile. */
  footnote?: string;
};

/**
 * Something failed (mobile spec 0002, AC-15, prototype `shared-11-error`): a 112 icon tile on
 * `danger-soft`, a heading, a body naming the cause, a retry button and an optional footnote. Every
 * word comes from the caller; only the button has a default, "Try again".
 */
export function ErrorView({ icon, title, body, onRetry, retryLabel = "Try again", footnote }: ErrorViewProps) {
  return (
    <StateFrame
      tile={{ size: metrics.errorTile, fill: "bg-danger-soft", role: "danger-soft-foreground" }}
      icon={icon}
      title={title}
      body={body}
    >
      <Button icon="ArrowRotateRight" onPress={onRetry}>
        {retryLabel}
      </Button>
      {footnote ? (
        <Text role="caption" tone="muted" className="text-center">
          {footnote}
        </Text>
      ) : null}
    </StateFrame>
  );
}
