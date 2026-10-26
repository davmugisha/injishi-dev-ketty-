"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rnLineHeight = exports.rnFontSize = exports.rnRadiusRoles = exports.rnRadius = exports.rnSpace = exports.easingCurves = exports.motionMs = exports.rhythm = exports.containers = exports.typeScale = exports.typeSteps = exports.herouiFixedGrounds = exports.herouiTypeScale = exports.herouiTracking = exports.herouiSpacing = exports.herouiFieldBorderWidth = exports.herouiFieldRadius = exports.herouiRadius = exports.herouiMixes = exports.herouiElevation = exports.herouiAliases = exports.herouiDark = exports.herouiLight = exports.herouiFixed = exports.palettes = exports.shadowControl = exports.radiusCard = exports.fixedGrounds = exports.aliases = exports.dark = exports.light = exports.fixed = exports.status = exports.green = exports.ink = void 0;
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
 *  - any surface laying out a page: import { typeSteps, typeScale, containers,
 *    rhythm } from "@injishi/design-tokens" (ADR-027's layout scale, emitted
 *    into injishi-heroui.css as @theme keys)
 *  - anything that moves: import { motionMs, easingCurves } — the motion
 *    scale, emitted into injishi-heroui.css as `duration-*` and `ease-*`
 *    utilities, and read as numbers by apps/mobile
 *
 * There is exactly one place any token value is authored (src/ramps.ts +
 * src/semantic.ts). Everything else is generated or resolved from here.
 */
var ramps_1 = require("./ramps");
Object.defineProperty(exports, "ink", { enumerable: true, get: function () { return ramps_1.ink; } });
Object.defineProperty(exports, "green", { enumerable: true, get: function () { return ramps_1.green; } });
var semantic_1 = require("./semantic");
Object.defineProperty(exports, "status", { enumerable: true, get: function () { return semantic_1.status; } });
Object.defineProperty(exports, "fixed", { enumerable: true, get: function () { return semantic_1.fixed; } });
Object.defineProperty(exports, "light", { enumerable: true, get: function () { return semantic_1.light; } });
Object.defineProperty(exports, "dark", { enumerable: true, get: function () { return semantic_1.dark; } });
Object.defineProperty(exports, "aliases", { enumerable: true, get: function () { return semantic_1.aliases; } });
Object.defineProperty(exports, "fixedGrounds", { enumerable: true, get: function () { return semantic_1.fixedGrounds; } });
Object.defineProperty(exports, "radiusCard", { enumerable: true, get: function () { return semantic_1.radiusCard; } });
Object.defineProperty(exports, "shadowControl", { enumerable: true, get: function () { return semantic_1.shadowControl; } });
Object.defineProperty(exports, "palettes", { enumerable: true, get: function () { return semantic_1.palettes; } });
var heroui_1 = require("./heroui");
Object.defineProperty(exports, "herouiFixed", { enumerable: true, get: function () { return heroui_1.herouiFixed; } });
Object.defineProperty(exports, "herouiLight", { enumerable: true, get: function () { return heroui_1.herouiLight; } });
Object.defineProperty(exports, "herouiDark", { enumerable: true, get: function () { return heroui_1.herouiDark; } });
Object.defineProperty(exports, "herouiAliases", { enumerable: true, get: function () { return heroui_1.herouiAliases; } });
Object.defineProperty(exports, "herouiElevation", { enumerable: true, get: function () { return heroui_1.herouiElevation; } });
Object.defineProperty(exports, "herouiMixes", { enumerable: true, get: function () { return heroui_1.herouiMixes; } });
Object.defineProperty(exports, "herouiRadius", { enumerable: true, get: function () { return heroui_1.herouiRadius; } });
Object.defineProperty(exports, "herouiFieldRadius", { enumerable: true, get: function () { return heroui_1.herouiFieldRadius; } });
Object.defineProperty(exports, "herouiFieldBorderWidth", { enumerable: true, get: function () { return heroui_1.herouiFieldBorderWidth; } });
Object.defineProperty(exports, "herouiSpacing", { enumerable: true, get: function () { return heroui_1.herouiSpacing; } });
Object.defineProperty(exports, "herouiTracking", { enumerable: true, get: function () { return heroui_1.herouiTracking; } });
Object.defineProperty(exports, "herouiTypeScale", { enumerable: true, get: function () { return heroui_1.herouiTypeScale; } });
Object.defineProperty(exports, "herouiFixedGrounds", { enumerable: true, get: function () { return heroui_1.herouiFixedGrounds; } });
var layout_1 = require("./layout");
Object.defineProperty(exports, "typeSteps", { enumerable: true, get: function () { return layout_1.typeSteps; } });
Object.defineProperty(exports, "typeScale", { enumerable: true, get: function () { return layout_1.typeScale; } });
Object.defineProperty(exports, "containers", { enumerable: true, get: function () { return layout_1.containers; } });
Object.defineProperty(exports, "rhythm", { enumerable: true, get: function () { return layout_1.rhythm; } });
var motion_1 = require("./motion");
Object.defineProperty(exports, "motionMs", { enumerable: true, get: function () { return motion_1.motionMs; } });
Object.defineProperty(exports, "easingCurves", { enumerable: true, get: function () { return motion_1.easingCurves; } });
var rn_1 = require("./rn");
Object.defineProperty(exports, "rnSpace", { enumerable: true, get: function () { return rn_1.rnSpace; } });
Object.defineProperty(exports, "rnRadius", { enumerable: true, get: function () { return rn_1.rnRadius; } });
Object.defineProperty(exports, "rnRadiusRoles", { enumerable: true, get: function () { return rn_1.rnRadiusRoles; } });
Object.defineProperty(exports, "rnFontSize", { enumerable: true, get: function () { return rn_1.rnFontSize; } });
Object.defineProperty(exports, "rnLineHeight", { enumerable: true, get: function () { return rn_1.rnLineHeight; } });
