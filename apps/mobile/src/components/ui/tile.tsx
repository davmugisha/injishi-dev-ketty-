import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { View } from "react-native";
import { CountBadge } from "./badge";
import { OnGround } from "./ground";
import { Icon, type IconName } from "./icon";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { Text } from "./text";

/** The column gaps the prototype's grids use: `.tiles4` 10, `.rgrid` 8. */
const GAP = { sm: "gap-2", md: "gap-2.5" } as const;

/**
 * Lays children out in rows of `columns`, each cell an equal share of the row (a CSS grid's
 * `repeat(n, 1fr)`). A short last row keeps its cells the same width. For the kit's grids.
 */
export function GridRows({
  columns,
  gap = "md",
  children,
  className,
}: {
  columns: number;
  gap?: keyof typeof GAP;
  children: ReactNode;
  className?: string;
}) {
  const cells = Children.toArray(children).filter(isValidElement) as ReactElement[];
  const rows: ReactElement[][] = [];
  for (let i = 0; i < cells.length; i += columns) rows.push(cells.slice(i, i + columns));
  return (
    <View className={[GAP[gap], className].filter(Boolean).join(" ")}>
      {rows.map((row, r) => (
        <View key={row[0]?.key ?? r} className={`flex-row ${GAP[gap]}`}>
          {row.map((cell, c) => (
            <View key={cell.key ?? c} className="flex-1">
              {cell}
            </View>
          ))}
          {Array.from({ length: columns - row.length }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: an empty cell is only a position
            <View key={`empty-${i}`} className="flex-1" />
          ))}
        </View>
      ))}
    </View>
  );
}

export type TileGridProps = {
  /** `Tile`s, `OptionTile`s, or any cells. */
  children: ReactNode;
  /** `.tiles4` (default) or `.tiles3`. */
  columns?: 3 | 4;
  /** Layout only. The prototype's grids sit 16 in from the edges: `px-4`. */
  className?: string;
};

/** `.tiles4` / `.tiles3`: equal cells, 10 apart, in rows. */
export function TileGrid({ children, columns = 4, className }: TileGridProps) {
  return (
    <GridRows columns={columns} className={className}>
      {children}
    </GridRows>
  );
}

export type TileProps = {
  icon: IconName;
  /** `.tile`'s word under the square ("Order", "Wi-Fi"). */
  label: string;
  /** `.tile small`: a quieter second line ("to room", "47,500 due"). */
  caption?: string;
  /** `true` draws a dot on the square, a number a count. Read aloud with the label. */
  badge?: number | true;
  onPress: () => void;
};

/**
 * `.tile`: a quick action. A square (1.05:1) on the surface with a hairline, the icon in the
 * accent, and its words under it. The whole tile is one 48+ press area.
 */
export function Tile({ icon, label, caption, badge, onPress }: TileProps) {
  const news = typeof badge === "number" ? `, ${badge} new` : badge ? ", new" : "";
  return (
    <PressArea
      onPress={onPress}
      accessibilityLabel={[label, caption].filter(Boolean).join(", ") + news}
      className="items-stretch gap-2"
    >
      <OnGround ground={null}>
        <View
          className="items-center justify-center rounded-3xl border border-separator bg-surface"
          style={{ aspectRatio: TILE_ASPECT }}
        >
          <Icon name={icon} size={24} tone="accent" />
          {typeof badge === "number" ? (
            <View className="absolute right-1.5 top-1.5">
              <CountBadge count={badge} />
            </View>
          ) : badge ? (
            <View
              className="absolute right-3 top-3 rounded-full bg-danger"
              style={{ width: metrics.badgeDot, height: metrics.badgeDot }}
            />
          ) : null}
        </View>
      </OnGround>
      <View className="items-center">
        <Text role="caption" strong className="text-center">
          {label}
        </Text>
        {caption ? (
          <Text role="micro" tone="muted" className="text-center">
            {caption}
          </Text>
        ) : null}
      </View>
    </PressArea>
  );
}

/** `.tile .sq`'s proportion: a hair wider than tall. */
const TILE_ASPECT = 1.05;
