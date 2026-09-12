import type { AdminEnvironments } from "@injishi/contracts";

import type { SectionModel, SectionStat } from "@/lib/types";

import { humanise } from "./format";

/**
 * Environments (F-A11) — which adapters this deployment is actually running.
 */

/**
 * The four adapter modes, one stat each.
 *
 * `mock` is amber everywhere, without exception and without a "but this is
 * staging" carve-out. The console has no way to know it is looking at staging —
 * it is told a mode and an environment name, and an environment name is a
 * string somebody typed. So the rule is the flat one: a mock adapter is always
 * called out, and a staging environment simply shows four amber stats, which is
 * a true description of staging.
 *
 * The modes are repeated from the API, never decided here. `lib/api/
 * environments.ts` records why: a console that is a second source of truth for
 * which adapter is live can say "payments: live" while the payment module runs
 * the mock.
 */
export function presentAdapterModes(env: AdminEnvironments): SectionStat[] {
  const modes = env.current.adapterModes;
  return (
    [
      ["Payments", modes.payments],
      ["Storage", modes.storage],
      ["SMS", modes.sms],
      ["EBM", modes.ebm],
    ] as const
  ).map(([label, mode]) => ({
    label,
    value: mode,
    intent: mode === "mock" ? ("warning" as const) : ("success" as const),
    note: mode === "mock" ? "no real money or messages move" : "live adapter",
  }));
}

/**
 * The headline: how much of this deployment is pretending.
 *
 * A count rather than a name, because "production" as a label means nothing if
 * three of its four adapters are mocks — and that combination is exactly the
 * one worth showing at the top of the screen.
 */
export function presentEnvironmentPrimary(
  env: AdminEnvironments,
): SectionModel["primary"] {
  const modes = Object.values(env.current.adapterModes);
  const mocked = modes.filter((m) => m === "mock").length;

  return {
    label: env.current.name,
    value: `${mocked} of ${modes.length} mocked`,
    note: humanise(env.current.nodeEnv),
    // All-live and all-mock are both coherent deployments. The MIXED one is
    // what earns amber: it is the state in which a staffer can be looking at a
    // real payment beside a fake invoice and have no reason to suspect it.
    intent:
      mocked === 0
        ? "success"
        : mocked === modes.length
          ? "default"
          : "warning",
  };
}
