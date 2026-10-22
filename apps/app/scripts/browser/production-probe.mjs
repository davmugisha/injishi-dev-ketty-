#!/usr/bin/env node
/**
 * Is production running the shared-session sign-in? Read-only: two GETs and nothing that sends mail or
 * opens a session.
 *
 *   node apps/app/scripts/browser/production-probe.mjs
 *
 * A merged fix does nothing until Dokploy deploys it (auto deploy is off: infra/docker/DOKPLOY.md), and a
 * stack that kept the old images looks healthy from outside. These markers only the new code produces:
 *   - the API's GET /api/v1/platform carries `googleSignIn` (added with the shared session);
 *   - the app's sign-in screen no longer says Google "isn't available in the demo yet" outside the demo;
 *   - web hands /sign-in to the app.
 * Prints "PRODUCTION PROBE OK" only when all hold.
 */
const API = (process.env.PROBE_API_URL ?? "https://api.injishi.com").replace(/\/$/, "");
const APP = (process.env.PROBE_APP_URL ?? "https://app.injishi.com").replace(/\/$/, "");
const WEB = (process.env.PROBE_WEB_URL ?? "https://www.injishi.com").replace(/\/$/, "");

const failures = [];

const platform = await (await fetch(`${API}/api/v1/platform`, { signal: AbortSignal.timeout(20_000) })).json();
console.log(`  ${API}/api/v1/platform: ${JSON.stringify(platform)}`);
if (typeof platform.googleSignIn !== "boolean")
  failures.push("the API does not report googleSignIn: it predates the shared session");

const signIn = await (await fetch(`${APP}/sign-in`, { signal: AbortSignal.timeout(20_000) })).text();
if (platform.environment !== "demo" && /in the demo yet/.test(signIn)) {
  failures.push("the app's sign-in screen still says Google is missing from the demo: it predates the shared session");
}

const handoff = await fetch(`${WEB}/sign-in`, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
const location = handoff.headers.get("location") ?? "";
if (!location.startsWith(`${APP}/sign-in`))
  failures.push(`web's /sign-in answers ${handoff.status} → ${location || "nowhere"}, not the app`);

for (const failure of failures) console.log(`  FAIL ${failure}`);
if (failures.length) process.exit(1);
console.log("PRODUCTION PROBE OK");
