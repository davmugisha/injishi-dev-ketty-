import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { FixedLight } from "./ground";
import { metrics } from "./metrics";

/** Modules per side, as the prototype's `qr()`. */
const N = 25;

/**
 * The prototype's `qr()` (lib.mjs), ported: a deterministic stand-in code from a seed, not a
 * scannable one. FNV-1a over the seed, then the same mixing steps, so a seed draws the same
 * pattern here as in the prototype. Returns the data modules as one path, finder corners excluded.
 */
export function qrModules(seed: string): string {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909);
    return (h >>> 0) / 4294967296;
  };
  const finder = (x: number, y: number) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
  let d = "";
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (finder(x, y)) continue;
      if (rnd() > 0.52) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return d;
}

/** The three finder corners' top left module. */
const EYES = [
  [0, 0],
  [N - 7, 0],
  [0, N - 7],
] as const;

export type QrCodeProps = {
  /** The same seed always draws the same code. */
  seed: string;
  /** The code's side, without the frame. Default 168. */
  size?: number;
  /** `.qrbox`: the white quiet zone around it, 20 cornered with 16 of padding. Default on. */
  framed?: boolean;
  /** Read aloud ("Check-in code for Amina Wanjiru"). */
  label?: string;
};

/**
 * A QR code drawn with react-native-svg from `qrModules(seed)`, dark modules on a white quiet zone
 * in both themes (a code must not invert to scan): the light theme's `foreground` on its `segment`
 * white, through a fixed-light scope, never a hex.
 */
export function QrCode({ seed, size = metrics.qr, framed = true, label = "QR code" }: QrCodeProps) {
  return (
    <FixedLight>
      <QrDrawing seed={seed} size={size} framed={framed} label={label} />
    </FixedLight>
  );
}

function QrDrawing({ seed, size, framed, label }: Required<QrCodeProps>) {
  const [ink, paper] = useCSSVariable(["--color-foreground", "--color-segment"]);
  const d = useMemo(() => qrModules(seed), [seed]);
  const code = (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${N} ${N}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Path d={d} fill={String(ink)} />
      {EYES.map(([x, y]) => (
        <Eye key={`${x}-${y}`} x={x} y={y} ink={String(ink)} paper={String(paper)} />
      ))}
    </Svg>
  );
  if (!framed) return code;
  return <View className="items-center justify-center self-center rounded-3xl bg-segment p-4">{code}</View>;
}

function Eye({ x, y, ink, paper }: { x: number; y: number; ink: string; paper: string }) {
  return (
    <>
      <Rect x={x} y={y} width={7} height={7} rx={1.6} fill={ink} />
      <Rect x={x + 1} y={y + 1} width={5} height={5} rx={1.1} fill={paper} />
      <Rect x={x + 2} y={y + 2} width={3} height={3} rx={0.7} fill={ink} />
    </>
  );
}
