/**
 * The two OKLCH-derived 50-950 ramps that carry the whole platform.
 * Source of truth: DESIGN.md / dox_context/ui-tokens.md. Pure black never
 * ships — ink-950 (#042330) is the darkest value.
 *
 * Every neutral is an ink tint; there are no gray grays.
 */
export declare const ink: {
    readonly 50: "#F2FBFF";
    readonly 100: "#E6F4FB";
    readonly 200: "#CFE7F4";
    readonly 300: "#B3D8EB";
    readonly 400: "#6DA7C4";
    readonly 500: "#428AAA";
    readonly 600: "#287291";
    readonly 700: "#145A76";
    readonly 800: "#09465D";
    readonly 900: "#093344";
    readonly 950: "#042330";
};
export declare const green: {
    readonly 50: "#EFFDEC";
    readonly 100: "#E1F8DD";
    readonly 200: "#C7EFC1";
    readonly 300: "#A4E49B";
    readonly 400: "#6FD762";
    readonly 500: "#42C42F";
    readonly 600: "#22AD01";
    readonly 700: "#1B9101";
    readonly 800: "#147900";
    readonly 900: "#18610D";
    readonly 950: "#174D0F";
};
export type Ramp = typeof ink;
export type RampStep = keyof Ramp;
//# sourceMappingURL=ramps.d.ts.map