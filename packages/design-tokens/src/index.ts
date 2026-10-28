/**
 * @injishi/design-tokens — one vocabulary everywhere.
 *
 * Consumers:
 *  - web / admin: import "@injishi/design-tokens/css" (generated CSS variables:
 *    ramps + every semantic role + the Tailwind @theme mapping)
 *  - consumers keeping their own semantic layer: import
 *    "@injishi/design-tokens/ramps.css" (the 22 ramp hexes only)
 *  - mobile (RN): import { ink, green, status } from
 *    "@injishi/design-tokens", plus the scales — { rnSpace, rnRadius,
 *    rnFontSize, rnLineHeight } — which ADR-034 task 6 made this package the
 *    single owner of
 *  - mobile (HeroUI Native): import "@injishi/design-tokens/native.css" in
 *    global.css after HeroUI Native's own sheets; read
 *    "@injishi/design-tokens/native.json" for a colour as a value
 *  - any surface laying out a page: import { typeSteps, typeScale, containers,
 *    rhythm } from "@injishi/design-tokens" (ADR-027's layout scale, emitted
 *    into injishi-heroui.css as @theme keys)
 *  - anything that moves: import { motionMs, easingCurves } — the motion
 *    scale, emitted into injishi-heroui.css as `duration-*` and `ease-*`
 *    utilities, and read as numbers by apps/mobile
 *
 * There is exactly one place any token value is authored (src/ramps.ts +
 * src/semantic.ts + src/heroui.ts). Everything else is generated or resolved
 * from here.
 */
export { ink, green } from "./ramps";
export type { Ramp, RampStep } from "./ramps";
export {
  status,
  fixed,
  light,
  dark,
  aliases,
  fixedGrounds,
  radiusCard,
  shadowControl,
  palettes,
} from "./semantic";
export type { RoleMap, SemanticPalette, ThemeName } from "./semantic";
export {
  herouiFixed,
  herouiLight,
  herouiDark,
  herouiAliases,
  herouiElevation,
  herouiMixes,
  herouiSoftLabels,
  herouiRadius,
  herouiFieldRadius,
  herouiFieldBorderWidth,
  herouiSpacing,
  herouiTracking,
  herouiTypeScale,
  herouiFixedGrounds,
} from "./heroui";
export type { HeroUIPalette } from "./heroui";
export { typeSteps, typeScale, containers, rhythm } from "./layout";
export type { TypeStep, TypeStepName, ContainerName, RhythmName } from "./layout";
export { motionMs, easingCurves } from "./motion";
export type { MotionStep, EasingName } from "./motion";
export { rnSpace, rnRadius, rnRadiusRoles, rnFontSize, rnLineHeight } from "./rn";
export type { RnSpaceStep, RnRadiusStep, RnRadiusRole, RnTextSize } from "./rn";
