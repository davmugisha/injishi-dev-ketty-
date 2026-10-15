/**
 * CRUD flows through the API, as the personas who do them, using the same mutations the screens'
 * buttons call and the same live sources the screens read.
 *
 *   pnpm --filter @injishi/app exec tsx scripts/verify-flows.ts --area platform
 *
 * Each area's flows live in scripts/flows/<area>.ts. Prints "FLOWS OK <n>" only when every flow
 * passed. Flows create their own records; `seed-interface.mjs` converges them away on the next seed.
 */
import { ApiError } from "../src/server/api";
import type { Flow, FlowHelpers } from "./flows/types";
import { check, contextFor, fail, main } from "./lib/harness";

const loaders: Record<string, () => Promise<{ flows: Flow[] }>> = {
  platform: () => import("./flows/platform"),
  owner: () => import("./flows/owner"),
  operations: () => import("./flows/operations"),
  people: () => import("./flows/people"),
  frontdesk: () => import("./flows/frontdesk"),
  stays: () => import("./flows/stays"),
  market: () => import("./flows/market"),
  public: () => import("./flows/public"),
};

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const helpers: FlowHelpers = {
  as: (persona) => contextFor(persona),
  check,
  async refused(status, call, what) {
    try {
      await call();
    } catch (error) {
      if (error instanceof ApiError && error.status === status) return;
      fail(
        `${what}: expected HTTP ${status}, got ${error instanceof ApiError ? `HTTP ${error.status} ${error.message}` : String(error)}`,
      );
    }
    fail(`${what}: expected HTTP ${status}, but it succeeded`);
  },
  step: (message) => console.log(`      ${message}`),
};

void main(async () => {
  const area = arg("--area");
  const areas = area ? [area] : Object.keys(loaders);
  let count = 0;
  for (const a of areas) {
    const load = loaders[a];
    check(load, `no flows for area "${a}" (scripts/flows/${a}.ts)`);
    const { flows } = await load();
    check(flows.length > 0, `scripts/flows/${a}.ts declares no flows`);
    for (const flow of flows) {
      console.log(`  ${a}: ${flow.name}`);
      await flow.run(helpers);
      count++;
    }
  }
  return `FLOWS OK ${count}`;
});
