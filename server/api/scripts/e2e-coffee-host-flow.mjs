#!/usr/bin/env node
/**
 * End-to-end: coffee shop registration → verify → approve → setup → publish →
 * guest books → owner front desk sees the booking.
 *
 * Optional `--clean-dummy` first unpublishes every marketplace listing and
 * deletes all bookings (local sample DB only), so the desk and marketplace
 * hold only what this run creates.
 *
 * Needs API on :8000, sample-marked DB, demo OTP 123456.
 *
 *   node scripts/e2e-coffee-host-flow.mjs --clean-dummy
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";
import sharp from "sharp";

const BASE = process.env.API_BASE || "http://127.0.0.1:8000";
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3000";
const CLEAN = process.argv.includes("--clean-dummy");
const GASABO = { country: "RW", provinceId: 1, districtId: 102, sectorId: 10201 };
const STAMP = Date.now();
const HOST_EMAIL = `e2e.coffee.host.${STAMP}@injishi.com`;
const GUEST_EMAIL = "grace@demo.injishi.com";
const VERIFIER = "jeanbosco@demo.injishi.com";
const APPROVER = "claudine@demo.injishi.com";
const BUSINESS_NAME = `E2E Coffee Shop ${STAMP}`;

let pass = 0;
let fail = 0;
const failures = [];

function check(label, ok, detail) {
  if (ok) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const line = readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL missing");
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const db = new pg.Pool({ connectionString: databaseUrl() });
const q = async (text, params = []) => (await db.query(text, params)).rows;

async function assertSample() {
  const [row] = await q(`select kind from database_identity limit 1`);
  if (!row || row.kind !== "sample") {
    throw new Error("Refusing to clean/run: database_identity.kind is not sample");
  }
}

/** Unpublish every listing and wipe bookings so only this run's data remains live. */
async function cleanDummy() {
  console.log("\n=== Clean dummy marketplace + bookings (sample DB) ===");
  await assertSample();
  const pub = await q(`update listings set status = 'draft', published_at = null where status = 'published' returning id`);
  console.log(`  unpublished ${pub.length} listings`);

  // Truncate the booking graph in one go (sample DB only). CASCADE follows
  // FKs into stays, folios, escrows, attempts, reservation threads, etc.
  const before = await q(`select count(*)::int as n from bookings`);
  await q(`truncate table bookings restart identity cascade`);
  console.log(`  truncated bookings (was ${before[0].n})`);
  const left = await q(`select count(*)::int as n from listings where status = 'published'`);
  const b = await q(`select count(*)::int as n from bookings`);
  check("marketplace empty of published listings", left[0].n === 0, `published=${left[0].n}`);
  check("no bookings left", b[0].n === 0, `bookings=${b[0].n}`);
}

async function markVerified(email, fullName, dateOfBirth) {
  const [user] = await q(`select id from users where lower(email) = lower($1)`, [email]);
  if (!user) throw new Error(`no user ${email}`);
  await q(
    `insert into verified_identities (user_id, kyc_status, legal_full_name, dob, verified_method, verified_at)
     values ($1, 'verified', $2, $3, 'manual', now())
     on conflict (user_id) do update set kyc_status = 'verified', legal_full_name = $2, dob = $3,
       verified_method = 'manual', verified_at = now()`,
    [user.id, fullName, dateOfBirth],
  );
}

const JAR_FILE = join(tmpdir(), "injishi-e2e-coffee-sessions.json");
const JARS = (() => {
  try {
    return existsSync(JAR_FILE) ? JSON.parse(readFileSync(JAR_FILE, "utf8")) : {};
  } catch {
    return {};
  }
})();

function makeSession(seed) {
  const jar = new Map(Object.entries(seed ?? {}));
  return {
    cookie: () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb(res) {
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(";");
        const idx = pair.indexOf("=");
        if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    },
    snapshot: () => Object.fromEntries(jar),
  };
}

async function call(session, method, path, body, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (session) headers.cookie = session.cookie();
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (session) session.absorb(res);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

async function signIn(email) {
  const cached = JARS[email];
  if (cached) {
    const reused = makeSession(cached);
    const probe = await call(reused, "GET", "/api/v1/me/profile");
    if (probe.status === 200) return reused;
  }
  const session = makeSession();
  const origin = { origin: WEB_ORIGIN };
  await call(session, "POST", "/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" }, origin);
  const res = await call(session, "POST", "/api/auth/sign-in/email-otp", { email, otp: "123456" }, origin);
  if (res.status !== 200) throw new Error(`sign-in failed for ${email}: ${res.status} ${res.text.slice(0, 200)}`);
  JARS[email] = session.snapshot();
  writeFileSync(JAR_FILE, JSON.stringify(JARS, null, 1));
  return session;
}

const randomTin = () => String(100000000 + Math.floor(Math.random() * 899999999));

async function waitFor(fn, { tries = 40, ms = 500, label = "condition" } = {}) {
  for (let i = 0; i < tries; i++) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, ms));
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function main() {
  const platform = await call(null, "GET", "/api/v1/platform");
  check("API is up (demo)", platform.status === 200 && platform.json?.environment === "demo", platform.text.slice(0, 120));
  if (fail) process.exit(1);

  if (CLEAN) await cleanDummy();

  console.log("\n=== 1. Register coffee shop ===");
  // Create host account via OTP (first sign-in creates the user on demo).
  const host = await signIn(HOST_EMAIL);
  await markVerified(HOST_EMAIL, "E2E Coffee Host", "1990-05-15");

  const body = {
    role: "host",
    capacity: "owner",
    personal: {
      fullName: "E2E Coffee Host",
      document: {
        documentType: "national_id",
        documentNumber: `11999${String(STAMP).slice(-10)}`.slice(0, 16).padEnd(16, "0"),
        issuingCountry: "RW",
      },
      dateOfBirth: "1990-05-15",
      phoneE164: `+25078${String(STAMP).slice(-7)}`,
      address: GASABO,
    },
    business: {
      domain: "hospitality",
      legalName: BUSINESS_NAME,
      address: GASABO,
      entityGroup: "restaurant_bar_nightclub",
      accommodationClass: "other",
      accommodationClassOther: "Coffee shop",
      tin: randomTin(),
      certificates: [],
    },
  };

  const created = await call(host, "POST", "/api/v1/registrations", body);
  const orgId = created.json?.orgId ?? created.json?.id;
  check("registration created", (created.status === 200 || created.status === 201) && orgId, `${created.status} ${created.text.slice(0, 240)}`);
  if (!orgId) return finish();

  const contract = await call(host, "POST", `/api/v1/registrations/${orgId}/contract`, { contractVersion: "2026-09-12" });
  check("contract accepted", contract.status === 200 || contract.status === 201, `${contract.status} ${contract.text.slice(0, 160)}`);

  const paid = await call(host, "POST", `/api/v1/registrations/${orgId}/pay`);
  check("fee paid → submitted", paid.status === 200 || paid.status === 201, `${paid.status} ${paid.text.slice(0, 200)}`);

  // TIN may move asynchronously; wait until tin_verified or field-ready.
  await waitFor(
    async () => {
      const [row] = await q(`select registration_status from orgs where id = $1`, [orgId]);
      return ["tin_verified", "field_verified", "approved", "active"].includes(row?.registration_status)
        ? row.registration_status
        : null;
    },
    { label: "TIN verified", tries: 60, ms: 500 },
  ).then((s) => check("TIN verified (or further)", !!s, s)).catch((e) => check("TIN verified (or further)", false, e.message));

  console.log("\n=== 2. Field verify + approve ===");
  const verifier = await signIn(VERIFIER);
  const fv = await call(verifier, "POST", `/api/v1/registrations/${orgId}/field-verify`, {});
  check("field verified", fv.status === 200 || fv.status === 201, `${fv.status} ${fv.text.slice(0, 200)}`);

  const approver = await signIn(APPROVER);
  const appr = await call(approver, "POST", `/api/v1/registrations/${orgId}/approve`, {});
  check("approved", appr.status === 200 || appr.status === 201, `${appr.status} ${appr.text.slice(0, 200)}`);

  const [active] = await q(`select registration_status from orgs where id = $1`, [orgId]);
  check("org active", active?.registration_status === "active", active?.registration_status);

  const ws = await call(host, "GET", "/api/v1/me/workspaces");
  const business = (ws.json?.workspaces ?? []).find((w) => w.orgId === orgId && w.kind === "business");
  const wsId = business?.workspaceId;
  check("host has business workspace", !!wsId, JSON.stringify(ws.json?.workspaces?.map((w) => w.orgName)).slice(0, 200));
  if (!wsId) return finish();
  const H = { "x-workspace-id": wsId };

  console.log("\n=== 3. Property setup + publish ===");
  // Approval may already have created a property; use it or create one.
  let props = await call(host, "GET", "/api/v1/inventory/properties", undefined, H);
  let property = props.json?.properties?.[0] ?? null;
  if (!property) {
    const createdProp = await call(
      host,
      "POST",
      "/api/v1/inventory/properties",
      { workspaceId: wsId, name: BUSINESS_NAME, sectorId: GASABO.sectorId, street: "KN 5 Ave", description: "E2E coffee venue" },
      H,
    );
    check("property created", createdProp.status === 201 || createdProp.status === 200, `${createdProp.status} ${createdProp.text.slice(0, 200)}`);
    property = createdProp.json;
  } else {
    check("property from approval", !!property.id, property?.name);
  }
  const propertyId = property?.id;
  if (!propertyId) return finish();

  await call(
    host,
    "PATCH",
    `/api/v1/inventory/properties/${propertyId}`,
    { workspaceId: wsId, description: "Fresh coffee and light meals in Kicukiro." },
    H,
  );

  const rt = await call(
    host,
    "POST",
    `/api/v1/inventory/properties/${propertyId}/room-types`,
    {
      workspaceId: wsId,
      name: "Espresso set",
      maxGuests: 1,
      basePriceRwf: 3500,
      roomCount: 1,
      bookingMode: "instant_book",
      cancellationTier: "flexible",
    },
    H,
  );
  const roomTypeId = rt.json?.id;
  check("priced offering (instant_book)", (rt.status === 201 || rt.status === 200) && roomTypeId, `${rt.status} ${rt.text.slice(0, 200)}`);

  const jpeg = await sharp({
    create: { width: 640, height: 480, channels: 3, background: { r: 180, g: 120, b: 60 } },
  })
    .jpeg()
    .toBuffer();
  const form = new FormData();
  form.append("file", new Blob([jpeg], { type: "image/jpeg" }), "venue.jpg");
  const upload = await call(host, "POST", "/api/v1/uploads/property-photo", form);
  const objectKey = upload.json?.objectKey ?? upload.json?.key;
  const attached = await call(
    host,
    "POST",
    `/api/v1/inventory/properties/${propertyId}/photos`,
    { workspaceId: wsId, objectKey, caption: "Counter" },
    H,
  );
  check(
    "photo attached",
    (attached.status === 201 || attached.status === 200) && objectKey,
    `upload ${upload.status} ${JSON.stringify(upload.json)?.slice(0, 120)}; attach ${attached.status} ${attached.text.slice(0, 160)}`,
  );

  const published = await call(host, "POST", `/api/v1/inventory/properties/${propertyId}/publish`, {}, H);
  const slug = published.json?.slug;
  check("published on marketplace", (published.status === 200 || published.status === 201) && slug, `${published.status} ${published.text.slice(0, 200)}`);

  const detail = await call(null, "GET", `/api/v1/properties/slug/${slug}`);
  const sellable = (detail.json?.roomTypes ?? []).some(
    (r) => r.domain === "hospitality" && r.nightlyRateRwf != null && r.bookingMode != null && r.roomCount > 0,
  );
  check("public listing sellable", detail.status === 200 && sellable, JSON.stringify(detail.json?.roomTypes?.[0]));

  console.log("\n=== 4. Guest books ===");
  const guest = await signIn(GUEST_EMAIL);
  const checkIn = "2026-12-01";
  const checkOut = "2026-12-03";
  const book = await call(guest, "POST", "/api/v1/bookings", {
    roomTypeId,
    checkIn,
    checkOut,
    guests: 1,
    nonRefundable: false,
    attemptToken: randomUUID(),
    instrument: { kind: "mobile_money", network: "mtn_momo", msisdn: "788123456" },
  });
  const attemptToken = book.json?.attempt?.attemptToken;
  check("booking awaiting payment", book.status === 200 || book.status === 201, `${book.status} ${book.text.slice(0, 240)}`);

  const settled = await waitFor(
    async () => {
      const poll = await call(guest, "GET", `/api/v1/bookings/attempts/${attemptToken}`);
      return poll.json?.state === "confirmed" ? poll.json : null;
    },
    { label: "MoMo mock settle", tries: 30, ms: 500 },
  ).catch(() => null);
  check("payment confirmed", !!settled?.booking?.reference, JSON.stringify(settled)?.slice(0, 200));
  const reference = settled?.booking?.reference;

  console.log("\n=== 5. Owner receives booking ===");
  const desk = await call(host, "GET", "/api/v1/ops/front-desk", undefined, H);
  const refs = (desk.json?.bookings ?? []).map((b) => b.reference);
  check("front desk names the venue", desk.json?.property?.name === BUSINESS_NAME || desk.json?.property?.name?.includes("E2E Coffee"), desk.json?.property?.name);
  check("booking on front desk", reference && refs.includes(reference), `want ${reference}, have ${refs.join(",")}`);

  console.log("\n--- Result ---");
  console.log(`  business: ${BUSINESS_NAME}`);
  console.log(`  host:     ${HOST_EMAIL} / 123456`);
  console.log(`  slug:     ${slug ? `http://localhost:3000/property/${slug}` : "(none)"}`);
  console.log(`  booking:  ${reference ?? "(none)"}`);
  console.log(`  desk:     http://localhost:3002/reservations (sign in as host)`);
  console.log(`  workspace:${wsId}`);

  return finish();
}

function finish() {
  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) console.log("Failed:", failures.join("; "));
  return db.end().then(() => process.exit(fail ? 1 : 0));
}

main().catch(async (err) => {
  console.error(err);
  await db.end().catch(() => {});
  process.exit(1);
});
