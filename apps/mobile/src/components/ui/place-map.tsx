import { type ReactNode, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text as NativeText, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Line, Rect, Stop } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { Inverse, OnGround } from "./ground";
import { Glyph, type IconName } from "./icon";
import { metrics } from "./metrics";
import { PressArea } from "./press-area";
import { useSvgId } from "./svg";
import { roleText, Text } from "./text";

export type MapPin = {
  /** From the left edge, in percent (0 to 100). */
  x: number;
  /** From the top edge, in percent (0 to 100). */
  y: number;
  /** The price or name on the pin ("140k"). */
  label: string;
  /** The pin in focus: inverted, as `.pin.on`. */
  active?: boolean;
  /** A small icon before the label (a heart on a saved place). */
  icon?: IconName;
  /** Opens what the pin stands for. Read aloud with the label; give `accessibilityLabel` to say more. */
  onPress?: () => void;
  accessibilityLabel?: string;
};

export type PlaceMapProps = {
  pins?: readonly MapPin[];
  /** `card` is the 180 high `.map` with 24 corners; `fill` takes its parent's whole space, square cornered. */
  size?: "card" | "fill";
  /** A water label on the lake (`LAKE KIVU`). */
  lakeLabel?: string;
  /** Over the map, positioned by the caller: a search bar at the top, a place card at the foot. */
  children?: ReactNode;
  /** Read aloud for the map itself ("Map of stays around Lake Kivu"). */
  label?: string;
  /** Layout only. */
  className?: string;
};

/**
 * `.map`: the prototype's stand-in map (no map SDK in this build): green ground, a lake, two roads,
 * and price pins at percent positions, drawn with react-native-svg in palette roles (the ground a
 * soft success wash, the lake the info blue, the roads the `segment` white), so the dark theme dims it
 * as the prototype's filter does. Pins are pills on the surface, the active one inverted; each is a
 * 48 press area centred on its point.
 */
export function PlaceMap({ pins = [], size = "card", lakeLabel, children, label = "Map", className }: PlaceMapProps) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== box.width || height !== box.height) setBox({ width, height });
  };
  return (
    <OnGround ground={null}>
      <View
        onLayout={onLayout}
        className={["overflow-hidden bg-surface", size === "card" ? "rounded-3xl" : "flex-1", className]
          .filter(Boolean)
          .join(" ")}
        style={size === "card" ? { height: metrics.map } : undefined}
      >
        <View accessible accessibilityRole="image" accessibilityLabel={label} style={StyleSheet.absoluteFill}>
          {box.width > 0 ? <Terrain width={box.width} height={box.height} /> : null}
        </View>
        {lakeLabel && box.width > 0 ? (
          <Anchor x={LAKE.x * 100} y={LAKE.y * 100}>
            <Text role="micro" tone="info" caps importantForAccessibility="no">
              {lakeLabel}
            </Text>
          </Anchor>
        ) : null}
        {pins.map((pin) => (
          <Anchor key={`${pin.x}:${pin.y}:${pin.label}`} x={pin.x} y={pin.y}>
            <Pin pin={pin} />
          </Anchor>
        ))}
        {children}
      </View>
    </OnGround>
  );
}

/** The lake's centre (70% across, 35% down) and radius (22% of the reach to the farthest corner). */
const LAKE = { x: 0.7, y: 0.35, radius: 0.22 };
/** The two roads: a CSS gradient angle, where along it, and the band's width (all of the gradient line). */
const ROADS = [
  { angle: 115, at: 0.47, band: 0.02 },
  { angle: 25, at: 0.6075, band: 0.015 },
] as const;
/** How strong the palette's colours lie on the map: the ground's green wash, the lake, the roads. */
const WASH = { ground: 0.28, groundFar: 0.36, lake: 0.3, road: 0.7 } as const;

function Terrain({ width, height }: { width: number; height: number }) {
  const [success, water, road] = useCSSVariable(["--color-success", "--color-info", "--color-segment"]);
  const ground = useSvgId("mapGround");
  const cx = LAKE.x * width;
  const cy = LAKE.y * height;
  const reach = Math.hypot(Math.max(cx, width - cx), Math.max(cy, height - cy));
  const diagonal = Math.hypot(width, height);
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={ground} x1="0" y1="0" x2="1" y2="1">
          <Stop offset={0} stopColor={String(success)} stopOpacity={WASH.ground} />
          <Stop offset={1} stopColor={String(success)} stopOpacity={WASH.groundFar} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${ground})`} />
      <Circle cx={cx} cy={cy} r={reach * LAKE.radius} fill={String(water)} fillOpacity={WASH.lake} />
      {ROADS.map((road_) => {
        // A CSS gradient at `angle` runs along (sin a, -cos a); its colour bands lie across it.
        const a = (road_.angle * Math.PI) / 180;
        const dir = { x: Math.sin(a), y: -Math.cos(a) };
        const length = Math.abs(width * dir.x) + Math.abs(height * dir.y);
        const px = width / 2 + (road_.at - 0.5) * length * dir.x;
        const py = height / 2 + (road_.at - 0.5) * length * dir.y;
        const across = { x: -dir.y, y: dir.x };
        return (
          <Line
            key={road_.angle}
            x1={px - across.x * diagonal}
            y1={py - across.y * diagonal}
            x2={px + across.x * diagonal}
            y2={py + across.y * diagonal}
            stroke={String(road)}
            strokeOpacity={WASH.road}
            strokeWidth={Math.max(road_.band * length, 1)}
          />
        );
      })}
    </Svg>
  );
}

/** A zero-size box at a percent point; its child centres on the point, whatever its size. */
function Anchor({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <View
      className="absolute items-center justify-center"
      style={{ left: `${x}%`, top: `${y}%`, width: 0, height: 0, overflow: "visible" }}
    >
      {children}
    </View>
  );
}

const PIN_TEXT = roleText("caption", false, { strong: true, tabular: true });

function Pin({ pin }: { pin: MapPin }) {
  const body = <PinBody pin={pin} />;
  const drawn = pin.active ? <Inverse>{body}</Inverse> : body;
  if (!pin.onPress) return drawn;
  return (
    <PressArea
      onPress={pin.onPress}
      accessibilityLabel={pin.accessibilityLabel ?? pin.label}
      accessibilityState={{ selected: Boolean(pin.active) }}
      className="items-center justify-center"
    >
      {drawn}
    </PressArea>
  );
}

function PinBody({ pin }: { pin: MapPin }) {
  return (
    <View
      className="flex-row items-center gap-1 rounded-full bg-surface px-2.5 shadow-overlay"
      style={{ minHeight: metrics.mapPin }}
    >
      {pin.icon ? <Glyph name={pin.icon} size={12} role={pin.active ? "foreground" : "danger"} /> : null}
      <NativeText
        className={`${PIN_TEXT.className} text-foreground`}
        maxFontSizeMultiplier={1.5}
        style={PIN_TEXT.style}
      >
        {pin.label}
      </NativeText>
    </View>
  );
}
