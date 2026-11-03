import { BlurView } from "expo-blur";
import { StyleSheet } from "react-native";

/**
 * Frosted glass behind a control on a photograph: `.iconbtn.glass` (light) and `.chip.dark`
 * (dark). A system material, not a colour: iOS and the web blur what is behind; Android draws the
 * material's translucent tint, which reads the same at a glance. The caller clips it
 * (`overflow-hidden` and its corner).
 */
export function Glass({ tone }: { tone: "light" | "dark" }) {
  return (
    <BlurView
      tint={tone === "light" ? "default" : "dark"}
      intensity={tone === "light" ? GLASS_LIGHT : GLASS_DARK}
      style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}
    />
  );
}

/** Blur strength, out of 100: light glass is thin (`oklch(100% 0 0 / .2)`), dark glass denser (`/ .55`). */
const GLASS_LIGHT = 60;
const GLASS_DARK = 70;
