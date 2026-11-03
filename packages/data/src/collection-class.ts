import dataMap from "./data-map.json";

/**
 * The collections the data map (`data-map.json`) classes as product configuration that stays in code:
 * labels, rules, the hub's groups. Every other collection without a live source is sample data, the
 * demo's story, and is shown only to the demo's own people (2026-10-30).
 */
export const STATIC_COLLECTIONS: ReadonlySet<string> = new Set(
  (dataMap as { collection: string; class: string }[]).filter((r) => r.class === "static").map((r) => r.collection),
);
