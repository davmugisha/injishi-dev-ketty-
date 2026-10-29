import { defineConfig } from "vitest/config";

/**
 * Vitest for the presentation helpers (2026-10-27): every `.test.ts` file under `tests/unit/`, in Node.
 *
 * The clock is pinned to Kigali. Several helpers read the LOCAL day on purpose (`toISODate`,
 * `nightsBetween`, `formatDateRange`), and a laptop in Kigali and a CI runner on UTC would otherwise
 * disagree about which day 01:30 falls on. Rwanda keeps no daylight saving, so this is UTC+2 all year.
 */
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: { TZ: "Africa/Kigali" },
  },
});
