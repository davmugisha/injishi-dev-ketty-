// Database CLI: `pnpm db:seed` (re-seed now) · `pnpm db:reset` (delete the file and re-seed) · `verify`.
import fs from "node:fs";
import { DEMO_OTP, personas } from "@injishi/data/personas";
import { databaseUrl, getClient, getDb, seed } from "./client.ts";
import { createSession, getCollection, getSession, startOtp, verifyOtp } from "./repo.ts";

const command = process.argv[2] ?? "seed";
const url = databaseUrl();

if (command === "reset") {
  const file = url.replace(/^file:/, "");
  for (const f of [file, `${file}-wal`, `${file}-shm`]) if (fs.existsSync(f)) fs.rmSync(f);
  console.log(`removed ${file}`);
}

const db = await getDb();
const client = await getClient();

if (command === "seed" || command === "reset") {
  const result = await seed(db, client);
  console.log(`seeded ${url}: ${result.users} users, ${result.collections} collections, ${result.documents} documents`);
} else if (command === "verify") {
  // End-to-end check of the embedded database contract used by the app.
  const fail = (m: string) => {
    console.error(`DB FAIL: ${m}`);
    process.exit(1);
  };
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  const names = tables.rows.map((r) => String(r.name));
  for (const t of ["documents", "meta", "otp_challenges", "sessions", "users"])
    if (!names.includes(t)) fail(`table ${t} missing`);
  const userCount = Number((await client.execute("SELECT count(*) AS n FROM users")).rows[0].n);
  if (userCount !== Object.keys(personas).length)
    fail(`users ${userCount} != personas ${Object.keys(personas).length}`);
  const roles = await getCollection<{ id: string; name: string }>("platform.hubRoles");
  if (roles.length !== 23 || roles[0].name !== "Owner") fail(`platform.hubRoles not seeded in order (${roles.length})`);
  const start = await startOtp(personas.frontdesk.email);
  if (!start.ok) fail("startOtp refused a persona email");
  else {
    const wrong = await verifyOtp(start.challengeId, "000000");
    if (wrong.ok || wrong.reason !== "wrong-code") fail("wrong code was not rejected");
    const right = await verifyOtp(start.challengeId, DEMO_OTP);
    if (!right.ok || right.personaId !== "frontdesk") fail("demo code did not verify");
    const reuse = await verifyOtp(start.challengeId, DEMO_OTP);
    if (reuse.ok) fail("a consumed code verified twice");
  }
  if ((await startOtp("nobody@example.com")).ok) fail("unknown email started a challenge");
  const { token } = await createSession("owner");
  const session = await getSession(token);
  if (session?.personaId !== "owner") fail("session round-trip failed");
  console.log(`DB OK ${url} users=${userCount} hubRoles=${roles.length}`);
} else {
  console.error(`unknown command ${command}`);
  process.exit(2);
}
process.exit(0);
