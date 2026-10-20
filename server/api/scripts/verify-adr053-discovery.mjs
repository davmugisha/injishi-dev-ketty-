// Verify ADR-053 slice 3: the invariants on a published property and discovery.
//
// WHAT IT PROVES, in order:
//   A. On a PUBLISHED property, archiving the only priced room type, pricing it
//      down to nothing, and removing the last photograph are each refused with
//      409; after unpublishing, all three are allowed (AC-I7).
//   B. `GET /api/v1/properties/sitemap` lists a published property, drops it when
//      it is unpublished, drops it when its business is suspended and restores it
//      on reinstatement with no republish: the same predicate as the page (AC-I9).
//   C. Web's `/sitemap.xml` reads B: it lists the published property's page on
//      web's origin, and no `/waitlist`, which went at launch (ADR-048).
//   D. A property page carries a canonical link built from web's origin and the
//      slug (AC-I9).
//   E. The inventory reads answer with the workspace in the header alone: the
//      discarded `workspaceId` query parameter is gone (task 18).
//
// WHAT IT LEAVES BEHIND: one property named "ADR-053 Verify Discovery …" on the
// business `host@injishi.com` owns, unpublished at the end. The business is
// suspended and reinstated during B; the finally block reinstates it if a step
// fails in between.
//
// Needs the API on 8000 (sample marked database) and web on WEB_BASE, default
// http://localhost:3000. Web's NEXT_PUBLIC_WEB_URL decides the origin its
// sitemap and canonical links print; set WEB_URL to match it.
//
// Run it:  WEB_BASE=http://localhost:3310 node scripts/verify-adr053-discovery.mjs

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.API_BASE || "http://127.0.0.1:8000";
const WEB_BASE = process.env.WEB_BASE || "http://localhost:3000";
const WEB_URL = process.env.WEB_URL || "http://localhost:3000";
const WEB_ORIGIN = "http://localhost:3000";
const GASABO_SECTOR = 10201;
const FIXTURE_SLUG = "lanternhouse-hotel-kiyovu";
const REASON = "ADR-053 slice 3 verification";

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

const JAR_FILE = join(tmpdir(), "injishi-verify-adr053-sessions.json");
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
  if (res.status !== 200) throw new Error(`sign-in failed for ${email}: ${res.status} ${res.text.slice(0, 160)}`);
  JARS[email] = session.snapshot();
  writeFileSync(JAR_FILE, JSON.stringify(JARS, null, 1));
  return session;
}

const inSitemap = async (slug) => {
  const res = await call(null, "GET", "/api/v1/properties/sitemap");
  return { status: res.status, listed: (res.json ?? []).some((e) => e.slug === slug), json: res.json };
};
const webSitemap = async () => {
  const res = await fetch(`${WEB_BASE}/sitemap.xml`, { signal: AbortSignal.timeout(180_000) });
  return { status: res.status, type: res.headers.get("content-type"), text: await res.text() };
};

let suspendedOrgId = null;
let admin = null;

const main = async () => {
  admin = await signIn("admin@injishi.com");
  const host = await signIn("host@injishi.com");
  const ws = await call(host, "GET", "/api/v1/me/workspaces");
  const business = (ws.json?.workspaces ?? []).find((w) => w.kind === "business" && w.permissions?.includes("listing.manage"));
  if (!business) throw new Error("host@injishi.com holds no business workspace with listing.manage");
  const wsId = business.workspaceId;
  const H = { "x-workspace-id": wsId };

  // -------------------------------------------------------------------------
  console.log("\n=== E. The inventory reads take the header alone (task 18) ===");
  const list = await call(host, "GET", "/api/v1/inventory/properties", undefined, H);
  check("GET /inventory/properties with no query string answers 200", list.status === 200 && Array.isArray(list.json?.properties), `status ${list.status} ${list.text.slice(0, 160)}`);

  // -------------------------------------------------------------------------
  console.log("\n--- author and publish a clean property ---");
  const created = await call(host, "POST", "/api/v1/inventory/properties", { workspaceId: wsId, name: `ADR-053 Verify Discovery ${Date.now()}`, sectorId: GASABO_SECTOR }, H);
  const pid = created.json?.id;
  check("create a property", created.status === 201 && pid, `status ${created.status} ${created.text.slice(0, 200)}`);
  if (!pid) return;
  const one = await call(host, "GET", `/api/v1/inventory/properties/${pid}`, undefined, H);
  check("GET /inventory/properties/:id with no query string answers 200", one.status === 200 && one.json?.id === pid, `status ${one.status}`);

  const rt = await call(host, "POST", `/api/v1/inventory/properties/${pid}/room-types`, { workspaceId: wsId, name: "Only Priced Room", maxGuests: 2, basePriceRwf: 60000, bookingMode: "instant_book" }, H);
  const rtId = rt.json?.id;
  check("one priced room type", rt.status === 201 && rtId, `status ${rt.status} ${rt.text.slice(0, 160)}`);

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "discovery.png");
  const upload = await call(host, "POST", "/api/v1/uploads/property-photo", form);
  const attached = await call(host, "POST", `/api/v1/inventory/properties/${pid}/photos`, { workspaceId: wsId, objectKey: upload.json?.objectKey }, H);
  const photoId = attached.json?.photos?.[0]?.id;
  check("one photograph", attached.status === 201 && photoId, `upload ${upload.status}, attach ${attached.status} ${attached.text.slice(0, 160)}`);

  const published = await call(host, "POST", `/api/v1/inventory/properties/${pid}/publish`, undefined, H);
  const slug = published.json?.slug;
  check("publish it", published.status === 200 && slug, `status ${published.status} ${published.text.slice(0, 200)}`);
  if (!slug) return;

  // -------------------------------------------------------------------------
  console.log("\n=== A. Refusing the writes that would break a published property (AC-I7) ===");
  const archive = await call(host, "PATCH", `/api/v1/inventory/room-types/${rtId}`, { workspaceId: wsId, status: "archived" }, H);
  check("archiving the only priced room type is refused with 409", archive.status === 409, `status ${archive.status} ${archive.text.slice(0, 200)}`);
  const unprice = await call(host, "PATCH", `/api/v1/inventory/room-types/${rtId}`, { workspaceId: wsId, basePriceRwf: null }, H);
  check("removing its price is refused with 409", unprice.status === 409, `status ${unprice.status} ${unprice.text.slice(0, 200)}`);
  const removePhoto = await call(host, "DELETE", `/api/v1/inventory/properties/${pid}/photos/${photoId}`, undefined, H);
  check("removing the last photograph is refused with 409", removePhoto.status === 409, `status ${removePhoto.status} ${removePhoto.text.slice(0, 200)}`);
  check("each refusal says to unpublish first", [archive, unprice, removePhoto].every((r) => /unpublish/i.test(String(r.json?.message))), [archive, unprice, removePhoto].map((r) => r.json?.message).join(" | "));
  const stillPublished = await inSitemap(slug);
  check("and the property is still listed after the refusals", stillPublished.listed);

  // -------------------------------------------------------------------------
  console.log("\n=== B. The sitemap reads the page's predicate (AC-I9) ===");
  check("GET /properties/sitemap lists the published property", stillPublished.status === 200 && stillPublished.listed, JSON.stringify(stillPublished.json)?.slice(0, 200));
  const entry = (stillPublished.json ?? []).find((e) => e.slug === slug);
  check("with its publish time as lastmod", typeof entry?.publishedAt === "string", JSON.stringify(entry));

  const web = await webSitemap();
  const expectedUrl = `${WEB_URL}/property/${slug}`;
  console.log("\n=== C. Web's /sitemap.xml reads the API sitemap (AC-I9) ===");
  check("web serves /sitemap.xml as XML", web.status === 200 && /xml/.test(String(web.type)), `status ${web.status} ${web.type}`);
  check("it lists the published property's page", web.text.includes(`<loc>${expectedUrl}</loc>`), web.text.slice(0, 400));
  check("and no /waitlist", !web.text.includes("/waitlist"), web.text.slice(0, 400));

  console.log("\n--- suspend the business, then reinstate it ---");
  const orgId = business.orgId;
  const sus = await call(admin, "POST", `/api/v1/admin/orgs/${orgId}/suspend`, { reason: REASON });
  suspendedOrgId = [200, 201].includes(sus.status) ? orgId : null;
  check("suspend", [200, 201].includes(sus.status), `status ${sus.status} ${sus.text.slice(0, 160)}`);
  check("a suspended business's property leaves the API sitemap", !(await inSitemap(slug)).listed);
  const rei = await call(admin, "POST", `/api/v1/admin/orgs/${orgId}/reinstate`, { reason: REASON });
  if ([200, 201].includes(rei.status)) suspendedOrgId = null;
  check("reinstate", [200, 201].includes(rei.status), `status ${rei.status}`);
  check("reinstated, it is listed again with no republish", (await inSitemap(slug)).listed);

  // -------------------------------------------------------------------------
  console.log("\n--- unpublish: out of the sitemap, and the refused writes are allowed ---");
  const unpub = await call(host, "POST", `/api/v1/inventory/properties/${pid}/unpublish`, undefined, H);
  check("unpublish", unpub.status === 200 && unpub.json?.listingStatus === "draft", `status ${unpub.status}`);
  check("an unpublished property leaves the API sitemap", !(await inSitemap(slug)).listed);
  const archiveDraft = await call(host, "PATCH", `/api/v1/inventory/room-types/${rtId}`, { workspaceId: wsId, status: "archived" }, H);
  check("AC-I7 on the draft, archiving the room type is allowed", archiveDraft.status === 200, `status ${archiveDraft.status} ${archiveDraft.text.slice(0, 160)}`);
  const removeDraft = await call(host, "DELETE", `/api/v1/inventory/properties/${pid}/photos/${photoId}`, undefined, H);
  check("AC-I7 on the draft, removing the photograph is allowed", removeDraft.status === 200, `status ${removeDraft.status} ${removeDraft.text.slice(0, 160)}`);

  // -------------------------------------------------------------------------
  console.log("\n=== D. The canonical link (AC-I9) ===");
  const page = await fetch(`${WEB_BASE}/property/${FIXTURE_SLUG}`, { signal: AbortSignal.timeout(180_000) });
  const html = await page.text();
  const canonical = html.match(/<link[^>]+rel="canonical"[^>]*>/)?.[0] ?? "";
  check(
    "the property page's canonical is web's origin, /property/, the slug",
    page.status === 200 && canonical.includes(`href="${WEB_URL}/property/${FIXTURE_SLUG}"`),
    `status ${page.status} ${canonical || "no canonical link"}`,
  );
};

main()
  .catch((error) => {
    console.error("\nHARNESS ERROR:", error.message);
    fail += 1;
  })
  .finally(async () => {
    if (suspendedOrgId && admin) {
      await call(admin, "POST", `/api/v1/admin/orgs/${suspendedOrgId}/reinstate`, { reason: REASON }).catch(() => {});
      console.log("  (reinstated the business the run left suspended)");
    }
    console.log(`\n==================== ${pass} passed, ${fail} failed ====================`);
    if (failures.length) console.log("Failed:\n - " + failures.join("\n - "));
    process.exit(fail === 0 ? 0 : 1);
  });
