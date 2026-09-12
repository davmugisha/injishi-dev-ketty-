"use strict";
/**
 * The two OKLCH-derived 50-950 ramps that carry the whole platform.
 * Source of truth: DESIGN.md / dox_context/ui-tokens.md. Pure black never
 * ships — ink-950 (#042330) is the darkest value.
 *
 * Every neutral is an ink tint; there are no gray grays.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.green = exports.ink = void 0;
exports.ink = {
    50: "#F2FBFF",
    100: "#E6F4FB",
    200: "#CFE7F4",
    300: "#B3D8EB",
    400: "#6DA7C4",
    500: "#428AAA",
    600: "#287291",
    700: "#145A76",
    800: "#09465D",
    900: "#093344",
    950: "#042330",
};
exports.green = {
    50: "#EFFDEC",
    100: "#E1F8DD",
    200: "#C7EFC1",
    300: "#A4E49B",
    400: "#6FD762",
    500: "#42C42F",
    600: "#22AD01",
    700: "#1B9101",
    800: "#147900",
    900: "#18610D",
    950: "#174D0F",
};
