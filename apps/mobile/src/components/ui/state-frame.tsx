import type { ReactNode } from "react";
import { View } from "react-native";
import { Glyph, type IconName } from "./icon";
import { Text } from "./text";

export type StateFrameProps = {
  /** The tile's side from `metrics`, its soft fill class, and the label role that pairs with it. */
  tile: { size: number; fill: string; role: string };
  icon: IconName;
  title: string;
  body: string;
  /** The view's own last lines: its action, then a link or a footnote. */
  children: ReactNode;
};

/**
 * The column the empty and error views share (prototypes `shared-10-empty`, `shared-11-error`): an
 * icon tile, a heading, a body, then the view's actions, centred and 16 apart. It grows into the
 * space a screen gives it and centres there; in a scrolling body it is as tall as its content, so
 * large text scrolls instead of being cut off.
 */
export function StateFrame({ tile, icon, title, body, children }: StateFrameProps) {
  return (
    <View className="grow items-center justify-center gap-4 px-4 py-8">
      <View
        className={`items-center justify-center rounded-4xl ${tile.fill}`}
        style={{ width: tile.size, height: tile.size }}
      >
        <Glyph name={icon} size={40} role={tile.role} />
      </View>
      <Text role="title2" className="text-center">
        {title}
      </Text>
      <Text role="body" tone="muted" className="text-center">
        {body}
      </Text>
      {children}
    </View>
  );
}
