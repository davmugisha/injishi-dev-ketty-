/**
 * Which build this is (mobile spec 0002, D-x), from `extra.appVariant`, which app.config.ts sets
 * from APP_VARIANT. Anything else, the field missing included, counts as production, so a gate on
 * it fails closed.
 *
 * Pure on purpose: the caller passes `Constants.expoConfig?.extra`, and the unit test passes its
 * own (`scripts/app-variant.test.mjs`).
 */
export type AppVariant = "development" | "preview" | "production";

export function appVariantFrom(extra: unknown): AppVariant {
  const value = typeof extra === "object" && extra !== null ? (extra as { appVariant?: unknown }).appVariant : null;
  return value === "development" || value === "preview" ? value : "production";
}

/** The design system preview opens in development and preview builds only (AC-17). */
export function designSystemAllowed(variant: AppVariant): boolean {
  return variant === "development" || variant === "preview";
}
